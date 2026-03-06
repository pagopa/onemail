import {
  Body,
  EmailContent,
  SendEmailCommandInput,
} from '@aws-sdk/client-sesv2';
import { EmailStatusHistoryItem } from 'om-common/types';

import { SES_SIMULATOR } from './constants.js';

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

//TODO - to be implemented
//export function mapSesResponseToDbItem();
