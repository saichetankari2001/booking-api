# Booking API — CI Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions CI pipeline with three required jobs — `lint`, `test`, `build` — that must all pass before merge, per spec Section 5.

**Architecture:** A single workflow file, `.github/workflows/ci.yml`, triggered on push/PR to `main`. `test` and `build` each spin up their own ephemeral Postgres 16 service container (no shared state between jobs). `build` also builds and boots the production Docker image and polls `/health` until it reports DB connectivity.

**Tech Stack:** GitHub Actions, `actions/checkout`, `actions/setup-node`, `docker/setup-buildx-action`, Postgres 16 service containers.

**Depends on:** `docs/superpowers/plans/2026-07-22-booking-api-core.md` having been implemented — this plan assumes `package.json` scripts (`lint`, `format`, `test:unit`, `test:integration`, `build`), `prisma/schema.prisma`, and `Dockerfile` already exist exactly as that plan produces them.

## Global Constraints

- Three jobs, all required before merge: `lint` (ESLint + Prettier check), `test` (Postgres service container, migrations, unit + integration tests, coverage artifact upload), `build` (compiles TypeScript, builds Docker image, confirms it starts healthy).
- No job may modify repo state or push anything — this is CI only, not deploy (deploy is a separate plan, gated to `main`, out of scope here).
- Every `run:` step must be a command that also works identically when run locally (no CI-only magic) — each task's steps include the local-equivalent command to run and verify before committing.

---

## Task 1: Lint Job

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `ci.yml` with a `lint` job. Tasks 2 and 3 append sibling jobs to this same file.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run format
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "valid yaml"`
Expected: `valid yaml` printed, no exception.

- [ ] **Step 3: Run the equivalent commands locally to confirm the job would pass**

Run: `npm run lint && npm run format`
Expected: both exit 0 (no lint errors, no unformatted files). If `npm run format` fails, run `npx prettier --write .` first, then re-run.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint job"
```

---

## Task 2: Test Job

**Files:**
- Modify: `.github/workflows/ci.yml` (add `test` job)

**Interfaces:**
- Consumes: `npm run test:unit`, `npm run test:integration`, `npx prisma migrate deploy` (from the core API plan).
- Produces: `test` job, uploads `coverage/` as a build artifact named `coverage-report`.

- [ ] **Step 1: Modify `.github/workflows/ci.yml`** — add this job after `lint`:

```yaml
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: booking_api_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/booking_api_test
      JWT_SECRET: ci-test-secret
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
      - run: npm run test:unit -- --coverage
      - run: npm run test:integration
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "valid yaml"`
Expected: `valid yaml` printed.

- [ ] **Step 3: Run the equivalent commands locally** (against the `docker-compose.test.yml` Postgres from the core plan)

Run: `docker compose -f docker-compose.test.yml up -d && DATABASE_URL=postgresql://postgres:postgres@localhost:5433/booking_api_test JWT_SECRET=ci-test-secret NODE_ENV=test npx prisma migrate deploy && npm run test:unit -- --coverage && npm run test:integration`
Expected: migrations apply, unit tests pass with coverage report generated in `coverage/`, integration tests pass.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add test job with postgres service container and coverage upload"
```

---

## Task 3: Build Job

**Files:**
- Modify: `.github/workflows/ci.yml` (add `build` job)

**Interfaces:**
- Consumes: `npm run build`, `Dockerfile` (from the core API plan).
- Produces: `build` job, `needs: [lint, test]`, builds the Docker image and verifies `/health` returns `{"status":"ok","db":"ok"}`.

- [ ] **Step 1: Modify `.github/workflows/ci.yml`** — add this job after `test`:

```yaml
  build:
    runs-on: ubuntu-latest
    needs: [lint, test]
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: booking_api_build
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npx prisma generate
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/booking_api_build
      - uses: docker/setup-buildx-action@v3
      - run: docker build -t booking-api:ci -f Dockerfile --load .
      - name: Start container and verify /health
        run: |
          docker run -d --name booking-api-ci --network host \
            -e DATABASE_URL=postgresql://postgres:postgres@localhost:5432/booking_api_build \
            -e JWT_SECRET=ci-build-check-secret \
            -e PORT=3000 \
            booking-api:ci
          for i in $(seq 1 10); do
            if curl -sf http://localhost:3000/health | grep -q '"db":"ok"'; then
              echo "Container healthy"
              docker rm -f booking-api-ci
              exit 0
            fi
            sleep 2
          done
          echo "Container did not become healthy"
          docker logs booking-api-ci
          docker rm -f booking-api-ci
          exit 1
```

- [ ] **Step 2: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo "valid yaml"`
Expected: `valid yaml` printed.

- [ ] **Step 3: Run the equivalent steps locally**

Run:
```bash
npm run build
docker build -t booking-api:ci -f Dockerfile .
docker compose up -d postgres
docker run -d --name booking-api-ci -p 3000:3000 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/booking_api \
  -e JWT_SECRET=local-build-check-secret \
  -e PORT=3000 \
  booking-api:ci
sleep 3
curl -s http://localhost:3000/health
docker rm -f booking-api-ci
```
Expected: `curl` output is `{"status":"ok","db":"ok"}`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add build job that boots the docker image and checks /health"
```

---

## Task 4: Verify Full Pipeline on a Real PR

**Files:** none — verification only.

- [ ] **Step 1: Push the branch and open a PR (or push directly if working on `main` per repo convention) so GitHub Actions runs the workflow**

Run: `git push -u origin HEAD`
Expected: push succeeds.

- [ ] **Step 2: Confirm all three jobs pass in the Actions tab**

Run: `gh run watch` (or check the Actions tab in the GitHub UI)
Expected: `lint`, `test`, and `build` all show green/success.
