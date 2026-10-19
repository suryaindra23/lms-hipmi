# Performance baseline

Run only against an isolated test environment. Production targets are prohibited. Install `k6`, then set `BASE_URL`, `TEST_EMAIL`, and `TEST_PASSWORD` before running `k6 run load/k6/smoke.js`.

- `smoke.js`: authenticated dashboard read baseline; default 10 virtual users for 30 seconds, p95 target under 1.5 seconds, errors under 1%.
- `concurrent-submission.js`: optimistic-lock and simultaneous draft test; requires `ALLOW_MUTATION_LOAD=yes`, an access token, and a valid synthetic payload.
- `50k-student-import.js`: five isolated 10,000-row import batches; requires `ALLOW_50K_LOAD=yes` and must never use real student information.
- `sql/seed-50k-students.sql`: fast read-baseline fixture for an isolated database whose name contains `load`, `perf`, or `test`; it refuses other database names.

Record environment size, commit, row count, p50/p95/p99, error rate, database CPU/connections, queue backlog, and worker completion time in `docs/load-test-report.md`.
