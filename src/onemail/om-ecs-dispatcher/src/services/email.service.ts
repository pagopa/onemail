import env from '#config/env';
import { getNamedLogger } from '#config/logger';
import { dynamoClient } from '#connectors/dynamo.connector';
import { sqsClient } from '#connectors/sqs.connector';
import {
  EmailHighPriorityBodyDTO,
  EmailHighPriorityResponseDTO,
} from '#dtos/email/emailHighPriority.dto';
import {
  EmailLowPriorityBodyDTO,
  EmailLowPriorityResponseDTO,
} from '#dtos/email/emailLowPriority.dto';
import { EmailStatusResponseDTO } from '#dtos/email/emailStatus.dto';
import { SanitizeHtmlResponseDTO } from '#dtos/email/validateHtml.dto';
import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/api.error';
import {
  deleteAttachment,
  putAttachment,
} from '#repositories/attachment.repository';
import {
  validateAttachments,
  ValidatedAttachment,
} from '#utils/attachmentValidator';
import {
  mapEmailLowPriorityToDbItem,
  mapEmailTransactionalToDbItem,
} from '#utils/dbMapper';
import {
  hasMeaningfulHtmlSanitizationChange,
  sanitizeEmailHtml,
} from '#utils/htmlSanitizer';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  BatchWriteCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { StatusCodes } from 'http-status-codes';
import { randomUUID } from 'node:crypto';
import { DispatcherMetricName, publishMetrics } from 'om-common/repositories';
import {
  EmailAttachmentRef,
  EmailStatus,
  EmailStatusHistoryItem,
  TenantConfigurationItem,
} from 'om-common/types';

export const sendEmailTransactional = async (
  emailData: EmailHighPriorityBodyDTO,
  dryRun: boolean,
  tenantName: string,
): Promise<EmailHighPriorityResponseDTO> => {
  const logger = getNamedLogger(sendEmailTransactional.name);
  logger.info('Start');

  // get tenant configuration for clientId and configSetName
  const tenantConfiguration =
    await getAndValidateTenantConfiguration(tenantName);
  const requestId = randomUUID();
  const tableName = env.aws.emailDbTable;
  const validatedAttachments = await validateRequestAttachments(
    emailData.attachments,
    tenantName,
    tenantConfiguration.clientId,
  );
  const attachmentRefs = dryRun
    ? undefined
    : await uploadAttachments(
        validatedAttachments,
        tenantName,
        requestId,
        logger,
      );
  const dbObj = mapEmailTransactionalToDbItem(
    emailData,
    requestId,
    tenantConfiguration,
    dryRun,
    attachmentRefs,
  );

  logger.debug('Saving email to DynamoDB', { emailId: dbObj.emailId });
  await dynamoClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        ...dbObj,
      },
    }),
  );
  logger.debug('Publishing message to SQS', { emailId: dbObj.emailId });
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: env.aws.sqs.highPriorityQueueUrl,
      MessageBody: JSON.stringify({ emailId: dbObj.emailId }),
    }),
  );
  publishMetrics([
    {
      name: DispatcherMetricName.HighPriorityAccepted,
      dimensions: { tenantName, clientId: tenantConfiguration.clientId },
    },
  ]);
  publishAttachmentMetric(
    validatedAttachments,
    tenantName,
    tenantConfiguration.clientId,
  );
  logger.info('End');
  return { requestId };
};

export const sendEmailLowPriority = async (
  emailData: EmailLowPriorityBodyDTO,
  dryRun: boolean,
  tenantName: string,
): Promise<EmailLowPriorityResponseDTO> => {
  const logger = getNamedLogger(sendEmailLowPriority.name);
  logger.info('Start');

  // get tenant configuration for clientId and configSetName
  const tenantConfiguration =
    await getAndValidateTenantConfiguration(tenantName);
  const requestId = randomUUID();
  const tableName = env.aws.emailDbTable;
  const validatedAttachments = await validateRequestAttachments(
    emailData.attachments,
    tenantName,
    tenantConfiguration.clientId,
  );
  const attachmentRefs = dryRun
    ? undefined
    : await uploadAttachments(
        validatedAttachments,
        tenantName,
        requestId,
        logger,
      );
  const dbListObj = mapEmailLowPriorityToDbItem(
    emailData,
    requestId,
    tenantConfiguration,
    dryRun,
    attachmentRefs,
  );

  // BatchWriteCommand max chunk size is 25
  const DYNAMO_BATCH_LIMIT = 25;
  // Split dbListObj into batches of max 25 items
  const batches: (typeof dbListObj)[] = [];
  for (let i = 0; i < dbListObj.length; i += DYNAMO_BATCH_LIMIT) {
    batches.push(dbListObj.slice(i, i + DYNAMO_BATCH_LIMIT));
  }

  logger.debug('Saving email batch to DynamoDB', { requestId });
  //TODO - handle unprocessed items in the response and retry logic if needed
  await Promise.all(
    batches.map((batch) =>
      dynamoClient.send(
        new BatchWriteCommand({
          RequestItems: {
            [tableName]: batch.map((item) => ({
              PutRequest: { Item: { ...item } },
            })),
          },
        }),
      ),
    ),
  );
  logger.debug('Publishing message to SQS', { requestId });
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: env.aws.sqs.lowPriorityQueueUrl,
      MessageBody: JSON.stringify({ requestId }),
    }),
  );
  publishMetrics([
    {
      name: DispatcherMetricName.LowPriorityAccepted,
      value: dbListObj.length,
      dimensions: { tenantName, clientId: tenantConfiguration.clientId },
    },
  ]);
  publishAttachmentMetric(
    validatedAttachments,
    tenantName,
    tenantConfiguration.clientId,
  );
  logger.info('End');
  return { requestId };
};

export const sanitizeHtmlContent = (
  htmlContent: string,
): SanitizeHtmlResponseDTO => {
  const sanitizedHtml = sanitizeEmailHtml(htmlContent);
  return {
    sanitizedHtml,
    isSanitized: hasMeaningfulHtmlSanitizationChange(
      htmlContent,
      sanitizedHtml,
    ),
  };
};

export const getEmailStatus = async (
  requestId: string,
  tenantName: string,
): Promise<EmailStatusResponseDTO> => {
  const logger = getNamedLogger(getEmailStatus.name);
  logger.info('Start');

  const tenantConfiguration =
    await getAndValidateTenantConfiguration(tenantName);
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: env.aws.emailDbTable,
      IndexName: env.aws.emailDbRequestIdGSI,
      KeyConditionExpression: '#requestId = :requestId',
      ExpressionAttributeNames: {
        '#requestId': 'requestId',
      },
      ExpressionAttributeValues: {
        ':requestId': requestId,
      },
    }),
  );
  const items = result.Items as EmailStatusHistoryItem[] | undefined;
  if (!items || items.length === 0) {
    publishMetrics([
      {
        name: DispatcherMetricName.EmailStatusNotFound,
        dimensions: { tenantName, clientId: tenantConfiguration.clientId },
      },
    ]);
    throw new ApiError(
      `Email with requestId ${requestId} not found`,
      StatusCodes.NOT_FOUND,
      ERROR_CODES.RESOURCE_NOT_FOUND,
    );
  }
  const mapped = items.map((item) => {
    if (tenantConfiguration.tenantName !== item.tenantName) {
      publishMetrics([
        {
          name: DispatcherMetricName.UnauthorizedTenant,
          dimensions: { tenantName, clientId: tenantConfiguration.clientId },
        },
      ]);
      throw new ApiError(
        `Email with requestId ${requestId} does not belong to tenant ${tenantName}`,
        StatusCodes.UNAUTHORIZED,
        ERROR_CODES.INVALID_TENANT,
      );
    }
    // Sort history in descending order based on changedAt timestamp
    const sortedHistory = [...item.history].sort(
      (a, b) =>
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );
    return {
      status: item.status,
      priority: item.priority,
      history: sortedHistory,
      to: item.content.to,
      emailId: item.emailId,
      attempts: item.history.filter(
        (event) => event.status === EmailStatus.Dispatched,
      ).length,
    };
  });
  logger.info('End');
  return mapped;
};

const getAndValidateTenantConfiguration = async (
  tenantName: string,
): Promise<TenantConfigurationItem> => {
  const tenantConfigurations =
    await getTenantConfigurationByTenantName(tenantName);
  if (!tenantConfigurations || tenantConfigurations.length === 0) {
    publishMetrics([
      {
        name: DispatcherMetricName.TenantConfigurationNotFound,
        dimensions: {
          tenantName: tenantName,
        },
      },
    ]);
    throw new ApiError(
      `Tenant configuration not found for tenantName ${tenantName}`,
      StatusCodes.UNAUTHORIZED,
      ERROR_CODES.INVALID_TENANT,
    );
  }
  if (tenantConfigurations.length > 1) {
    publishMetrics([
      {
        name: DispatcherMetricName.MultipleTenantForClient,
        dimensions: { tenantName: tenantName },
      },
    ]);
    throw new ApiError(
      `Tenant configuration conflict for tenantName ${tenantName}`,
      StatusCodes.UNAUTHORIZED,
      ERROR_CODES.INVALID_TENANT,
    );
  }
  return tenantConfigurations[0];
};

const getTenantConfigurationByTenantName = async (
  tenantName: string,
): Promise<TenantConfigurationItem[]> => {
  const result = await dynamoClient.send(
    new QueryCommand({
      TableName: env.aws.tenantConfigurationTable,
      IndexName: env.aws.tenantDbConfigurationTenantNameGSI,
      KeyConditionExpression: '#tenantName = :tenantName',
      ExpressionAttributeNames: {
        '#tenantName': 'tenantName',
      },
      ExpressionAttributeValues: {
        ':tenantName': tenantName,
      },
    }),
  );
  return (result.Items as TenantConfigurationItem[] | undefined) ?? [];
};

const validateRequestAttachments = async (
  attachments:
    | EmailHighPriorityBodyDTO['attachments']
    | EmailLowPriorityBodyDTO['attachments'],
  tenantName: string,
  clientId: string,
): Promise<ValidatedAttachment[]> => {
  if (!attachments?.length) return [];

  try {
    return await validateAttachments(attachments);
  } catch (error) {
    publishMetrics([
      {
        name: DispatcherMetricName.AttachmentRejected,
        dimensions: { tenantName, clientId },
      },
    ]);
    throw error;
  }
};

const uploadAttachments = async (
  attachments: ValidatedAttachment[],
  tenantName: string,
  requestId: string,
  logger: ReturnType<typeof getNamedLogger>,
): Promise<EmailAttachmentRef[] | undefined> => {
  if (!attachments.length) return undefined;

  const uploadedKeys: string[] = [];
  try {
    return await Promise.all(
      attachments.map(async (attachment) => {
        const attachmentId = randomUUID();
        const key = `${tenantName}/${requestId}/${attachmentId}/${attachment.filename}`;
        await putAttachment({
          key,
          body: attachment.bytes,
          contentType: attachment.contentType,
        });
        uploadedKeys.push(key);
        logger.info('Attachment uploaded', {
          filename: attachment.filename,
          size: attachment.size,
          sha256: attachment.sha256,
        });
        return {
          filename: attachment.filename,
          contentType: attachment.contentType,
          size: attachment.size,
          sha256: attachment.sha256,
          s3Bucket: env.aws.attachmentsBucket,
          s3Key: key,
        };
      }),
    );
  } catch (error) {
    logger.error('Attachment upload failed', {
      uploadedCount: uploadedKeys.length,
      error,
    });
    const deleteResults = await Promise.allSettled(
      uploadedKeys.map((key) => deleteAttachment(key)),
    );
    deleteResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        logger.error('Failed to delete attachment after upload failure', {
          key: uploadedKeys[index],
          reason: result.reason,
        });
      }
    });
    throw error;
  }
};

const publishAttachmentMetric = (
  attachments: ValidatedAttachment[],
  tenantName: string,
  clientId: string,
): void => {
  if (!attachments.length) return;
  publishMetrics([
    {
      name: DispatcherMetricName.AttachmentAccepted,
      value: attachments.length,
      dimensions: { tenantName, clientId },
    },
  ]);
};
