import { Router } from '@aws-lambda-powertools/event-handler/http';
import { Context } from 'aws-lambda';

const app: Router = new Router();

app.get('/', async () => ({ message: 'Hello World!' }));

export const handler = async (event: unknown, context: Context) =>
  app.resolve(event, context);
