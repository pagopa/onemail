import type { TemplateItem } from '#types/template.type';

import env from '#config/env';
import { templateDynamoClient } from '#connectors/dynamo.connector';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

export const templateRepository = {
  async getByTemplateName(
    templateName: string,
  ): Promise<TemplateItem | undefined> {
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
