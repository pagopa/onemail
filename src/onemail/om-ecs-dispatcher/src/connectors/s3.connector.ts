import env from '#config/env';
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: env.aws.region,
});

export { s3Client };
