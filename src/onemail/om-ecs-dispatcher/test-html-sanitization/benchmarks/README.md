# HTML Sanitizer Benchmark

Benchmark for `sanitizeEmailHtml` (see [`src/utils/htmlSanitizer.ts`](../../src/utils/htmlSanitizer.ts)), used to measure the performance impact of sanitization changes.

## Files

- `htmlSanitizer.benchmark.ts` — runs the benchmark and writes a JSON report to `.bench/`.
- `compareHtmlSanitizerBenchmark.ts` — compares two JSON reports and prints per-scenario percentage deltas.
- `.bench/` — generated reports and HTML fixtures (`input.html`).

## Run the benchmark

Put the HTML to benchmark in `.bench/input.html`.

Run it from the package root:

```bash
pnpm exec tsx -C local test-html-sanitization/benchmarks/htmlSanitizer.benchmark.ts
```

Each run writes a timestamped JSON report to `test-html-sanitization/benchmarks/.bench/`.

### Options (environment variables)

| Variable | Default | Description |
| --- | --- | --- |
| `BENCH_RUNS` | `10` | Number of measured runs per scenario |
| `BENCH_ITERATIONS` | `10000` | Iterations per run |
| `BENCH_WARMUP` | `1500` | Warmup iterations before measuring (not counted) |

Example with custom settings:

```bash
BENCH_RUNS=20 BENCH_ITERATIONS=20000 BENCH_WARMUP=2000 \
  pnpm exec tsx -C local test-html-sanitization/benchmarks/htmlSanitizer.benchmark.ts
```

## Compare two reports (baseline vs current)

```bash
pnpm exec tsx -C local test-html-sanitization/benchmarks/compareHtmlSanitizerBenchmark.ts -- \
  test-html-sanitization/benchmarks/.bench/<baseline-report>.json \
  test-html-sanitization/benchmarks/.bench/<current-report>.json
```

Prints, per scenario, the percentage delta for `median total`, `p95 total`, `median ns/op` and `median ops/s`. If the two reports used different `runs`/`iterations`/`warmup`, total-time deltas are skipped and only `ns/op`/`ops/s` are compared.

## Typical workflow

1. Run the benchmark on the baseline (e.g. `main`) and note the report path.
2. Apply your changes.
3. Run the benchmark again to get a new report.
4. Compare the two reports with `compareHtmlSanitizerBenchmark.ts`.

For reliable comparisons, keep `BENCH_RUNS`/`BENCH_ITERATIONS`/`BENCH_WARMUP` identical between runs and avoid running other heavy processes at the same time.
