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
      ToAddresses: item.dryRun
        ? [SES_SIMULATOR.SUCCESS]
        : content.to.name
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

    const toAddress = item.dryRun
      ? SES_SIMULATOR.SUCCESS
      : content.to.name
        ? `${content.to.name} <${content.to.email}>`
        : content.to.email;

    const headers = content.extendedHeaders?.map((h) => ({
      Name: h.N,
      Value: h.V,
    }));

    return {
      Destination: {
        ToAddresses: [toAddress],
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
    FromEmailAddress: firstContent.from.name
      ? `${firstContent.from.name} <${firstContent.from.email}>`
      : firstContent.from.email,
    DefaultContent: {
      Template: {
        TemplateName: firstContent.template.id,
      },
    },
    BulkEmailEntries: bulkEntries,
  };

  //TODO - configuration set to be added

  //TODO - tenantName to be added

  return input;
}
