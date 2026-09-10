import env from '#config/env';
import { APP_ENV_VALUES } from '#utils/constants';
import { S3Client } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: env.aws.region,
  ...(env.server.environment === APP_ENV_VALUES.local && {
    endpoint: env.aws.localS3.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.aws.localS3.accessKeyId,
      secretAccessKey: env.aws.localS3.secretAccessKey,
    },
  }),
});

export { s3Client };
