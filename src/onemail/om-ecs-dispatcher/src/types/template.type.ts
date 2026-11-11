export type TemplateItem = {
  templateName: string;
  tenantName: string;
  lastModifiedDate: string;
  status: 'ACTIVE' | 'RETIRED';
  retiredAt?: string;
};
