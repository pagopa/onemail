import { DryRunValidationError } from '#errors/DryRunValidationError';
import {
  Body,
  BulkEmailEntry,
  EmailContent,
  SendBulkEmailCommandInput,
  SendEmailCommandInput,
} from '@aws-sdk/client-sesv2';
import { EmailStatusHistoryItem } from 'om-common/types';
import { SES_SIMULATOR } from 'om-common/utils';

export function mapDbHighPriorityItemToSesModel(
  item: EmailStatusHistoryItem,
): SendEmailCommandInput {
  const { content } = item;

  checkDryRunRecipient(item);

  const headers = content.extendedHeaders?.map((h) => ({
    Name: h.N,
    Value: h.V,
  }));

  const content_obj: EmailContent = {};

  if (content.template) {
    content_obj.Template = {
      TemplateName: content.template.id,
      TemplateData: content.template.matchedAttributes ?? '{}',
      Headers: headers,
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
    };
  }

  const input: SendEmailCommandInput = {
    FromEmailAddress: content.from.name
      ? `${content.from.name} <${content.from.email}>`
      : content.from.email,
    Destination: {
      ToAddresses: content.to.name
        ? [`${content.to.name} <${content.to.email}>`]
        : [content.to.email],
    },
    Content: content_obj,
  };

  //TODO - configuration set to be added

  //TODO - tenantName to be added

  return input;
}

export function mapDbLowPriorityItemToSesModel(
  items: EmailStatusHistoryItem[],
): SendBulkEmailCommandInput {
  // Use the first item to derive shared defaults (from, template name)
  const firstContent = items[0].content;

  // TODO: in case of thrown error, check if the error needs to make message item retryable or if it's a hard failure that should be discarded

  if (!firstContent.template) {
    throw new Error(
      'SendBulkEmail only supports template-based content. Body content is not allowed.',
    );
  }

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
        ToAddresses: [content.to.email],
      },
      ReplacementEmailContent: {
        ReplacementTemplate: {
          ReplacementTemplateData: content.template.matchedAttributes ?? '{}',
        },
      },
      ReplacementHeaders: headers,
    };
  });

  // TODO: replyTo - tag

  const input: SendBulkEmailCommandInput = {
    FromEmailAddress: firstContent.from.name
      ? `${firstContent.from.name} <${firstContent.from.email}>`
      : firstContent.from.email,
    DefaultContent: {
      Template: {
        TemplateName: firstContent.template.id,
        TemplateData: '{}', // default empty, as we validate template attributes before and we are using ReplacementTemplateData for each entry
      },
    },
    BulkEmailEntries: bulkEntries,
  };

  //TODO - configuration set to be added

  //TODO - tenantName to be added

  return input;
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
