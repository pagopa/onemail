import env from '#config/env';
import { s3Client } from '#connectors/s3.connector';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

export const putAttachment = async ({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Uint8Array;
  contentType: string;
}): Promise<void> => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.aws.attachmentsBucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
};

export const deleteAttachment = async (key: string): Promise<void> => {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.aws.attachmentsBucket,
      Key: key,
    }),
  );
};
