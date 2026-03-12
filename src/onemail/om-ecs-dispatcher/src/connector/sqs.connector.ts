import env from '#config/env';
import { SQSClient } from '@aws-sdk/client-sqs';

const sqsClient = new SQSClient({
  region: env.aws.region,
});

export { sqsClient };
