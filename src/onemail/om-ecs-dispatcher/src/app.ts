import '#config/zodExtend';
import { getLogger } from '#config/logger';
import { errorHandler } from '#middlewares/errorHandler.middleware';
import express from 'express';

import env from './config/env.js';
import routes from './routes/index.js';

const app = express();
const PORT = env.server.PORT;
const logger = getLogger();

// api response type middlewares
app.use(express.json());

// api routes
app.use('/', routes);

// global error middleware
app.use(errorHandler);

app.listen(PORT, () => {
  logger.debug(`Server running on port ${PORT}...`);
});

// Check for graceful shutdown
process.on('SIGINT', () => {
  // Here you can eventually perform other cleanup tasks before exiting
  process.exit(0); // Exit gracefully
});
