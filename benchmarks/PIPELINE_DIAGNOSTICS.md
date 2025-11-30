# Pipeline Diagnostics Harness

This harness lets you run the real pipeline with frozen step snapshots, replay steps in isolation, and compare outputs to baselines. Outputs are written to `benchmarks/output`.

## CLI flags

- `--freeze` — Save per-step snapshots (JSON) to `benchmarks/fixtures/pipeline_frozen`.
- `--replay=<stepId>` — Load a snapshot for a step and skip all prior steps.
- `--replay-from=<stepId>` — Load a snapshot for a step, then run remaining steps.
- `--out=<dir>` — Directory for snapshots (defaults to `benchmarks/fixtures/pipeline_frozen`).
- `--focus=<step1,step2>` — Only emit detailed logs for these steps.
- `--commit-count=<n>` — Number of recent commits to analyze (default 6).
- `--no-workspace` — Skip workspace overlay.
- `--reset-db` — Delete the existing commit-tracker DB before running.

## Typical flows

1) Freeze a baseline (TypeScript entrypoint):
```bash
npx ts-node benchmarks/pipeline_diagnostics.ts --freeze --commit-count=6
```
Per-step snapshots land in `benchmarks/fixtures/pipeline_frozen`.

2) Replay from a step and run downstream only:
```bash
npx ts-node benchmarks/pipeline_diagnostics.ts --replay-from=intended --focus=bundle_facts
```
This loads the `intended` snapshot, skips earlier steps, and emits focused logs.

3) Spot-check drift/legacy after a change:
```bash
npx ts-node benchmarks/pipeline_diagnostics.ts --replay-from=working --focus=drift,legacy
```

## Outputs

- `benchmarks/output/pipeline_diagnostics.json` — Structured run summary (hashes, notes, errors).
- Console logs — Per-step hash, baseline comparison, and a short metric summary.

## Notes

- Snapshots live in `benchmarks/fixtures/pipeline_frozen` by default; change with `--out`.
- Baseline comparison: hashes are checked against existing snapshots; diffs are highlighted in the console.
- Use `--reset-db` if you need a clean DB before freezing/replaying.
