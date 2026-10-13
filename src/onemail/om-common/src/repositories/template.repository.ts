import type { TemplateItem } from '../types/template.type.js';

export interface TemplateRepository {
  getByTemplateName(templateName: string): Promise<TemplateItem | undefined>;
}
