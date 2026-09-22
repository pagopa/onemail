// Map keyed by the S3 key for easy lookup ( Map{'tenant-a/attachment-id/document.pdf' => Uint8Array(...)} ).
export type AttachmentBytesByKey = Map<string, Uint8Array>;
