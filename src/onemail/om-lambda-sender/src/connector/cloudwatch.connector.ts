import env from '#config/env';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';

export const cloudWatchClient = new CloudWatchClient({
  region: env.aws.region,
});
