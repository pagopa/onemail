import {
  ConfigSetProcessorMetricName,
  SenderMetricName,
} from '../repositories/metrics.repository.js';

export interface MetricInput {
  name: AllMetricNames;
  value?: number;
  dimensions?: Record<string, string>;
}

export type AllMetricNames = ConfigSetProcessorMetricName | SenderMetricName;

type ConfigSetProcessorMetricName =
  (typeof ConfigSetProcessorMetricName)[keyof typeof ConfigSetProcessorMetricName];

type SenderMetricName =
  (typeof SenderMetricName)[keyof typeof SenderMetricName];
