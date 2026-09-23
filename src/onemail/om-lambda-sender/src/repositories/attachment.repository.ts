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
    throw new Error(`Attachment body is empty for key ${key}`);
  }

  const bytes = await response.Body.transformToByteArray();
  if (bytes.length === 0) {
    throw new Error(`Attachment content is empty for key ${key}`);
  }
  return bytes;
};
