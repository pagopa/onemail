import { EmailHighPriorityBodyDTO } from '#dtos/email/emailHighPriority.dto';
import {
  DbEmailContent,
  EmailContent,
  EmailPriority,
  EmailStatus,
  EmailStatusHistoryItem,
  TemplateContent,
} from '#types/EmailStatusHistory';

export function mapEmailTransactionalToDbItem(
  body: EmailHighPriorityBodyDTO,
  emailId: string,
  requestId: string,
  clientId: string,
): EmailStatusHistoryItem {
  const now = new Date().toISOString();

  // 1. Mutually exclusive mapping of Template and Body
  let dbTemplate: TemplateContent | undefined;
  let dbBody: EmailContent | undefined;

  if (body.templateContent) {
    dbTemplate = {
      id: body.templateContent.templateId,
      // stringified JSON of the original object
      matchedAttributes: body.templateContent.templateAttributes
        ? JSON.stringify(body.templateContent.templateAttributes)
        : undefined,
    };
  } else if (body.emailContent) {
    dbBody = {
      html: body.emailContent.html,
      text: body.emailContent.text,
    };
  }

  // 2. Content builder
  const content: DbEmailContent = {
    subject: body.subject,
    from: body.from,
    to: body.to,
    extendedHeaders: body.extendedHeaders,
    template: dbTemplate,
    body: dbBody,
  };

  // 3. Building the final DB item
  const initialStatus: EmailStatus = 'Queued';
  const highPriority: EmailPriority = 'HIGH';
  return {
    emailId: emailId,
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
  };
}
