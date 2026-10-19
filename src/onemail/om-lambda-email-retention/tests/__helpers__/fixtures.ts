import type { EmailStreamImage } from '#dtos/emailStreamImage.dto';
import type { DynamoDBRecord } from 'aws-lambda';

import { EmailPriority, EmailStatus } from 'om-common/types';

type StreamImageInput = {
  emailId?: string;
  requestId?: string;
  priority?: EmailPriority;
  status?: EmailStatus;
  attachmentKeys?: string[];
};

export const makeStreamImage = ({
  emailId = 'email-1',
  requestId = 'request-1',
  priority = EmailPriority.HIGH,
  status = EmailStatus.Delivered,
  attachmentKeys = ['tenant/attachment-1/file.pdf'],
}: StreamImageInput = {}): EmailStreamImage => ({
  emailId: { S: emailId },
  requestId: { S: requestId },
  priority: { S: priority },
  status: { S: status },
  content: {
    M: {
      attachments: {
        L: attachmentKeys.map((key) => ({
          M: {
            s3Key: { S: key },
          },
        })),
      },
    },
  },
});

export const makeStreamRecord = (
  sequenceNumber: string,
  imageInput: StreamImageInput = {},
  eventName: DynamoDBRecord['eventName'] = 'MODIFY',
): DynamoDBRecord =>
  ({
    eventID: `event-${sequenceNumber}`,
    eventName,
    eventSource: 'aws:dynamodb',
    dynamodb: {
      SequenceNumber: sequenceNumber,
      NewImage: makeStreamImage(imageInput),
    },
  }) as DynamoDBRecord;
