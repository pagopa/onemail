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
import { SES_SIMULATOR } from 'om-common/utils';

export function mapEmailLowPriorityToDbItem(
  body: EmailLowPriorityBodyDTO,
  requestId: string,
  clientId: string,
  dryRun: boolean,
  suppressedEmails: string[] = [],
): EmailStatusHistoryItem[] {
  const templateId = body.templateId;
  // 1. Initialize dbTemplate and emailHistoryList
  let dbTemplate: TemplateContent | undefined;
  const emailHistoryList: EmailStatusHistoryItem[] = [];
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

    // 3. Determine initial status — suppressed emails never enter the Queued state
    const suppressed = suppressedEmails.includes(element.to.email);
    const initialStatus: EmailStatus = suppressed
      ? EmailStatus.RejectedBySES
      : EmailStatus.Queued;
    const initialHistoryEntry = suppressed
      ? {
          status: EmailStatus.RejectedBySES,
          changedAt: now,
          reason: `Email address ${element.to.email} is in SES suppression list.`,
        }
      : { status: EmailStatus.Queued, changedAt: now };

    // 4. add to emailHistoryList
    emailHistoryList.push({
      emailId: randomUUID(),
      requestId: requestId,
      priority: lowPriority,
      status: initialStatus,
      history: [initialHistoryEntry],
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
  suppressionReason?: string | null,
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
  // suppressionReason is defined when the recipient is in SES suppression list;
  // in that case the email never enters the Queued state.
  const suppressed = suppressionReason != null;
  const initialStatus: EmailStatus = suppressed
    ? EmailStatus.RejectedBySES
    : EmailStatus.Queued;
  const initialHistoryEntry = suppressed
    ? {
        status: EmailStatus.RejectedBySES,
        changedAt: now,
        reason: `Email address ${body.to.email} is in SES suppression list. Reason: ${suppressionReason}`,
      }
    : { status: EmailStatus.Queued, changedAt: now };
  const highPriority: EmailPriority = EmailPriority.HIGH;
  // TODO: add replyTo
  return {
    emailId: randomUUID(),
    requestId: requestId,
    priority: highPriority,
    status: initialStatus,
    history: [initialHistoryEntry],
    content: content,
    tag: body.tag,
    clientId: clientId,
    dryRun: dryRun,
  };
}
