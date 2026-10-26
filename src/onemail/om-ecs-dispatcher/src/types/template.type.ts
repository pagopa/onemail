export type TemplateItem = {
  TemplateName: string;
  tenantName: string;
  lastModifiedDate: string;
  status: 'ACTIVE' | 'RETIRED';
  retiredAt?: string;
};
