import { z } from 'zod';

export const stringCheckedSchema = ({
  min,
  max,
}: {
  min?: number;
  max?: number;
} = {}) => {
  const minLength = min || 1;
  const maxLength = max || 255;
  return z
    .string()
    .trim()
    .min(minLength, { message: `Minimum length is ${minLength} characters` })
    .max(maxLength, { message: `Field can't exceed ${maxLength} characters` });
};

// Handles sender and recipients [cite: 828, 866]
export const EmailAddressSchema = z.object({
  name: stringCheckedSchema().optional(),
  email: z.email(),
});

export type EmailAddressDTO = z.infer<typeof EmailAddressSchema>;

// Used for custom headers
export const NameValueSchema = z.object({
  N: stringCheckedSchema(),
  V: stringCheckedSchema(),
});

export type NameValueDTO = z.infer<typeof NameValueSchema>;

// Free HTML or text content
export const EmailContentSchema = z
  .object({
    html: stringCheckedSchema({ max: 200000 }).optional(), // TODO: consider stricter validation for HTML content, e.g., sanitization or specific tags allowed
    text: stringCheckedSchema({ max: 200000 }).optional(),
  })
  .refine((data) => data.html || data.text, {
    message: 'Either html or text is required',
  });

export type EmailContentDTO = z.infer<typeof EmailContentSchema>;

// Custom headers
export const ExtendedHeadersSchema = z.array(NameValueSchema);

// Tags for categorization and filtering
export const TagSchema = z.array(stringCheckedSchema());

// Dynamic attributes for template rendering
export const TemplateAttributesSchema = z.record(
  stringCheckedSchema(),
  z.any(),
);

// Reference to template and dynamic attributes
export const TemplateContentSchema = z.object({
  templateId: stringCheckedSchema(),
  templateAttributes: TemplateAttributesSchema.optional(),
});

// Dry Run Query Parameters
export const DryRunQueryParamsSchema = z.object({
  dryRun: z.stringbool().default(false), // TODO: ignored in production
});

export const EmailSuccessResponseSchema = z.object({
  requestId: z.string(),
});
