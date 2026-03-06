import { SESv2Client } from '@aws-sdk/client-sesv2'; // ES Modules import

const config = {}; // type is SESv2ClientConfig
export const sesClient = new SESv2Client(config);
//TODO - check if region should be set
