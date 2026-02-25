import env from '#config/env';
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

// global registry to collect dtos and routes
export const registry = new OpenAPIRegistry();

// function that generate openapi docs
export const generateSwaggerDocs = () => {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'OneMail Dispatcher API',
      version: `${env.projectVersion}`,
      description:
        'Service that manages the orchestration and dispatching of high-volume email queues.',
      contact: {
        email: 'team-one-mail@pagopa.it',
      },
      license: {
        name: 'Apache 2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0.html',
      },
    },
    servers: [
      {
        url: env.server.host,
      },
    ],
  });
};
