import type { Context } from 'aws-lambda';

import { Router } from '@aws-lambda-powertools/event-handler/http';

const app: Router = new Router();

app.get('/', async () => ({ message: 'Hello World!' }));

export const handler = async (event: unknown, context: Context) => app.resolve(event, context);
