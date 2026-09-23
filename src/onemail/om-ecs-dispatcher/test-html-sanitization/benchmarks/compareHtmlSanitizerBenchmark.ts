import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

const formatDeltaPct = (value: number): string =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

const percentageDelta = (baseline: number, current: number): number => {
  if (baseline === 0) {
    return current === 0 ? 0 : Number.POSITIVE_INFINITY;
  }

  return ((current - baseline) / baseline) * 100;
};

const isFiniteNumber = (value: number): boolean => Number.isFinite(value);

const formatMetricDelta = (baseline: number, current: number): string => {
  const delta = percentageDelta(baseline, current);
  if (!isFiniteNumber(delta)) {
    return 'N/A';
  }
  return formatDeltaPct(delta);
};

const readReport = (path: string): BenchmarkReport => {
  const resolvedPath = resolve(path);
  const content = readFileSync(resolvedPath, 'utf8');
  const parsed = JSON.parse(content) as BenchmarkReport;

  if (!parsed.metadata || !Array.isArray(parsed.scenarios)) {
    throw new Error(`Invalid benchmark report: ${resolvedPath}`);
  }

  return parsed;
};

const run = (): void => {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const [baselineArg, currentArg] = args;

  if (!baselineArg || !currentArg) {
    console.error(
      'Usage: pnpm run bench:html-sanitizer:compare -- <baseline.json> <current.json>',
    );
    process.exit(1);
  }

  const baseline = readReport(baselineArg);
  const current = readReport(currentArg);

  const sameIterations =
    baseline.metadata.iterations === current.metadata.iterations;
  const sameWarmup =
    baseline.metadata.warmupIterations === current.metadata.warmupIterations;
  const sameRuns = baseline.metadata.runs === current.metadata.runs;
  const comparableTotals = sameIterations && sameWarmup && sameRuns;

  const baselineByName = new Map(
    baseline.scenarios.map((scenario) => [scenario.name, scenario]),
  );

  console.log('Benchmark comparison');
  console.log(`- baseline: ${resolve(baselineArg)}`);
  console.log(`- current: ${resolve(currentArg)}`);
  console.log('');

  if (!comparableTotals) {
    console.log(
      'Benchmark settings differ between reports: total-time deltas are skipped; compare ns/op and ops/s.',
    );
    console.log('');
  }

  for (const scenario of current.scenarios) {
    const baseScenario = baselineByName.get(scenario.name);
    if (!baseScenario) {
      console.log(`scenario: ${scenario.name}`);
      console.log('  baseline: not found');
      console.log('');
      continue;
    }

    console.log(`scenario: ${scenario.name}`);
    if (comparableTotals) {
      console.log(
        `  median total delta: ${formatMetricDelta(
          baseScenario.medianTotalMs,
          scenario.medianTotalMs,
        )}`,
      );
      console.log(
        `  p95 total delta: ${formatMetricDelta(
          baseScenario.p95TotalMs,
          scenario.p95TotalMs,
        )}`,
      );
    }
    console.log(
      `  median ns/op delta: ${formatMetricDelta(
        baseScenario.medianNsPerOp,
        scenario.medianNsPerOp,
      )}`,
    );
    console.log(
      `  median ops/s delta: ${formatMetricDelta(
        baseScenario.medianOpsPerSec,
        scenario.medianOpsPerSec,
      )}`,
    );
    console.log('');
  }
};

run();
