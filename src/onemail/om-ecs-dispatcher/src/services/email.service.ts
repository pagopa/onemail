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
import { ERROR_CODES } from '#dtos/error.dto';
import { ApiError } from '#errors/api.error';
import {
  mapEmailLowPriorityToDbItem,
  mapEmailTransactionalToDbItem,
} from '#utils/dbMapper';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  BatchWriteCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { StatusCodes } from 'http-status-codes';
import { randomUUID } from 'node:crypto';
import {
  EmailStatus,
  EmailStatusHistoryItem,
  TenantConfigurationItem,
} from 'om-common/types';

export const sendEmailTransactional = async (
  emailData: EmailHighPriorityBodyDTO,
  dryRun: boolean,
  tenantId: string,
): Promise<EmailHighPriorityResponseDTO> => {
  const logger = getNamedLogger(sendEmailTransactional.name);
  logger.info('Start');

  // get tenant configuration for clientId and configSetName
  const tenantConfiguration = await getTenantConfiguration(tenantId);
  // TODO: METRIC
  if (!tenantConfiguration) {
    throw new ApiError(
      `Tenant configuration not found for tenantId ${tenantId}`,
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.INVALID_TENANT,
    );
  }

  const requestId = randomUUID();
  // add get clientId and configSetName from tenant table
  const tableName = env.aws.emailDbTable;

  const dbObj = mapEmailTransactionalToDbItem(
    emailData,
    requestId,
    tenantConfiguration,
    dryRun,
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

  logger.info('End');
  return { requestId };
};

export const sendEmailLowPriority = async (
  emailData: EmailLowPriorityBodyDTO,
  dryRun: boolean,
  tenantId: string,
): Promise<EmailLowPriorityResponseDTO> => {
  const logger = getNamedLogger(sendEmailLowPriority.name);
  logger.info('Start');

  // get tenant configuration for clientId and configSetName
  const tenantConfiguration = await getTenantConfiguration(tenantId);
  // TODO: METRIC
  if (!tenantConfiguration) {
    throw new ApiError(
      `Tenant configuration not found for tenantId ${tenantId}`,
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.INVALID_TENANT,
    );
  }
  const requestId = randomUUID();
  const tableName = env.aws.emailDbTable;

  const dbListObj = mapEmailLowPriorityToDbItem(
    emailData,
    requestId,
    tenantConfiguration,
    dryRun,
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
              PutRequest: {
                Item: { ...item },
              },
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
      MessageBody: JSON.stringify({ requestId: requestId }),
    }),
  );

  logger.info('End');
  return { requestId };
};

export const getEmailStatus = async (
  requestId: string,
  tenantId: string,
): Promise<EmailStatusResponseDTO> => {
  const logger = getNamedLogger(getEmailStatus.name);
  logger.info('Start');

  const tenantConfiguration = await getTenantConfiguration(tenantId);
  // TODO: METRIC
  if (!tenantConfiguration) {
    throw new ApiError(
      `Tenant configuration not found for tenantId ${tenantId}`,
      StatusCodes.BAD_REQUEST,
      ERROR_CODES.INVALID_TENANT,
    );
  }

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
    // TODO: not found metric
    throw new ApiError(
      `Email with requestId ${requestId} not found`,
      StatusCodes.NOT_FOUND,
      ERROR_CODES.RESOURCE_NOT_FOUND,
    );
  }

  const mapped = items.map((item) => {
    // Sort history in descending order based on changedAt timestamp
    const sortedHistory = [...item.history].sort(
      (a, b) =>
        new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
    );

    const attempts = item.history.filter(
      (event) => event.status === EmailStatus.Dispatched,
    ).length;

    return {
      status: item.status,
      priority: item.priority,
      history: sortedHistory,
      to: item.content.to,
      emailId: item.emailId,
      attempts,
    };
  });

  // TODO: success metric

  logger.info('End');
  return mapped;
};

export const getTenantConfiguration = async (
  tenantName: string,
): Promise<TenantConfigurationItem | undefined> => {
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

  const tenantConfigurations =
    (result.Items as TenantConfigurationItem[] | undefined) ?? [];

  if (tenantConfigurations.length === 0) {
    return undefined;
  }
  // TODO: metric for multiple tenant configurations found with same tenantName
  if (tenantConfigurations.length > 1) {
    throw new ApiError(
      `Multiple tenant configurations found for tenantName ${tenantName}`,
      StatusCodes.CONFLICT,
      ERROR_CODES.INVALID_TENANT,
    );
  }

  const [tenantConfiguration] = tenantConfigurations;

  return tenantConfiguration;
};
