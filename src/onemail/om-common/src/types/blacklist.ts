export enum BlacklistSource {
  Event = 'event',
  Sync = 'sync',
}

export interface BlacklistItem {
  emailAddress: string; // PK, trimmed and lowercased
  reason?: string;
  bounceSubType?: string;
  source: BlacklistSource;
  tenantName?: string;
  createdAt: string;
  updatedAt: string;
}
