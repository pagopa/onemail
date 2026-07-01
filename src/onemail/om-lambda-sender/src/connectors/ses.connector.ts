import '@aws-sdk/signature-v4a';
import { SESv2Client } from '@aws-sdk/client-sesv2';

// Register the SigV4a signer required when SES multi-region EndpointId is used.
export const sesClient = new SESv2Client({});
