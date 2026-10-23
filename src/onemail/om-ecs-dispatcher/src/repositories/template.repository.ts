import type { TemplateRepository } from 'om-common/repositories';
import type { TemplateItem } from 'om-common/types';

import env from '#config/env';
import { templateDynamoClient } from '#connectors/dynamo.connector';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

export const templateRepository: TemplateRepository = {
  async getByTemplateName(templateName) {
    const result = await templateDynamoClient.send(
      new GetCommand({
        TableName: env.aws.templateRegistry.tableName,
        Key: { TemplateName: templateName },
        ConsistentRead: true,
      }),
    );
    return result.Item as TemplateItem | undefined;
  },
};
