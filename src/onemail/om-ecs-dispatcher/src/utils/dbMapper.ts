import { EmailHighPriorityBodyDTO } from '#dtos/email/emailHighPriority.dto';
import { EmailLowPriorityBodyDTO } from '#dtos/email/emailLowPriority.dto';
import { randomUUID } from 'node:crypto';
import {
  DbEmailContent,
  EmailContent,
  EmailPriority,
  EmailStatus,
  EmailStatusHistoryItem,
  TemplateContent,
} from 'om-common/types';

import { SES_SIMULATOR } from './constants.js';

export function mapEmailLowPriorityToDbItem(
  body: EmailLowPriorityBodyDTO,
  requestId: string,
  clientId: string,
  dryRun: boolean,
): EmailStatusHistoryItem[] {
  const templateId = body.templateId;
  // 1. Initialize dbTemplate and emailHistoryList
  let dbTemplate: TemplateContent | undefined;
  const emailHistoryList: EmailStatusHistoryItem[] = [];
  const initialStatus: EmailStatus = EmailStatus.Queued;
  const lowPriority: EmailPriority = EmailPriority.LOW;
  const now = new Date().toISOString();

  body.sendingInfo.forEach((element) => {
    dbTemplate = {
      id: templateId,
      // stringified JSON of the original object
      matchedAttributes: element.templateAttributes
        ? JSON.stringify(element.templateAttributes)
        : undefined,
    };
    // 2. Content builder
    const content: DbEmailContent = {
      from: body.from,
      to: dryRun ? { email: SES_SIMULATOR.SUCCESS } : element.to,
      extendedHeaders: element.extendedHeaders,
      template: dbTemplate,
    };

    // 3. add to emailHistoryList
    emailHistoryList.push({
      emailId: randomUUID(),
      requestId: requestId,
      priority: lowPriority,
      status: initialStatus,
      history: [
        {
          status: initialStatus,
          changedAt: now,
        },
      ],
      content: content,
      tag: body.tag,
      clientId: clientId,
      dryRun: dryRun,
    });
  });

  return emailHistoryList;
}

export function mapEmailTransactionalToDbItem(
  body: EmailHighPriorityBodyDTO,
  requestId: string,
  clientId: string,
  dryRun: boolean,
): EmailStatusHistoryItem {
  const now = new Date().toISOString();

  // 1. Mutually exclusive mapping of Template and Body
  let dbTemplate: TemplateContent | undefined;
  let dbBody: EmailContent | undefined;
  let dbEmailSubject: string | undefined;

  if ('templateContent' in body) {
    dbTemplate = {
      id: body.templateContent.templateId,
      // stringified JSON of the original object
      matchedAttributes: body.templateContent.templateAttributes
        ? JSON.stringify(body.templateContent.templateAttributes)
        : undefined,
    };
  } else {
    dbBody = {
      html: body.emailContent.html,
      text: body.emailContent.text,
    };
    dbEmailSubject = body.emailContent.subject;
  }

  // 2. Content builder
  const content: DbEmailContent = {
    subject: dbEmailSubject,
    from: body.from,
    to: dryRun ? { email: SES_SIMULATOR.SUCCESS } : body.to,
    extendedHeaders: body.extendedHeaders,
    template: dbTemplate,
    body: dbBody,
  };

  // 3. Building the final DB item
  const initialStatus: EmailStatus = EmailStatus.Queued;
  const highPriority: EmailPriority = EmailPriority.HIGH;
  // TODO: add replyTo
  return {
    emailId: randomUUID(),
    requestId: requestId,
    priority: highPriority,
    status: initialStatus,
    history: [
      {
        status: initialStatus,
        changedAt: now,
      },
    ],
    content: content,
    tag: body.tag,
    clientId: clientId,
    dryRun: dryRun,
  };
}
