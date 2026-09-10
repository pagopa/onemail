import { s3Client } from '#connectors/s3.connector';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export const getAttachment = async (
  bucket: string,
  key: string,
): Promise<Uint8Array> => {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );

  if (!response.Body) {
    throw new Error(`S3 attachment has no body: ${key}`);
  }

  const bytes = Buffer.from(await response.Body.transformToByteArray());
  if (!bytes.length) {
    throw new Error(`S3 attachment is empty: ${key}`);
  }

  return bytes;
};
