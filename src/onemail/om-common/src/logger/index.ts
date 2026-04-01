import type {
  LogAttributes,
  UnformattedAttributes,
} from '@aws-lambda-powertools/logger/types';

import { LogFormatter, Logger, LogItem } from '@aws-lambda-powertools/logger';

// Custom formatter shared across all services.
class OneMailLogFormatter extends LogFormatter {
  public formatAttributes(
    attributes: UnformattedAttributes,
    additionalLogAttributes: LogAttributes,
  ): LogItem {
    const customAttributes = {
      level: attributes.logLevel,
      serviceName:
        attributes.lambdaContext?.functionName || attributes.serviceName,
      message: attributes.message,
      timestamp: this.formatTimestamp(attributes.timestamp),
      ...(attributes.lambdaContext
        ? {
            lambdaContext: {
              cold_start: attributes.lambdaContext?.coldStart,
              aws_request_id: attributes.lambdaContext?.awsRequestId,
            },
          }
        : {}),
      sampling_rate: attributes.sampleRateValue,
      xray_trace_id: attributes.xRayTraceId,
    };

    return new LogItem({
      attributes: customAttributes,
    }).addAttributes(additionalLogAttributes);
  }
}

// Base logger — each service creates a child from this with its own serviceName.
export const baseLogger = new Logger({
  logFormatter: new OneMailLogFormatter(),
});
