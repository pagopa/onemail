import { sesClient } from '#connector/ses.connector';
import { mapDbHighPriorityItemToSesModel } from '#utils/dbMapper';
import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { EmailStatusHistoryItem } from 'om-common/types';

export const sendHighPriorityEmail = async (
  input: EmailStatusHistoryItem,
): Promise<string | undefined> => {
  //1. from dynamodb to ses model
  const sesInput = mapDbHighPriorityItemToSesModel(input);
  //2. send email with ses connector
  const command = new SendEmailCommand(sesInput);
  const { MessageId } = await sesClient.send(command);

  return MessageId;
};

//TODO - to be implemented

// export const sendLowPriorityEmail = async (input) => {
//   const command = new SendBulkEmailCommand(input);
// };

// { // SendBulkEmailResponse
//   BulkEmailEntryResults: [ // BulkEmailEntryResultList // required
//     { // BulkEmailEntryResult
//       Status: "SUCCESS" || "MESSAGE_REJECTED" || "MAIL_FROM_DOMAIN_NOT_VERIFIED" || "CONFIGURATION_SET_NOT_FOUND" || "TEMPLATE_NOT_FOUND" || "ACCOUNT_SUSPENDED" || "ACCOUNT_THROTTLED" || "ACCOUNT_DAILY_QUOTA_EXCEEDED" || "INVALID_SENDING_POOL_NAME" || "ACCOUNT_SENDING_PAUSED" || "CONFIGURATION_SET_SENDING_PAUSED" || "INVALID_PARAMETER" || "TRANSIENT_FAILURE" || "FAILED",
//       Error: "STRING_VALUE",
//       MessageId: "STRING_VALUE",
//     },
//   ],
// };
//todo sendHighPriorityEmail
