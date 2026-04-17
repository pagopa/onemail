import '#config/zodExtend';
import { getLogger } from '#config/logger';
import { errorHandler } from '#middlewares/errorHandler.middleware';
import { metricsFlush } from '#middlewares/metrics.middleware';
import express from 'express';
import { forceFlushMetrics } from 'om-common/repositories';

import env from './config/env.js';
import routes from './routes/index.js';

const app = express();
const PORT = env.server.PORT;
const logger = getLogger();

// api response type middlewares
app.use(express.json());

// flush collected metrics when the response is sent
app.use(metricsFlush);

// api routes
app.use('/', routes);

// global error middleware
app.use(errorHandler);

app.listen(PORT, () => {
  logger.debug(`Server running on port ${PORT}...`);
});

const gracefulShutdown = () => {
  try {
    forceFlushMetrics();
  } catch (error) {
    logger.error('Error flushing metrics during shutdown:', { error });
  }
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);

process.on('SIGINT', gracefulShutdown);
