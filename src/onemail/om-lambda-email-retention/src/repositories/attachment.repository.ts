import env from '#config/env';
import { s3Client } from '#connectors/s3.connector';
import { S3_DELETE_OBJECTS_MAX_KEYS } from '#utils/constants';
import { DeleteObjectsCommand } from '@aws-sdk/client-s3';

/**
 * Deletes the given attachment keys. Deleting a missing key is not an error for S3,
 * so retries are idempotent; per-key failures are raised to let the record be retried.
 */
export const deleteAttachments = async (keys: string[]): Promise<void> => {
  for (
    let index = 0;
    index < keys.length;
    index += S3_DELETE_OBJECTS_MAX_KEYS
  ) {
    const chunk = keys.slice(index, index + S3_DELETE_OBJECTS_MAX_KEYS);
    const response = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: env.aws.attachmentsBucket,
        Delete: {
          Objects: chunk.map((key) => ({ Key: key })),
          Quiet: true,
        },
      }),
    );

    const errors = response.Errors ?? [];
    if (errors.length > 0) {
      const codes = [...new Set(errors.map((error) => error.Code))].join(', ');
      throw new Error(
        `Failed to delete ${errors.length} attachment(s): ${codes}`,
      );
    }
  }
};
