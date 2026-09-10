import { DryRunValidationError } from '#errors/dryRunValidation.error';
import {
  Attachment,
  Body,
  BulkEmailEntry,
  EmailContent,
  SendBulkEmailCommandInput,
  SendEmailCommandInput,
} from '@aws-sdk/client-sesv2';
import { EmailAddress, EmailStatusHistoryItem } from 'om-common/types';
import { SES_SIMULATOR } from 'om-common/utils';

export function mapDbHighPriorityItemToSesModel(
  item: EmailStatusHistoryItem,
  attachmentsBytes?: Uint8Array[],
): SendEmailCommandInput {
  const { content } = item;

  checkDryRunRecipient(item);

  const headers = content.extendedHeaders?.map((h) => ({
    Name: h.N,
    Value: h.V,
  }));
  const attachments = mapAttachments(content.attachments, attachmentsBytes);

  const content_obj: EmailContent = {};

  if (content.template) {
    content_obj.Template = {
      TemplateName: content.template.id,
      TemplateData: content.template.matchedAttributes ?? '{}',
      Headers: headers,
      ...(attachments ? { Attachments: attachments } : {}),
    };
  } else if (content.body) {
    const simpleBodyContent: Body = {};
    simpleBodyContent.Html = { Data: content.body.html };
    if (content.body.text) {
      simpleBodyContent.Text = { Data: content.body.text };
    }

    content_obj.Simple = {
      Subject: { Data: content.subject },
      Body: simpleBodyContent,
      Headers: headers,
      ...(attachments ? { Attachments: attachments } : {}),
    };
  }

  const input: SendEmailCommandInput = {
    FromEmailAddress: formatEmailAddress(content.from),
    Destination: {
      ToAddresses: [formatEmailAddress(content.to)],
    },
    Content: content_obj,
    TenantName: item.tenantName,
    ConfigurationSetName: item.configSetName,
  };

  return input;
}

export function mapDbLowPriorityItemToSesModel(
  items: EmailStatusHistoryItem[],
  attachmentsBytes?: Uint8Array[],
): SendBulkEmailCommandInput {
  // Use the first item to derive shared defaults (from, template name)
  const firstContent = items[0].content;

  // TODO: in case of thrown error, check if the error needs to make message item retryable or if it's a hard failure that should be discarded

  if (!firstContent.template) {
    throw new Error(
      'SendBulkEmail only supports template-based content. Body content is not allowed.',
    );
  }

  const attachments = mapAttachments(
    firstContent.attachments,
    attachmentsBytes,
  );

  const bulkEntries: BulkEmailEntry[] = items.map((item) => {
    const { content } = item;

    //TODO replace validation of template that cannot be undefined
    if (!content.template) {
      throw new Error(
        'SendBulkEmail only supports template-based content. Body content is not allowed.',
      );
    }

    checkDryRunRecipient(item);

    const headers = content.extendedHeaders?.map((h) => ({
      Name: h.N,
      Value: h.V,
    }));

    return {
      Destination: {
        ToAddresses: [formatEmailAddress(content.to)],
      },
      ReplacementEmailContent: {
        ReplacementTemplate: {
          ReplacementTemplateData: content.template.matchedAttributes ?? '{}',
        },
      },
      ReplacementHeaders: headers,
    };
  });

  const input: SendBulkEmailCommandInput = {
    FromEmailAddress: formatEmailAddress(firstContent.from),
    ReplyToAddresses: firstContent.replyTo
      ? [formatEmailAddress(firstContent.replyTo)]
      : undefined,
    DefaultContent: {
      Template: {
        TemplateName: firstContent.template.id,
        TemplateData: '{}', // default empty, as we validate template attributes before and we are using ReplacementTemplateData for each entry
        ...(attachments ? { Attachments: attachments } : {}),
      },
    },
    BulkEmailEntries: bulkEntries,
    TenantName: items[0].tenantName,
    ConfigurationSetName: items[0].configSetName,
  };

  return input;
}

function mapAttachments(
  attachments: EmailStatusHistoryItem['content']['attachments'],
  attachmentsBytes?: Uint8Array[],
): Attachment[] | undefined {
  if (!attachments?.length || !attachmentsBytes?.length) return undefined;
  if (attachments.length !== attachmentsBytes.length) {
    throw new Error('Attachment metadata and content counts do not match');
  }

  return attachments.map((attachment, index) => ({
    RawContent: Buffer.from(attachmentsBytes[index]),
    FileName: attachment.filename,
    ContentType: attachment.contentType,
    ContentDisposition: 'ATTACHMENT',
    ContentTransferEncoding: 'BASE64',
  }));
}

// Validates that dry-run items target an approved SES simulator address.
function checkDryRunRecipient(item: EmailStatusHistoryItem): void {
  const isDryRun = item.dryRun === true;
  const toEmail = item.content.to.email;

  if (
    isDryRun &&
    !Object.values(SES_SIMULATOR).includes(toEmail as SES_SIMULATOR)
  ) {
    throw new DryRunValidationError(
      `Dry-run email item (id: ${item.emailId}) has non-simulator recipient address: ${toEmail}. Aborting send.`,
    );
  }
}

function escapeEmailDisplayName(name: string): string {
  // escape backslashes and double quotes in the display name
  const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // quote it if it contains special characters or leading/trailing whitespace
  const hasSpecialChars = /[",;:<>@()[\]\\]/.test(name);
  const hasLeadingOrTrailingWhitespace = /^\s/.test(name) || /\s$/.test(name);
  const needsQuoting = hasSpecialChars || hasLeadingOrTrailingWhitespace;
  return needsQuoting ? `"${escaped}"` : escaped;
}

function formatEmailAddress(address: EmailAddress): string {
  return address.name
    ? `${escapeEmailDisplayName(address.name)} <${address.email}>`
    : address.email;
}
