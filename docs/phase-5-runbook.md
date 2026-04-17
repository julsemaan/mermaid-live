# Phase 5 Testing and Operations Runbook

## Test suites

- Unit tests (core queue/manifest/ingestion):

```bash
npm run test:unit
```

- Integration tests (watcher -> render -> API/SSE contract):

```bash
npm run test:integration
```

- E2E viewer contract tests (headless):

```bash
npm run test:e2e
```

- Full local gate:

```bash
npm test
```

## Coverage gate

Coverage checks run against core modules with enforced thresholds:

```bash
npm run test:coverage
```

Current thresholds:

- lines >= 80%
- functions >= 80%
- branches >= 70%
- statements >= 80%

## Performance checks

Generate a baseline report:

```bash
npm run bench:phase5
```

Check baseline and fail on regression thresholds:

```bash
npm run perf:check
```

Outputs are written to:

- `artifacts/performance/phase-5-baseline.json`
- `artifacts/performance/phase-5-baseline.md`

## Runtime observability

### Health endpoint

`GET /api/health`

Returns runtime snapshot:

- uptime
- render success/failure counters
- queue depth
- active SSE client count

### Metrics endpoint

`GET /api/metrics`

Prometheus-style metrics:

- `mermaid_live_renders_total`
- `mermaid_live_render_failures_total`
- `mermaid_live_queue_depth`
- `mermaid_live_sse_clients`
- `mermaid_live_uptime_seconds`

## Diagnosing issues

1. Verify service liveliness and queue pressure:
   - `curl -s http://localhost:18000/api/health | jq`
2. Inspect metrics trend under load:
   - `curl -s http://localhost:18000/api/metrics`
3. Validate real-time stream behavior:
   - `curl -N http://localhost:18000/api/events`
4. Re-run integration tests to catch regressions:
   - `npm run test:integration`

## CI pipeline

CI is split into two jobs (`.github/workflows/ci.yml`):

- `smoke`: lint, typecheck, unit tests, coverage gate
- `full`: integration tests, e2e tests, performance regression check
