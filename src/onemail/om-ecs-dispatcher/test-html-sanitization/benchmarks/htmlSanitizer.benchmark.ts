import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import { sanitizeEmailHtml } from '../../src/utils/htmlSanitizer.js';

type BenchmarkResult = {
  totalMs: number;
  nsPerOp: number;
  opsPerSec: number;
};

type Scenario = {
  name: string;
  html: string;
};

type ScenarioSummary = {
  name: string;
  medianTotalMs: number;
  p95TotalMs: number;
  medianNsPerOp: number;
  medianOpsPerSec: number;
};

type BenchmarkReport = {
  metadata: {
    timestamp: string;
    nodeVersion: string;
    runs: number;
    iterations: number;
    warmupIterations: number;
  };
  scenarios: ScenarioSummary[];
};

const benchmarkDir = dirname(fileURLToPath(import.meta.url));
const benchAssetsDir = resolve(benchmarkDir, '.bench');

const readHtmlFixture = (fixturePath: string): string => {
  const absolutePath = resolve(fixturePath);
  return readFileSync(absolutePath, 'utf8');
};

const scenarios: Scenario[] = [
  {
    name: 'real-template',
    html: readHtmlFixture(resolve(benchAssetsDir, 'input.html')),
  },
];
const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const buildTimestampForFilename = (): string =>
  new Date().toISOString().replace(/[:.]/g, '-');

const formatMs = (value: number): string => `${value.toFixed(3)} ms`;

const percentile = (values: number[], p: number): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[index];
};

const benchScenario = (
  scenario: Scenario,
  iterations: number,
  warmupIterations: number,
): BenchmarkResult => {
  for (let i = 0; i < warmupIterations; i += 1) {
    sanitizeEmailHtml(scenario.html);
  }

  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    sanitizeEmailHtml(scenario.html);
  }
  const end = performance.now();

  const totalMs = end - start;
  const nsPerOp = (totalMs * 1_000_000) / iterations;
  const opsPerSec = (iterations * 1000) / totalMs;

  return { totalMs, nsPerOp, opsPerSec };
};

const summarizeScenario = (
  scenario: Scenario,
  iterations: number,
  warmupIterations: number,
  runs: number,
): ScenarioSummary => {
  const totals: number[] = [];
  const nsPerOps: number[] = [];
  const opsPerSecs: number[] = [];

  for (let i = 0; i < runs; i += 1) {
    const result = benchScenario(scenario, iterations, warmupIterations);
    totals.push(result.totalMs);
    nsPerOps.push(result.nsPerOp);
    opsPerSecs.push(result.opsPerSec);
  }

  return {
    name: scenario.name,
    medianTotalMs: percentile(totals, 50),
    p95TotalMs: percentile(totals, 95),
    medianNsPerOp: percentile(nsPerOps, 50),
    medianOpsPerSec: percentile(opsPerSecs, 50),
  };
};

const writeJsonReport = (outputPath: string, report: BenchmarkReport): void => {
  const resolvedOutputPath = resolve(outputPath);
  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`JSON report written to: ${resolvedOutputPath}`);
  console.log('');
};

const run = (): void => {
  const iterations = parsePositiveInt(process.env.BENCH_ITERATIONS, 10_000);
  const warmupIterations = parsePositiveInt(process.env.BENCH_WARMUP, 1_500);
  const runs = parsePositiveInt(process.env.BENCH_RUNS, 10);

  const outputJsonPath = resolve(
    benchAssetsDir,
    `html-sanitizer-${buildTimestampForFilename()}-p${process.pid}.json`,
  );

  console.log('HTML sanitizer benchmark');
  console.log(`- runs: ${runs}`);
  console.log(`- iterations per run: ${iterations}`);
  console.log(`- warmup iterations: ${warmupIterations}`);
  console.log(`- output json: ${resolve(outputJsonPath)}`);
  console.log('');

  const scenarioSummaries: ScenarioSummary[] = [];
  for (const scenario of scenarios) {
    const summary = summarizeScenario(
      scenario,
      iterations,
      warmupIterations,
      runs,
    );
    scenarioSummaries.push(summary);

    console.log(`scenario: ${scenario.name}`);
    console.log(`  median total: ${formatMs(summary.medianTotalMs)}`);
    console.log(`  p95 total: ${formatMs(summary.p95TotalMs)}`);
    console.log(`  median ns/op: ${summary.medianNsPerOp.toFixed(0)}`);
    console.log(`  median ops/s: ${summary.medianOpsPerSec.toFixed(0)}`);
    console.log('');
  }

  const report: BenchmarkReport = {
    metadata: {
      timestamp: new Date().toISOString(),
      nodeVersion: process.version,
      runs,
      iterations,
      warmupIterations,
    },
    scenarios: scenarioSummaries,
  };

  writeJsonReport(outputJsonPath, report);
};

run();
