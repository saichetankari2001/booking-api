# Booking API — Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full booking-reservation REST API — DB schema, layered backend (routes → controllers → services → repositories → Prisma/Postgres), auth, and both test layers — as specified in `docs/superpowers/specs/2026-07-22-booking-api-design.md`.

**Architecture:** Strict one-directional layering (routes → controllers → services → repositories → Prisma). Repositories are the only code that imports the Prisma client, including for transactions (`runInTransaction`), so services never touch `prisma` directly. Auth is JWT access tokens (15 min) + DB-backed refresh tokens.

**Tech Stack:** Node.js + TypeScript, Express, PostgreSQL via Prisma, Zod, Jest + Supertest, Docker + docker-compose.

## Global Constraints

- Layering is one-directional only: `routes/ → controllers/ → services/ → repositories/ → Prisma`. Controllers contain no business logic; repositories contain no business logic.
- `Booking.id` is a UUID (guest self-service on `GET/DELETE /bookings/:id` is unauthenticated — non-enumerable IDs are load-bearing). All other entity IDs are auto-increment integers.
- All validation via Zod schemas in `src/schemas/`, applied by middleware, returning 422 on failure.
- Errors are typed (`NotFoundError`, `ConflictError`, `UnauthorizedError`, `ValidationError`) and mapped to HTTP codes in one `errorHandler`.
- Unit tests = service layer only, repositories mocked with `jest.fn()`, no DB. Integration tests = full HTTP stack via Supertest against a real Dockerized test Postgres, no mocking. Coverage target: 80% on `src/services/**`.
- Conflict detection is defined exactly as: existing booking on the **same table + same slot + same date** where `status = confirmed` (per spec Section 3's explicit query). This is a simpler rule than generic wall-clock time-range overlap across different slots — the restaurant is assumed to define non-overlapping `TimeSlot` records administratively; the system does not attempt cross-slot interval overlap detection. This plan implements the literal Section 3 rule.
- Refresh tokens: the spec says "stored as a bcrypt hash," but bcrypt is salted/non-deterministic and cannot be looked up by exact match. This plan stores `sha256(jti)` as `token_hash` instead (deterministic, non-reversible, exact-match lookup) — the actual unforgeability of the refresh token still comes from its JWT signature (`JWT_SECRET`), so this is not a security downgrade, just a lookup-compatible hash. Documented here so the deviation from the literal spec wording is intentional, not missed.
- No `Customer` entity, no `pending` booking state, no rate limiting, no notifications, no frontend — do not add any of these.

---

## Task 1: Project Scaffolding & Tooling

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Create: `eslint.config.mjs`
- Create: `.prettierrc`
- Create: `.gitignore`
- Test: `tests/unit/sanity.test.ts`

**Interfaces:**
- Produces: npm scripts (`build`, `dev`, `lint`, `format`, `test`, `test:unit`, `test:integration`, `prisma:generate`, `prisma:migrate`, `prisma:migrate:deploy`) that every later task relies on.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "booking-api",
  "version": "1.0.0",
  "private": true,
  "main": "dist/server.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --check .",
    "test": "jest --config jest.config.js --runInBand",
    "test:unit": "jest --config jest.config.js --runInBand",
    "test:integration": "jest --config jest.integration.config.js --runInBand",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:migrate:deploy": "prisma migrate deploy"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "express": "^4.19.2",
    "@prisma/client": "^5.19.1",
    "zod": "^3.23.8",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^5.1.1",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    "prisma": "^5.19.1",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.4",
    "@types/jest": "^29.5.12",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.15",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/bcrypt": "^5.0.2",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "eslint": "^9.9.0",
    "@eslint/js": "^9.9.0",
    "typescript-eslint": "^8.1.0",
    "prettier": "^3.3.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs cleanly, `node_modules/` created.

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": false,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Write `jest.config.js`**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
  clearMocks: true,
};
```

- [ ] **Step 5: Write `eslint.config.mjs`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

- [ ] **Step 6: Write `.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 7: Write `.gitignore`**

```
node_modules/
dist/
.env
.env.test
coverage/
*.log
```

- [ ] **Step 8: Write the sanity test**

```ts
describe('sanity', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: Run it**

Run: `npm test`
Expected: `PASS tests/unit/sanity.test.ts`, 1 passed.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json tsconfig.json jest.config.js eslint.config.mjs .prettierrc .gitignore tests/unit/sanity.test.ts
git commit -m "chore: project scaffolding and tooling"
```

---

## Task 2: Env Config Validation

**Files:**
- Create: `src/config/env.ts`
- Create: `.env.example`
- Create: `tests/unit/setup.ts`
- Modify: `jest.config.js` (add `setupFiles`, coverage config)
- Test: `tests/unit/config/env.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseEnv(source: NodeJS.ProcessEnv): Env` (pure, throws `EnvValidationError`), `env: Env` (module-level singleton used by every later task that needs config), `EnvValidationError` class. `Env` type has fields: `NODE_ENV`, `PORT`, `DATABASE_URL`, `JWT_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN_DAYS`.

- [ ] **Step 1: Write `src/config/env.ts`**

```ts
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
});

export type Env = z.infer<typeof envSchema>;

export class EnvValidationError extends Error {}

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new EnvValidationError(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}

export const env: Env = (() => {
  try {
    return parseEnv(process.env);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();
```

- [ ] **Step 2: Write `.env.example`**

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/booking_api
JWT_SECRET=change-me-to-a-long-random-string
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN_DAYS=7
```

- [ ] **Step 3: Write `tests/unit/setup.ts`** (so importing `env.ts` never crashes the unit suite)

```ts
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/booking_api_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'unit-test-secret';
```

- [ ] **Step 4: Modify `jest.config.js`** to load the setup file and set the coverage gate

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/unit/setup.ts'],
  clearMocks: true,
  collectCoverageFrom: ['src/services/**/*.ts'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};
```

- [ ] **Step 5: Write the failing test**

```ts
import { parseEnv, EnvValidationError } from '../../../src/config/env';

describe('parseEnv', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_SECRET: 'super-secret',
  };

  it('parses valid env with defaults applied', () => {
    const result = parseEnv(validEnv);
    expect(result.DATABASE_URL).toBe(validEnv.DATABASE_URL);
    expect(result.JWT_SECRET).toBe(validEnv.JWT_SECRET);
    expect(result.NODE_ENV).toBe('development');
    expect(result.PORT).toBe(3000);
    expect(result.JWT_ACCESS_EXPIRES_IN).toBe('15m');
    expect(result.JWT_REFRESH_EXPIRES_IN_DAYS).toBe(7);
  });

  it('throws EnvValidationError when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow(EnvValidationError);
  });

  it('throws EnvValidationError when JWT_SECRET is missing', () => {
    const { JWT_SECRET, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow(EnvValidationError);
  });

  it('coerces PORT from string to number', () => {
    const result = parseEnv({ ...validEnv, PORT: '4000' });
    expect(result.PORT).toBe(4000);
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm run test:unit -- tests/unit/config/env.test.ts`
Expected: 4 passed.

- [ ] **Step 7: Commit**

```bash
git add src/config/env.ts .env.example tests/unit/setup.ts jest.config.js tests/unit/config/env.test.ts
git commit -m "feat: env config validation with zod"
```

---

## Task 3: Docker Compose, Dockerfile, Prisma Schema & Migration

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.test.yml`
- Create: `Dockerfile`
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `.env.test.example`

**Interfaces:**
- Produces: Prisma models `Table`, `TimeSlot`, `Booking` (enum `BookingStatus`), `Admin`, `RefreshToken`; `prisma: PrismaClient` singleton import from `src/lib/prisma.ts`, used by every repository.

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: booking_api
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - '3000:3000'
    environment:
      NODE_ENV: production
      PORT: 3000
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/booking_api
      JWT_SECRET: local-dev-secret-change-me
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  postgres_data:
```

- [ ] **Step 2: Write `docker-compose.test.yml`**

```yaml
services:
  postgres_test:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: booking_api_test
    ports:
      - '5433:5432'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5
```

- [ ] **Step 3: Write `Dockerfile`**

```dockerfile
# Stage 1: builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# Stage 2: production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

- [ ] **Step 4: Start local Postgres**

Run: `docker compose up -d postgres`
Expected: container `booking-api-postgres-1` running and healthy (`docker compose ps` shows `healthy`).

- [ ] **Step 5: Write `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Table {
  id          Int       @id @default(autoincrement())
  name        String
  capacity    Int
  description String?
  createdAt   DateTime  @default(now()) @map("created_at")
  bookings    Booking[]

  @@map("tables")
}

model TimeSlot {
  id              Int       @id @default(autoincrement())
  label           String
  startTime       String    @map("start_time")
  durationMinutes Int       @default(90) @map("duration_minutes")
  isActive        Boolean   @default(true) @map("is_active")
  createdAt       DateTime  @default(now()) @map("created_at")
  bookings        Booking[]

  @@map("time_slots")
}

enum BookingStatus {
  confirmed
  cancelled
}

model Booking {
  id         String        @id @default(uuid())
  date       DateTime      @db.Date
  status     BookingStatus @default(confirmed)
  partySize  Int           @map("party_size")
  guestName  String        @map("guest_name")
  guestEmail String        @map("guest_email")
  guestPhone String?       @map("guest_phone")
  notes      String?
  tableId    Int           @map("table_id")
  slotId     Int           @map("slot_id")
  table      Table         @relation(fields: [tableId], references: [id])
  slot       TimeSlot      @relation(fields: [slotId], references: [id])
  createdAt  DateTime      @default(now()) @map("created_at")
  updatedAt  DateTime      @updatedAt @map("updated_at")

  @@index([tableId, slotId, date])
  @@map("bookings")
}

model Admin {
  id            Int            @id @default(autoincrement())
  email         String         @unique
  passwordHash  String         @map("password_hash")
  createdAt     DateTime       @default(now()) @map("created_at")
  refreshTokens RefreshToken[]

  @@map("admins")
}

model RefreshToken {
  id        Int      @id @default(autoincrement())
  tokenHash String   @map("token_hash")
  adminId   Int      @map("admin_id")
  admin     Admin    @relation(fields: [adminId], references: [id])
  expiresAt DateTime @map("expires_at")
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")

  @@map("refresh_tokens")
}
```

- [ ] **Step 6: Create `.env` locally (not committed) pointing at the compose Postgres, then generate the migration**

Run: `echo 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/booking_api\nJWT_SECRET=local-dev-secret' > .env && npx prisma migrate dev --name init`
Expected: `prisma/migrations/<timestamp>_init/migration.sql` created, migration applied, "Your database is now in sync with your schema."

- [ ] **Step 7: Write `src/lib/prisma.ts`**

```ts
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
```

- [ ] **Step 8: Write `.env.test.example`**

```
NODE_ENV=test
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/booking_api_test
JWT_SECRET=test-secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN_DAYS=7
```

- [ ] **Step 9: Verify tables exist**

Run: `docker compose exec postgres psql -U postgres -d booking_api -c '\dt'`
Expected: lists `tables`, `time_slots`, `bookings`, `admins`, `refresh_tokens`.

- [ ] **Step 10: Commit**

```bash
git add docker-compose.yml docker-compose.test.yml Dockerfile prisma/schema.prisma prisma/migrations src/lib/prisma.ts .env.test.example
git commit -m "feat: postgres via docker-compose, prisma schema and initial migration"
```

---

## Task 4: Error Classes

**Files:**
- Create: `src/errors/AppError.ts`
- Test: `tests/unit/errors/AppError.test.ts`

**Interfaces:**
- Produces: `AppError` (base, has `statusCode: number`), `ValidationError` (422), `NotFoundError` (404), `ConflictError` (409), `UnauthorizedError` (401). Every service in later tasks throws these; `errorHandler` (Task 5) maps them to HTTP responses.

- [ ] **Step 1: Write the failing test**

```ts
import {
  AppError,
  ValidationError,
  NotFoundError,
  ConflictError,
  UnauthorizedError,
} from '../../../src/errors/AppError';

describe('AppError subclasses', () => {
  it.each([
    [ValidationError, 422],
    [NotFoundError, 404],
    [ConflictError, 409],
    [UnauthorizedError, 401],
  ])('%p sets statusCode %i', (ErrorClass, statusCode) => {
    const err = new (ErrorClass as new (msg: string) => AppError)('boom');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(statusCode);
    expect(err.message).toBe('boom');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- tests/unit/errors/AppError.test.ts`
Expected: FAIL — cannot find module `../../../src/errors/AppError`.

- [ ] **Step 3: Write `src/errors/AppError.ts`**

```ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string) {
    super(message, 401);
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- tests/unit/errors/AppError.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add src/errors/AppError.ts tests/unit/errors/AppError.test.ts
git commit -m "feat: typed AppError hierarchy"
```

---

## Task 5: Express App Factory, Error Handler, Health Endpoint, Integration Test Harness

**Files:**
- Create: `src/middleware/errorHandler.ts`
- Create: `src/routes/health.routes.ts`
- Create: `src/app.ts`
- Create: `src/server.ts`
- Create: `jest.integration.config.js`
- Create: `tests/integration/jest.setup.ts`
- Test: `tests/integration/health.test.ts`

**Interfaces:**
- Consumes: `AppError` (Task 4), `prisma` (Task 3), `env` (Task 2).
- Produces: `createApp(): Express` (used by every integration test and `server.ts`), `errorHandler` (mounted last, maps `ZodError`/`AppError`/unknown to responses).

- [ ] **Step 1: Write `src/middleware/errorHandler.ts`**

```ts
import { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(422).json({
      error: 'ValidationError',
      fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.name, message: err.message });
    return;
  }

  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: 'InternalServerError', message: 'Something went wrong' });
};
```

- [ ] **Step 2: Write `src/routes/health.routes.ts`**

```ts
import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: 'ok' });
  } catch {
    res.status(503).json({ status: 'ok', db: 'error' });
  }
});
```

- [ ] **Step 3: Write `src/app.ts`**

```ts
import express, { Express } from 'express';
import { healthRouter } from './routes/health.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 4: Write `src/server.ts`**

```ts
import { env } from './config/env';
import { createApp } from './app';

const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`booking-api listening on port ${env.PORT}`);
});
```

- [ ] **Step 5: Write `jest.integration.config.js`**

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
  setupFiles: ['<rootDir>/tests/integration/jest.setup.ts'],
  clearMocks: true,
};
```

- [ ] **Step 6: Write `tests/integration/jest.setup.ts`**

```ts
import * as path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../../.env.test') });
```

- [ ] **Step 7: Create local `.env.test`, start the test Postgres, and apply migrations**

Run: `cp .env.test.example .env.test && docker compose -f docker-compose.test.yml up -d && npx dotenv -e .env.test -- npx prisma migrate deploy`
Expected: migration applied against port 5433 test DB. (If `dotenv-cli` isn't installed, run `DATABASE_URL=postgresql://postgres:postgres@localhost:5433/booking_api_test npx prisma migrate deploy` instead.)

- [ ] **Step 8: Write the failing test**

```ts
import request from 'supertest';
import { createApp } from '../../src/app';

describe('GET /health', () => {
  it('returns ok status with db connectivity', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'ok' });
  });
});
```

- [ ] **Step 9: Run it**

Run: `npm run test:integration -- tests/integration/health.test.ts`
Expected: 1 passed.

- [ ] **Step 10: Commit**

```bash
git add src/middleware/errorHandler.ts src/routes/health.routes.ts src/app.ts src/server.ts jest.integration.config.js tests/integration/jest.setup.ts tests/integration/health.test.ts .env.test.example
git commit -m "feat: express app factory, error handler, health endpoint, integration harness"
```

---

## Task 6: JWT Helper Library

**Files:**
- Create: `src/lib/jwt.ts`
- Test: `tests/unit/lib/jwt.test.ts`

**Interfaces:**
- Consumes: `env` (Task 2).
- Produces: `AccessTokenPayload { adminId: number; email: string }`, `signAccessToken(payload): string`, `verifyAccessToken(token): AccessTokenPayload`, `RefreshTokenPayload { type: 'refresh'; jti: string }`, `generateRefreshTokenValue(): string`, `verifyRefreshTokenSignature(token): RefreshTokenPayload`. Used by `AuthService` (Task 8) and `authenticate` middleware (Task 9).

- [ ] **Step 1: Write the failing test**

```ts
import jwt from 'jsonwebtoken';
import {
  signAccessToken,
  verifyAccessToken,
  generateRefreshTokenValue,
  verifyRefreshTokenSignature,
} from '../../../src/lib/jwt';

describe('jwt lib', () => {
  it('signs and verifies an access token round-trip', () => {
    const token = signAccessToken({ adminId: 1, email: 'a@b.com' });
    const payload = verifyAccessToken(token);
    expect(payload.adminId).toBe(1);
    expect(payload.email).toBe('a@b.com');
  });

  it('throws when verifying a token signed with a different secret', () => {
    const bogus = jwt.sign({ adminId: 1, email: 'a@b.com' }, 'wrong-secret');
    expect(() => verifyAccessToken(bogus)).toThrow();
  });

  it('generates unique refresh token values with a jti', () => {
    const a = generateRefreshTokenValue();
    const b = generateRefreshTokenValue();
    expect(a).not.toBe(b);
    const { jti, type } = verifyRefreshTokenSignature(a);
    expect(type).toBe('refresh');
    expect(jti).toEqual(expect.any(String));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- tests/unit/lib/jwt.test.ts`
Expected: FAIL — cannot find module `../../../src/lib/jwt`.

- [ ] **Step 3: Write `src/lib/jwt.ts`**

```ts
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { env } from '../config/env';

export interface AccessTokenPayload {
  adminId: number;
  email: string;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
}

export interface RefreshTokenPayload {
  type: 'refresh';
  jti: string;
}

export function generateRefreshTokenValue(): string {
  const jti = randomBytes(16).toString('hex');
  return jwt.sign({ type: 'refresh', jti }, env.JWT_SECRET, {
    expiresIn: `${env.JWT_REFRESH_EXPIRES_IN_DAYS}d`,
  });
}

export function verifyRefreshTokenSignature(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as RefreshTokenPayload;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- tests/unit/lib/jwt.test.ts`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/jwt.ts tests/unit/lib/jwt.test.ts
git commit -m "feat: jwt access/refresh token helpers"
```

---

## Task 7: Admin & RefreshToken Repositories

**Files:**
- Create: `src/repositories/admin.repository.ts`
- Create: `src/repositories/refreshToken.repository.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3).
- Produces: `AdminRepository.{findByEmail, findById, create}`, `RefreshTokenRepository.{create, findByTokenHash, revoke}`. Consumed by `AuthService` (Task 8). No dedicated unit tests — per Global Constraints, unit tests cover the service layer only; repositories are exercised indirectly via integration tests.

- [ ] **Step 1: Write `src/repositories/admin.repository.ts`**

```ts
import { prisma } from '../lib/prisma';
import { Admin } from '@prisma/client';

export const AdminRepository = {
  findByEmail(email: string): Promise<Admin | null> {
    return prisma.admin.findUnique({ where: { email } });
  },
  findById(id: number): Promise<Admin | null> {
    return prisma.admin.findUnique({ where: { id } });
  },
  create(data: { email: string; passwordHash: string }): Promise<Admin> {
    return prisma.admin.create({ data });
  },
};
```

- [ ] **Step 2: Write `src/repositories/refreshToken.repository.ts`**

```ts
import { prisma } from '../lib/prisma';
import { RefreshToken } from '@prisma/client';

export const RefreshTokenRepository = {
  create(data: { tokenHash: string; adminId: number; expiresAt: Date }): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data });
  },
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findFirst({ where: { tokenHash, revoked: false } });
  },
  revoke(id: number): Promise<RefreshToken> {
    return prisma.refreshToken.update({ where: { id }, data: { revoked: true } });
  },
};
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/repositories/admin.repository.ts src/repositories/refreshToken.repository.ts
git commit -m "feat: admin and refresh token repositories"
```

---

## Task 8: Auth Service (login, refresh, logout)

**Files:**
- Create: `src/services/auth.service.ts`
- Test: `tests/unit/services/auth.service.test.ts`

**Interfaces:**
- Consumes: `AdminRepository`, `RefreshTokenRepository` (Task 7), `signAccessToken`, `generateRefreshTokenValue`, `verifyRefreshTokenSignature` (Task 6), `UnauthorizedError` (Task 4), `env` (Task 2).
- Produces: `AuthService.login(email, password): Promise<{accessToken, refreshToken}>`, `AuthService.refresh(refreshToken): Promise<{accessToken}>`, `AuthService.logout(refreshToken): Promise<void>`. Consumed by `auth.controller.ts` (Task 10).

- [ ] **Step 1: Write the failing test**

```ts
import bcrypt from 'bcrypt';
import { AuthService } from '../../../src/services/auth.service';
import { AdminRepository } from '../../../src/repositories/admin.repository';
import { RefreshTokenRepository } from '../../../src/repositories/refreshToken.repository';
import { UnauthorizedError } from '../../../src/errors/AppError';

jest.mock('../../../src/repositories/admin.repository');
jest.mock('../../../src/repositories/refreshToken.repository');
jest.mock('bcrypt');

const mockedAdminRepo = AdminRepository as jest.Mocked<typeof AdminRepository>;
const mockedRefreshRepo = RefreshTokenRepository as jest.Mocked<typeof RefreshTokenRepository>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const admin = { id: 1, email: 'admin@restaurant.com', passwordHash: 'hashed', createdAt: new Date() };

describe('AuthService.login', () => {
  it('returns access and refresh tokens for valid credentials', async () => {
    mockedAdminRepo.findByEmail.mockResolvedValue(admin);
    mockedBcrypt.compare.mockResolvedValue(true as never);
    mockedRefreshRepo.create.mockResolvedValue({
      id: 1,
      tokenHash: 'x',
      adminId: 1,
      expiresAt: new Date(),
      revoked: false,
      createdAt: new Date(),
    });

    const result = await AuthService.login('admin@restaurant.com', 'correct-password');

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(mockedRefreshRepo.create).toHaveBeenCalledTimes(1);
  });

  it('throws UnauthorizedError when admin does not exist', async () => {
    mockedAdminRepo.findByEmail.mockResolvedValue(null);
    await expect(AuthService.login('nope@restaurant.com', 'x')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when password does not match', async () => {
    mockedAdminRepo.findByEmail.mockResolvedValue(admin);
    mockedBcrypt.compare.mockResolvedValue(false as never);
    await expect(AuthService.login('admin@restaurant.com', 'wrong')).rejects.toThrow(UnauthorizedError);
  });
});

describe('AuthService.refresh', () => {
  it('throws UnauthorizedError for a malformed refresh token', async () => {
    await expect(AuthService.refresh('not-a-jwt')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when stored token is revoked', async () => {
    const { generateRefreshTokenValue } = jest.requireActual('../../../src/lib/jwt');
    const token = generateRefreshTokenValue();
    mockedRefreshRepo.findByTokenHash.mockResolvedValue({
      id: 1,
      tokenHash: 'x',
      adminId: 1,
      expiresAt: new Date(Date.now() + 100000),
      revoked: true,
      createdAt: new Date(),
    });
    await expect(AuthService.refresh(token)).rejects.toThrow(UnauthorizedError);
  });

  it('issues a new access token for a valid, unrevoked refresh token', async () => {
    const { generateRefreshTokenValue } = jest.requireActual('../../../src/lib/jwt');
    const token = generateRefreshTokenValue();
    mockedRefreshRepo.findByTokenHash.mockResolvedValue({
      id: 1,
      tokenHash: 'x',
      adminId: 1,
      expiresAt: new Date(Date.now() + 100000),
      revoked: false,
      createdAt: new Date(),
    });
    mockedAdminRepo.findById.mockResolvedValue(admin);

    const result = await AuthService.refresh(token);
    expect(result.accessToken).toEqual(expect.any(String));
  });
});

describe('AuthService.logout', () => {
  it('revokes the stored refresh token', async () => {
    const { generateRefreshTokenValue } = jest.requireActual('../../../src/lib/jwt');
    const token = generateRefreshTokenValue();
    mockedRefreshRepo.findByTokenHash.mockResolvedValue({
      id: 5,
      tokenHash: 'x',
      adminId: 1,
      expiresAt: new Date(Date.now() + 100000),
      revoked: false,
      createdAt: new Date(),
    });

    await AuthService.logout(token);

    expect(mockedRefreshRepo.revoke).toHaveBeenCalledWith(5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- tests/unit/services/auth.service.test.ts`
Expected: FAIL — cannot find module `../../../src/services/auth.service`.

- [ ] **Step 3: Write `src/services/auth.service.ts`**

```ts
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AdminRepository } from '../repositories/admin.repository';
import { RefreshTokenRepository } from '../repositories/refreshToken.repository';
import { signAccessToken, generateRefreshTokenValue, verifyRefreshTokenSignature } from '../lib/jwt';
import { UnauthorizedError } from '../errors/AppError';
import { env } from '../config/env';

function hashTokenLookup(jti: string): string {
  return createHash('sha256').update(jti).digest('hex');
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
}

export const AuthService = {
  async login(email: string, password: string): Promise<LoginResult> {
    const admin = await AdminRepository.findByEmail(email);
    if (!admin) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = signAccessToken({ adminId: admin.id, email: admin.email });
    const refreshToken = generateRefreshTokenValue();
    const { jti } = verifyRefreshTokenSignature(refreshToken);

    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);
    await RefreshTokenRepository.create({
      tokenHash: hashTokenLookup(jti),
      adminId: admin.id,
      expiresAt,
    });

    return { accessToken, refreshToken };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    let jti: string;
    try {
      ({ jti } = verifyRefreshTokenSignature(refreshToken));
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const stored = await RefreshTokenRepository.findByTokenHash(hashTokenLookup(jti));
    if (!stored || stored.revoked || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    const admin = await AdminRepository.findById(stored.adminId);
    if (!admin) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const accessToken = signAccessToken({ adminId: admin.id, email: admin.email });
    return { accessToken };
  },

  async logout(refreshToken: string): Promise<void> {
    let jti: string;
    try {
      ({ jti } = verifyRefreshTokenSignature(refreshToken));
    } catch {
      return;
    }

    const stored = await RefreshTokenRepository.findByTokenHash(hashTokenLookup(jti));
    if (stored && !stored.revoked) {
      await RefreshTokenRepository.revoke(stored.id);
    }
  },
};
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- tests/unit/services/auth.service.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/auth.service.ts tests/unit/services/auth.service.test.ts
git commit -m "feat: auth service (login, refresh, logout)"
```

---

## Task 9: Authenticate Middleware

**Files:**
- Create: `src/types/express.d.ts`
- Create: `src/middleware/authenticate.ts`
- Test: `tests/unit/middleware/authenticate.test.ts`

**Interfaces:**
- Consumes: `verifyAccessToken` (Task 6), `UnauthorizedError` (Task 4).
- Produces: `authenticate: RequestHandler` that sets `req.admin: AccessTokenPayload`. Used by every `/admin/*` route (Tasks 10, 13, 16, 21).

- [ ] **Step 1: Write `src/types/express.d.ts`**

```ts
import { AccessTokenPayload } from '../lib/jwt';

declare global {
  namespace Express {
    interface Request {
      admin?: AccessTokenPayload;
    }
  }
}

export {};
```

- [ ] **Step 2: Write the failing test**

```ts
import { Request, Response } from 'express';
import { authenticate } from '../../../src/middleware/authenticate';
import { signAccessToken } from '../../../src/lib/jwt';
import { UnauthorizedError } from '../../../src/errors/AppError';

function mockRes(): Response {
  return {} as Response;
}

describe('authenticate middleware', () => {
  it('calls next with UnauthorizedError when header is missing', () => {
    const req = { headers: {} } as Request;
    const next = jest.fn();
    authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('calls next with UnauthorizedError for a malformed token', () => {
    const req = { headers: { authorization: 'Bearer garbage' } } as Request;
    const next = jest.fn();
    authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('attaches admin payload and calls next() with no error for a valid token', () => {
    const token = signAccessToken({ adminId: 1, email: 'a@b.com' });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const next = jest.fn();
    authenticate(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.admin).toEqual({ adminId: 1, email: 'a@b.com' });
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:unit -- tests/unit/middleware/authenticate.test.ts`
Expected: FAIL — cannot find module `../../../src/middleware/authenticate`.

- [ ] **Step 4: Write `src/middleware/authenticate.ts`**

```ts
import { RequestHandler } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { UnauthorizedError } from '../errors/AppError';

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    req.admin = verifyAccessToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired access token'));
  }
};
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm run test:unit -- tests/unit/middleware/authenticate.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add src/types/express.d.ts src/middleware/authenticate.ts tests/unit/middleware/authenticate.test.ts
git commit -m "feat: jwt authenticate middleware"
```

---

## Task 10: Auth Routes, Controllers, Schemas, Validation Middleware + Integration Tests

**Files:**
- Create: `src/middleware/validate.ts`
- Create: `src/schemas/auth.schema.ts`
- Create: `src/controllers/auth.controller.ts`
- Create: `src/routes/auth.routes.ts`
- Create: `tests/integration/helpers/resetDb.ts`
- Create: `tests/integration/helpers/seedAdmin.ts`
- Modify: `src/app.ts` (mount `authRouter`)
- Test: `tests/integration/auth.test.ts`

**Interfaces:**
- Consumes: `AuthService` (Task 8), `errorHandler`'s `ZodError` branch (Task 5).
- Produces: `validateBody(schema)`, `validateQuery(schema)` middleware (reused by every later route task), `authRouter` mounted at `/auth/login`, `/auth/refresh`, `/auth/logout`. `resetDb()` and `seedAdmin()` test helpers reused by every later integration test.

- [ ] **Step 1: Write `src/middleware/validate.ts`**

```ts
import { RequestHandler } from 'express';
import { ZodSchema } from 'zod';

export function validateBody(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    req.query = schema.parse(req.query);
    next();
  };
}

export function validateParams(schema: ZodSchema): RequestHandler {
  return (req, _res, next) => {
    req.params = schema.parse(req.params) as typeof req.params;
    next();
  };
}
```

- [ ] **Step 2: Write `src/schemas/auth.schema.ts`**

```ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
```

- [ ] **Step 3: Write `src/controllers/auth.controller.ts`**

```ts
import { RequestHandler } from 'express';
import { AuthService } from '../services/auth.service';
import { LoginInput, RefreshInput } from '../schemas/auth.schema';

export const login: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as LoginInput;
    const result = await AuthService.login(email, password);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const refresh: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body as RefreshInput;
    const result = await AuthService.refresh(refreshToken);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const logout: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body as RefreshInput;
    await AuthService.logout(refreshToken);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 4: Write `src/routes/auth.routes.ts`**

```ts
import { Router } from 'express';
import { validateBody } from '../middleware/validate';
import { loginSchema, refreshSchema } from '../schemas/auth.schema';
import { login, refresh, logout } from '../controllers/auth.controller';

export const authRouter = Router();

authRouter.post('/auth/login', validateBody(loginSchema), login);
authRouter.post('/auth/refresh', validateBody(refreshSchema), refresh);
authRouter.post('/auth/logout', validateBody(refreshSchema), logout);
```

- [ ] **Step 5: Modify `src/app.ts`**

```ts
import express, { Express } from 'express';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(authRouter);
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 6: Write `tests/integration/helpers/resetDb.ts`**

```ts
import { prisma } from '../../../src/lib/prisma';

export async function resetDb() {
  await prisma.refreshToken.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.table.deleteMany();
  await prisma.timeSlot.deleteMany();
}
```

- [ ] **Step 7: Write `tests/integration/helpers/seedAdmin.ts`**

```ts
import bcrypt from 'bcrypt';
import { prisma } from '../../../src/lib/prisma';

export async function seedAdmin(email = 'admin@test.com', password = 'password123') {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.admin.create({ data: { email, passwordHash } });
}
```

- [ ] **Step 8: Write the failing integration test**

```ts
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDb } from './helpers/resetDb';
import { seedAdmin } from './helpers/seedAdmin';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Auth flow', () => {
  it('logs in with valid credentials and returns tokens', async () => {
    await seedAdmin('admin@test.com', 'password123');
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
  });

  it('returns 401 for wrong password', async () => {
    await seedAdmin('admin@test.com', 'password123');
    const res = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns 422 for a malformed login body', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(422);
  });

  it('refreshes an access token with a valid refresh token', async () => {
    await seedAdmin('admin@test.com', 'password123');
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
  });

  it('logs out and then rejects reuse of the same refresh token', async () => {
    await seedAdmin('admin@test.com', 'password123');
    const loginRes = await request(app)
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'password123' });
    const logoutRes = await request(app)
      .post('/auth/logout')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(logoutRes.status).toBe(204);
    const refreshRes = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: loginRes.body.refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});
```

- [ ] **Step 9: Run it**

Run: `npm run test:integration -- tests/integration/auth.test.ts`
Expected: 5 passed.

- [ ] **Step 10: Commit**

```bash
git add src/middleware/validate.ts src/schemas/auth.schema.ts src/controllers/auth.controller.ts src/routes/auth.routes.ts src/app.ts tests/integration/helpers tests/integration/auth.test.ts
git commit -m "feat: auth routes with validation and integration tests"
```

---

## Task 11: Table Repository

**Files:**
- Create: `src/repositories/table.repository.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3).
- Produces: `TableRepository.{findAll, findById, create, update, delete, countFutureConfirmedBookings, existsWithCapacityAtLeast, findAvailable, findAvailableWithSpecificTable}`. All methods that participate in a transaction accept an optional `db: PrismaClient | Prisma.TransactionClient` last parameter (defaults to the singleton). Consumed by `TableService` (Task 12) and `BookingService` (Tasks 18–19).

- [ ] **Step 1: Write `src/repositories/table.repository.ts`**

```ts
import { prisma } from '../lib/prisma';
import { Table, PrismaClient, Prisma } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

export const TableRepository = {
  findAll(): Promise<Table[]> {
    return prisma.table.findMany({ orderBy: { id: 'asc' } });
  },

  findById(id: number, db: DbClient = prisma): Promise<Table | null> {
    return db.table.findUnique({ where: { id } });
  },

  create(data: { name: string; capacity: number; description?: string }): Promise<Table> {
    return prisma.table.create({ data });
  },

  update(id: number, data: { name?: string; capacity?: number; description?: string }): Promise<Table> {
    return prisma.table.update({ where: { id }, data });
  },

  delete(id: number): Promise<Table> {
    return prisma.table.delete({ where: { id } });
  },

  countFutureConfirmedBookings(tableId: number): Promise<number> {
    return prisma.booking.count({
      where: {
        tableId,
        status: 'confirmed',
        date: { gte: new Date(new Date().toDateString()) },
      },
    });
  },

  async existsWithCapacityAtLeast(partySize: number, db: DbClient = prisma): Promise<boolean> {
    const count = await db.table.count({ where: { capacity: { gte: partySize } } });
    return count > 0;
  },

  findAvailable(slotId: number, date: Date, partySize: number, db: DbClient = prisma): Promise<Table[]> {
    return db.table.findMany({
      where: {
        capacity: { gte: partySize },
        bookings: { none: { slotId, date, status: 'confirmed' } },
      },
      orderBy: { capacity: 'asc' },
    });
  },

  findAvailableWithSpecificTable(
    tableId: number,
    slotId: number,
    date: Date,
    partySize: number,
    db: DbClient = prisma,
  ): Promise<Table | null> {
    return db.table.findFirst({
      where: {
        id: tableId,
        capacity: { gte: partySize },
        bookings: { none: { slotId, date, status: 'confirmed' } },
      },
    });
  },
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/repositories/table.repository.ts
git commit -m "feat: table repository with availability queries"
```

---

## Task 12: Table Service

**Files:**
- Create: `src/services/table.service.ts`
- Test: `tests/unit/services/table.service.test.ts`

**Interfaces:**
- Consumes: `TableRepository` (Task 11), `NotFoundError`, `ConflictError` (Task 4).
- Produces: `TableService.{listAll, create, update, remove}`. Consumed by `table.controller.ts` (Task 13).

- [ ] **Step 1: Write the failing test**

```ts
import { TableService } from '../../../src/services/table.service';
import { TableRepository } from '../../../src/repositories/table.repository';
import { NotFoundError, ConflictError } from '../../../src/errors/AppError';

jest.mock('../../../src/repositories/table.repository');
const mockedRepo = TableRepository as jest.Mocked<typeof TableRepository>;

const table = { id: 1, name: 'Table 1', capacity: 4, description: null, createdAt: new Date() };

describe('TableService.update', () => {
  it('throws NotFoundError when table does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(TableService.update(99, { name: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('updates an existing table', async () => {
    mockedRepo.findById.mockResolvedValue(table);
    mockedRepo.update.mockResolvedValue({ ...table, name: 'Updated' });
    const result = await TableService.update(1, { name: 'Updated' });
    expect(result.name).toBe('Updated');
  });
});

describe('TableService.remove', () => {
  it('throws NotFoundError when table does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(TableService.remove(99)).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when table has future confirmed bookings', async () => {
    mockedRepo.findById.mockResolvedValue(table);
    mockedRepo.countFutureConfirmedBookings.mockResolvedValue(2);
    await expect(TableService.remove(1)).rejects.toThrow(ConflictError);
  });

  it('deletes the table when there are no future confirmed bookings', async () => {
    mockedRepo.findById.mockResolvedValue(table);
    mockedRepo.countFutureConfirmedBookings.mockResolvedValue(0);
    mockedRepo.delete.mockResolvedValue(table);
    await TableService.remove(1);
    expect(mockedRepo.delete).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- tests/unit/services/table.service.test.ts`
Expected: FAIL — cannot find module `../../../src/services/table.service`.

- [ ] **Step 3: Write `src/services/table.service.ts`**

```ts
import { TableRepository } from '../repositories/table.repository';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { Table } from '@prisma/client';

export const TableService = {
  listAll(): Promise<Table[]> {
    return TableRepository.findAll();
  },

  create(input: { name: string; capacity: number; description?: string }): Promise<Table> {
    return TableRepository.create(input);
  },

  async update(id: number, input: { name?: string; capacity?: number; description?: string }): Promise<Table> {
    const existing = await TableRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Table ${id} not found`);
    }
    return TableRepository.update(id, input);
  },

  async remove(id: number): Promise<void> {
    const existing = await TableRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Table ${id} not found`);
    }

    const futureBookings = await TableRepository.countFutureConfirmedBookings(id);
    if (futureBookings > 0) {
      throw new ConflictError('Cannot delete a table with future confirmed bookings');
    }

    await TableRepository.delete(id);
  },
};
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- tests/unit/services/table.service.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/table.service.ts tests/unit/services/table.service.test.ts
git commit -m "feat: table service with CRUD and delete guard"
```

---

## Task 13: Table Routes, Controllers, Schemas + Integration Tests

**Files:**
- Create: `src/schemas/table.schema.ts`
- Create: `src/controllers/table.controller.ts`
- Create: `src/routes/table.routes.ts`
- Create: `tests/integration/helpers/getAuthToken.ts`
- Modify: `src/app.ts` (mount `tableRouter`)
- Test: `tests/integration/admin-tables.test.ts`

**Interfaces:**
- Consumes: `TableService` (Task 12), `authenticate` (Task 9), `validateBody`/`validateParams` (Task 10).
- Produces: `tableRouter` at `/admin/tables`, `/admin/tables/:id`. `getAuthToken(app)` test helper reused by every later admin integration test.

- [ ] **Step 1: Write `src/schemas/table.schema.ts`**

```ts
import { z } from 'zod';

export const createTableSchema = z.object({
  name: z.string().min(1),
  capacity: z.coerce.number().int().positive(),
  description: z.string().optional(),
});

export const updateTableSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
});

export const tableIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
```

- [ ] **Step 2: Write `src/controllers/table.controller.ts`**

```ts
import { RequestHandler } from 'express';
import { TableService } from '../services/table.service';
import { CreateTableInput, UpdateTableInput } from '../schemas/table.schema';

export const listTables: RequestHandler = async (_req, res, next) => {
  try {
    const tables = await TableService.listAll();
    res.status(200).json(tables);
  } catch (err) {
    next(err);
  }
};

export const createTable: RequestHandler = async (req, res, next) => {
  try {
    const table = await TableService.create(req.body as CreateTableInput);
    res.status(201).json(table);
  } catch (err) {
    next(err);
  }
};

export const updateTable: RequestHandler = async (req, res, next) => {
  try {
    const id = Number((req.params as unknown as { id: number }).id);
    const table = await TableService.update(id, req.body as UpdateTableInput);
    res.status(200).json(table);
  } catch (err) {
    next(err);
  }
};

export const deleteTable: RequestHandler = async (req, res, next) => {
  try {
    const id = Number((req.params as unknown as { id: number }).id);
    await TableService.remove(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 3: Write `src/routes/table.routes.ts`**

```ts
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateParams } from '../middleware/validate';
import { createTableSchema, updateTableSchema, tableIdParamSchema } from '../schemas/table.schema';
import { listTables, createTable, updateTable, deleteTable } from '../controllers/table.controller';

export const tableRouter = Router();

tableRouter.get('/admin/tables', authenticate, listTables);
tableRouter.post('/admin/tables', authenticate, validateBody(createTableSchema), createTable);
tableRouter.patch(
  '/admin/tables/:id',
  authenticate,
  validateParams(tableIdParamSchema),
  validateBody(updateTableSchema),
  updateTable,
);
tableRouter.delete('/admin/tables/:id', authenticate, validateParams(tableIdParamSchema), deleteTable);
```

- [ ] **Step 4: Modify `src/app.ts`** — add the import and `app.use(tableRouter)` before `app.use(errorHandler)`.

- [ ] **Step 5: Write `tests/integration/helpers/getAuthToken.ts`**

```ts
import request from 'supertest';
import { Express } from 'express';
import { seedAdmin } from './seedAdmin';

export async function getAuthToken(
  app: Express,
  email = 'admin@test.com',
  password = 'password123',
): Promise<string> {
  await seedAdmin(email, password);
  const res = await request(app).post('/auth/login').send({ email, password });
  return res.body.accessToken as string;
}
```

- [ ] **Step 6: Write the failing integration test**

```ts
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDb } from './helpers/resetDb';
import { getAuthToken } from './helpers/getAuthToken';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Admin table management', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/admin/tables');
    expect(res.status).toBe(401);
  });

  it('creates, lists, updates, and deletes a table', async () => {
    const token = await getAuthToken(app);

    const createRes = await request(app)
      .post('/admin/tables')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Table 9', capacity: 6 });
    expect(createRes.status).toBe(201);
    const tableId = createRes.body.id;

    const listRes = await request(app).get('/admin/tables').set('Authorization', `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);

    const updateRes = await request(app)
      .patch(`/admin/tables/${tableId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ capacity: 8 });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.capacity).toBe(8);

    const deleteRes = await request(app)
      .delete(`/admin/tables/${tableId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);
  });

  it('returns 409 when deleting a table with a future confirmed booking', async () => {
    const token = await getAuthToken(app);
    const table = await prisma.table.create({ data: { name: 'Table 1', capacity: 4 } });
    const slot = await prisma.timeSlot.create({
      data: { label: 'Lunch', startTime: '12:00', durationMinutes: 90 },
    });
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    await prisma.booking.create({
      data: {
        date: futureDate,
        partySize: 2,
        guestName: 'Guest',
        guestEmail: 'guest@test.com',
        tableId: table.id,
        slotId: slot.id,
      },
    });

    const res = await request(app)
      .delete(`/admin/tables/${table.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 7: Run it**

Run: `npm run test:integration -- tests/integration/admin-tables.test.ts`
Expected: 3 passed.

- [ ] **Step 8: Commit**

```bash
git add src/schemas/table.schema.ts src/controllers/table.controller.ts src/routes/table.routes.ts src/app.ts tests/integration/helpers/getAuthToken.ts tests/integration/admin-tables.test.ts
git commit -m "feat: admin table routes with integration tests"
```

---

## Task 14: Slot Repository

**Files:**
- Create: `src/repositories/slot.repository.ts`

**Interfaces:**
- Produces: `SlotRepository.{findAllActive, findAll, findById, create, update, delete, countFutureConfirmedBookings}`. Consumed by `SlotService` (Task 15) and `BookingService` (Task 18).

- [ ] **Step 1: Write `src/repositories/slot.repository.ts`**

```ts
import { prisma } from '../lib/prisma';
import { TimeSlot } from '@prisma/client';

export const SlotRepository = {
  findAllActive(): Promise<TimeSlot[]> {
    return prisma.timeSlot.findMany({ where: { isActive: true }, orderBy: { startTime: 'asc' } });
  },

  findAll(): Promise<TimeSlot[]> {
    return prisma.timeSlot.findMany({ orderBy: { startTime: 'asc' } });
  },

  findById(id: number): Promise<TimeSlot | null> {
    return prisma.timeSlot.findUnique({ where: { id } });
  },

  create(data: {
    label: string;
    startTime: string;
    durationMinutes?: number;
    isActive?: boolean;
  }): Promise<TimeSlot> {
    return prisma.timeSlot.create({ data });
  },

  update(
    id: number,
    data: { label?: string; startTime?: string; durationMinutes?: number; isActive?: boolean },
  ): Promise<TimeSlot> {
    return prisma.timeSlot.update({ where: { id }, data });
  },

  delete(id: number): Promise<TimeSlot> {
    return prisma.timeSlot.delete({ where: { id } });
  },

  countFutureConfirmedBookings(slotId: number): Promise<number> {
    return prisma.booking.count({
      where: {
        slotId,
        status: 'confirmed',
        date: { gte: new Date(new Date().toDateString()) },
      },
    });
  },
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/repositories/slot.repository.ts
git commit -m "feat: time slot repository"
```

---

## Task 15: Slot Service

**Files:**
- Create: `src/services/slot.service.ts`
- Test: `tests/unit/services/slot.service.test.ts`

**Interfaces:**
- Consumes: `SlotRepository` (Task 14), `NotFoundError`, `ConflictError` (Task 4).
- Produces: `SlotService.{listActive, listAll, create, update, remove}`. Consumed by `slot.controller.ts` (Task 16) and `BookingService.create` (Task 18, via `SlotRepository.findById` directly — `SlotService` itself is only consumed by the slot controller).

- [ ] **Step 1: Write the failing test**

```ts
import { SlotService } from '../../../src/services/slot.service';
import { SlotRepository } from '../../../src/repositories/slot.repository';
import { NotFoundError, ConflictError } from '../../../src/errors/AppError';

jest.mock('../../../src/repositories/slot.repository');
const mockedRepo = SlotRepository as jest.Mocked<typeof SlotRepository>;

const slot = {
  id: 1,
  label: 'Lunch',
  startTime: '12:00',
  durationMinutes: 90,
  isActive: true,
  createdAt: new Date(),
};

describe('SlotService.update', () => {
  it('throws NotFoundError when slot does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(SlotService.update(99, { label: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('updates an existing slot', async () => {
    mockedRepo.findById.mockResolvedValue(slot);
    mockedRepo.update.mockResolvedValue({ ...slot, label: 'Updated' });
    const result = await SlotService.update(1, { label: 'Updated' });
    expect(result.label).toBe('Updated');
  });
});

describe('SlotService.remove', () => {
  it('throws NotFoundError when slot does not exist', async () => {
    mockedRepo.findById.mockResolvedValue(null);
    await expect(SlotService.remove(99)).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when slot has future confirmed bookings', async () => {
    mockedRepo.findById.mockResolvedValue(slot);
    mockedRepo.countFutureConfirmedBookings.mockResolvedValue(1);
    await expect(SlotService.remove(1)).rejects.toThrow(ConflictError);
  });

  it('deletes the slot when there are no future confirmed bookings', async () => {
    mockedRepo.findById.mockResolvedValue(slot);
    mockedRepo.countFutureConfirmedBookings.mockResolvedValue(0);
    mockedRepo.delete.mockResolvedValue(slot);
    await SlotService.remove(1);
    expect(mockedRepo.delete).toHaveBeenCalledWith(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- tests/unit/services/slot.service.test.ts`
Expected: FAIL — cannot find module `../../../src/services/slot.service`.

- [ ] **Step 3: Write `src/services/slot.service.ts`**

```ts
import { SlotRepository } from '../repositories/slot.repository';
import { NotFoundError, ConflictError } from '../errors/AppError';
import { TimeSlot } from '@prisma/client';

export const SlotService = {
  listActive(): Promise<TimeSlot[]> {
    return SlotRepository.findAllActive();
  },

  listAll(): Promise<TimeSlot[]> {
    return SlotRepository.findAll();
  },

  create(input: {
    label: string;
    startTime: string;
    durationMinutes?: number;
    isActive?: boolean;
  }): Promise<TimeSlot> {
    return SlotRepository.create(input);
  },

  async update(
    id: number,
    input: { label?: string; startTime?: string; durationMinutes?: number; isActive?: boolean },
  ): Promise<TimeSlot> {
    const existing = await SlotRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Time slot ${id} not found`);
    }
    return SlotRepository.update(id, input);
  },

  async remove(id: number): Promise<void> {
    const existing = await SlotRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Time slot ${id} not found`);
    }

    const futureBookings = await SlotRepository.countFutureConfirmedBookings(id);
    if (futureBookings > 0) {
      throw new ConflictError('Cannot delete a time slot with future confirmed bookings');
    }

    await SlotRepository.delete(id);
  },
};
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- tests/unit/services/slot.service.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/slot.service.ts tests/unit/services/slot.service.test.ts
git commit -m "feat: time slot service with CRUD and delete guard"
```

---

## Task 16: Slot Routes, Controllers, Schemas (public + admin) + Integration Tests

**Files:**
- Create: `src/schemas/slot.schema.ts`
- Create: `src/controllers/slot.controller.ts`
- Create: `src/routes/slot.routes.ts`
- Modify: `src/app.ts` (mount `slotRouter`)
- Test: `tests/integration/slots.test.ts`

**Interfaces:**
- Consumes: `SlotService` (Task 15), `authenticate` (Task 9).
- Produces: `slotRouter` at `/slots` (public), `/admin/slots`, `/admin/slots/:id`.

- [ ] **Step 1: Write `src/schemas/slot.schema.ts`**

```ts
import { z } from 'zod';

export const createSlotSchema = z.object({
  label: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:MM'),
  durationMinutes: z.coerce.number().int().positive().default(90),
  isActive: z.boolean().optional(),
});

export const updateSlotSchema = z.object({
  label: z.string().min(1).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const slotIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
export type UpdateSlotInput = z.infer<typeof updateSlotSchema>;
```

- [ ] **Step 2: Write `src/controllers/slot.controller.ts`**

```ts
import { RequestHandler } from 'express';
import { SlotService } from '../services/slot.service';
import { CreateSlotInput, UpdateSlotInput } from '../schemas/slot.schema';

export const listSlots: RequestHandler = async (_req, res, next) => {
  try {
    const slots = await SlotService.listActive();
    res.status(200).json(slots);
  } catch (err) {
    next(err);
  }
};

export const adminListSlots: RequestHandler = async (_req, res, next) => {
  try {
    const slots = await SlotService.listAll();
    res.status(200).json(slots);
  } catch (err) {
    next(err);
  }
};

export const createSlot: RequestHandler = async (req, res, next) => {
  try {
    const slot = await SlotService.create(req.body as CreateSlotInput);
    res.status(201).json(slot);
  } catch (err) {
    next(err);
  }
};

export const updateSlot: RequestHandler = async (req, res, next) => {
  try {
    const id = Number((req.params as unknown as { id: number }).id);
    const slot = await SlotService.update(id, req.body as UpdateSlotInput);
    res.status(200).json(slot);
  } catch (err) {
    next(err);
  }
};

export const deleteSlot: RequestHandler = async (req, res, next) => {
  try {
    const id = Number((req.params as unknown as { id: number }).id);
    await SlotService.remove(id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 3: Write `src/routes/slot.routes.ts`**

```ts
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validateBody, validateParams } from '../middleware/validate';
import { createSlotSchema, updateSlotSchema, slotIdParamSchema } from '../schemas/slot.schema';
import { listSlots, adminListSlots, createSlot, updateSlot, deleteSlot } from '../controllers/slot.controller';

export const slotRouter = Router();

slotRouter.get('/slots', listSlots);
slotRouter.get('/admin/slots', authenticate, adminListSlots);
slotRouter.post('/admin/slots', authenticate, validateBody(createSlotSchema), createSlot);
slotRouter.patch(
  '/admin/slots/:id',
  authenticate,
  validateParams(slotIdParamSchema),
  validateBody(updateSlotSchema),
  updateSlot,
);
slotRouter.delete('/admin/slots/:id', authenticate, validateParams(slotIdParamSchema), deleteSlot);
```

- [ ] **Step 4: Modify `src/app.ts`** — add the import and `app.use(slotRouter)` before `app.use(errorHandler)`.

- [ ] **Step 5: Write the failing integration test**

```ts
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDb } from './helpers/resetDb';
import { getAuthToken } from './helpers/getAuthToken';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Slots', () => {
  it('GET /slots returns only active slots, no auth required', async () => {
    await prisma.timeSlot.create({
      data: { label: 'Lunch', startTime: '12:00', durationMinutes: 90, isActive: true },
    });
    await prisma.timeSlot.create({
      data: { label: 'Old', startTime: '09:00', durationMinutes: 60, isActive: false },
    });

    const res = await request(app).get('/slots');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].label).toBe('Lunch');
  });

  it('admin can create, update, and delete a slot', async () => {
    const token = await getAuthToken(app);

    const createRes = await request(app)
      .post('/admin/slots')
      .set('Authorization', `Bearer ${token}`)
      .send({ label: 'Brunch', startTime: '10:00', durationMinutes: 60 });
    expect(createRes.status).toBe(201);
    const slotId = createRes.body.id;

    const updateRes = await request(app)
      .patch(`/admin/slots/${slotId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isActive: false });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.isActive).toBe(false);

    const deleteRes = await request(app)
      .delete(`/admin/slots/${slotId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(204);
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm run test:integration -- tests/integration/slots.test.ts`
Expected: 2 passed.

- [ ] **Step 7: Commit**

```bash
git add src/schemas/slot.schema.ts src/controllers/slot.controller.ts src/routes/slot.routes.ts src/app.ts tests/integration/slots.test.ts
git commit -m "feat: public and admin time slot routes with integration tests"
```

---

## Task 17: Booking Repository

**Files:**
- Create: `src/repositories/booking.repository.ts`

**Interfaces:**
- Consumes: `prisma` (Task 3).
- Produces: `BookingListFilters { date?: string; status?: 'confirmed'|'cancelled'; slotId?: number; page: number; pageSize: number }`, `CreateBookingData { date: Date; partySize: number; guestName: string; guestEmail: string; guestPhone?: string; notes?: string; tableId: number; slotId: number }`, `BookingRepository.{findById, findConflicting, create, updateStatus, updateTable, list, runInTransaction}`. `runInTransaction` is the **only** place `prisma.$transaction` is called anywhere in the codebase — services get transactional atomicity by calling it, never by importing `prisma` themselves. Consumed by `BookingService` (Tasks 18–19).

- [ ] **Step 1: Write `src/repositories/booking.repository.ts`**

```ts
import { prisma } from '../lib/prisma';
import { Booking, Prisma, PrismaClient } from '@prisma/client';

type DbClient = PrismaClient | Prisma.TransactionClient;

export interface BookingListFilters {
  date?: string;
  status?: 'confirmed' | 'cancelled';
  slotId?: number;
  page: number;
  pageSize: number;
}

export interface CreateBookingData {
  date: Date;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  tableId: number;
  slotId: number;
}

export const BookingRepository = {
  findById(id: string, db: DbClient = prisma): Promise<Booking | null> {
    return db.booking.findUnique({ where: { id } });
  },

  findConflicting(tableId: number, slotId: number, date: Date, db: DbClient = prisma): Promise<Booking | null> {
    return db.booking.findFirst({ where: { tableId, slotId, date, status: 'confirmed' } });
  },

  create(data: CreateBookingData, db: DbClient = prisma): Promise<Booking> {
    return db.booking.create({ data });
  },

  updateStatus(id: string, status: 'confirmed' | 'cancelled', db: DbClient = prisma): Promise<Booking> {
    return db.booking.update({ where: { id }, data: { status } });
  },

  updateTable(id: string, tableId: number, db: DbClient = prisma): Promise<Booking> {
    return db.booking.update({ where: { id }, data: { tableId } });
  },

  async list(filters: BookingListFilters): Promise<{ bookings: Booking[]; total: number }> {
    const where: Prisma.BookingWhereInput = {};
    if (filters.date) where.date = new Date(filters.date);
    if (filters.status) where.status = filters.status;
    if (filters.slotId) where.slotId = filters.slotId;

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  },

  runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  },
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/repositories/booking.repository.ts
git commit -m "feat: booking repository with transaction support"
```

---

## Task 18: Booking Service — `create()`

**Files:**
- Create: `src/services/booking.service.ts`
- Test: `tests/unit/services/booking.service.test.ts`

**Interfaces:**
- Consumes: `BookingRepository`, `TableRepository`, `SlotRepository` (Tasks 17, 11, 14), `ValidationError`, `NotFoundError`, `ConflictError` (Task 4).
- Produces: `CreateBookingInput { date: string; slotId: number; partySize: number; guestName: string; guestEmail: string; guestPhone?: string; notes?: string; tableId?: number }`, `BookingService.create(input): Promise<Booking>`. This is the object literal that Task 19 adds more methods to — do not create a second `BookingService` export.

- [ ] **Step 1: Write the failing test**

```ts
import { Prisma } from '@prisma/client';
import { BookingService } from '../../../src/services/booking.service';
import { BookingRepository } from '../../../src/repositories/booking.repository';
import { TableRepository } from '../../../src/repositories/table.repository';
import { SlotRepository } from '../../../src/repositories/slot.repository';
import { ValidationError, NotFoundError, ConflictError } from '../../../src/errors/AppError';

jest.mock('../../../src/repositories/booking.repository');
jest.mock('../../../src/repositories/table.repository');
jest.mock('../../../src/repositories/slot.repository');

const mockedBookingRepo = BookingRepository as jest.Mocked<typeof BookingRepository>;
const mockedTableRepo = TableRepository as jest.Mocked<typeof TableRepository>;
const mockedSlotRepo = SlotRepository as jest.Mocked<typeof SlotRepository>;

const activeSlot = {
  id: 1,
  label: 'Lunch',
  startTime: '12:00',
  durationMinutes: 90,
  isActive: true,
  createdAt: new Date(),
};

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().slice(0, 10);

const validInput = {
  date: tomorrowStr,
  slotId: 1,
  partySize: 2,
  guestName: 'Alice',
  guestEmail: 'alice@test.com',
};

beforeEach(() => {
  mockedBookingRepo.runInTransaction.mockImplementation((fn) => fn({} as Prisma.TransactionClient));
  mockedSlotRepo.findById.mockResolvedValue(activeSlot);
});

describe('BookingService.create', () => {
  it('auto-assigns the smallest fitting table when tableId is omitted', async () => {
    mockedTableRepo.existsWithCapacityAtLeast.mockResolvedValue(true);
    mockedTableRepo.findAvailable.mockResolvedValue([
      { id: 2, name: 'Table 2', capacity: 2, description: null, createdAt: new Date() },
      { id: 3, name: 'Table 3', capacity: 4, description: null, createdAt: new Date() },
    ]);
    mockedBookingRepo.create.mockResolvedValue({ id: 'uuid-1', tableId: 2 } as any);

    const result = await BookingService.create(validInput);

    expect(mockedBookingRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 2 }),
      expect.anything(),
    );
    expect(result.tableId).toBe(2);
  });

  it('creates a booking with a specific tableId when provided and available', async () => {
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue({
      id: 5,
      name: 'Table 5',
      capacity: 4,
      description: null,
      createdAt: new Date(),
    });
    mockedBookingRepo.create.mockResolvedValue({ id: 'uuid-2', tableId: 5 } as any);

    const result = await BookingService.create({ ...validInput, tableId: 5 });

    expect(result.tableId).toBe(5);
  });

  it('returns ConflictError when the chosen table is already booked at that slot+date', async () => {
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue(null);
    mockedTableRepo.findById.mockResolvedValue({
      id: 5,
      name: 'Table 5',
      capacity: 4,
      description: null,
      createdAt: new Date(),
    });

    await expect(BookingService.create({ ...validInput, tableId: 5 })).rejects.toThrow(ConflictError);
  });

  it('returns NotFoundError when the chosen tableId does not exist', async () => {
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue(null);
    mockedTableRepo.findById.mockResolvedValue(null);

    await expect(BookingService.create({ ...validInput, tableId: 999 })).rejects.toThrow(NotFoundError);
  });

  it('returns ConflictError when no tables are available for auto-assign', async () => {
    mockedTableRepo.existsWithCapacityAtLeast.mockResolvedValue(true);
    mockedTableRepo.findAvailable.mockResolvedValue([]);

    await expect(BookingService.create(validInput)).rejects.toThrow(ConflictError);
  });

  it('returns ValidationError when date is in the past', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await expect(
      BookingService.create({ ...validInput, date: yesterday.toISOString().slice(0, 10) }),
    ).rejects.toThrow(ValidationError);
  });

  it('returns ValidationError when partySize exceeds all table capacities', async () => {
    mockedTableRepo.existsWithCapacityAtLeast.mockResolvedValue(false);

    await expect(BookingService.create({ ...validInput, partySize: 50 })).rejects.toThrow(ValidationError);
  });

  it('returns NotFoundError when slotId does not exist', async () => {
    mockedSlotRepo.findById.mockResolvedValue(null);

    await expect(BookingService.create(validInput)).rejects.toThrow(NotFoundError);
  });

  it('returns NotFoundError when slot is inactive', async () => {
    mockedSlotRepo.findById.mockResolvedValue({ ...activeSlot, isActive: false });

    await expect(BookingService.create(validInput)).rejects.toThrow(NotFoundError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- tests/unit/services/booking.service.test.ts`
Expected: FAIL — cannot find module `../../../src/services/booking.service`.

- [ ] **Step 3: Write `src/services/booking.service.ts`**

```ts
import { Prisma, Booking } from '@prisma/client';
import { BookingRepository } from '../repositories/booking.repository';
import { TableRepository } from '../repositories/table.repository';
import { SlotRepository } from '../repositories/slot.repository';
import { ValidationError, NotFoundError, ConflictError } from '../errors/AppError';

export interface CreateBookingInput {
  date: string;
  slotId: number;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  tableId?: number;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function assignSpecificTable(
  tableId: number,
  slotId: number,
  date: Date,
  partySize: number,
  tx: Prisma.TransactionClient,
): Promise<number> {
  const table = await TableRepository.findAvailableWithSpecificTable(tableId, slotId, date, partySize, tx);
  if (table) return table.id;

  const exists = await TableRepository.findById(tableId, tx);
  if (!exists) {
    throw new NotFoundError(`Table ${tableId} not found`);
  }
  throw new ConflictError('Requested table is not available for this slot and date');
}

async function assignBestFitTable(
  slotId: number,
  date: Date,
  partySize: number,
  tx: Prisma.TransactionClient,
): Promise<number> {
  const capacityExists = await TableRepository.existsWithCapacityAtLeast(partySize, tx);
  if (!capacityExists) {
    throw new ValidationError('No table exists with enough capacity for this party size');
  }

  const candidates = await TableRepository.findAvailable(slotId, date, partySize, tx);
  if (candidates.length === 0) {
    throw new ConflictError('No tables available for the requested party size, slot, and date');
  }
  return candidates[0].id;
}

export const BookingService = {
  async create(input: CreateBookingInput): Promise<Booking> {
    const bookingDate = new Date(input.date);
    if (Number.isNaN(bookingDate.getTime()) || bookingDate < startOfToday()) {
      throw new ValidationError('date must be a valid, non-past date');
    }

    const slot = await SlotRepository.findById(input.slotId);
    if (!slot || !slot.isActive) {
      throw new NotFoundError('Time slot not found or inactive');
    }

    return BookingRepository.runInTransaction(async (tx) => {
      const assignedTableId = input.tableId
        ? await assignSpecificTable(input.tableId, input.slotId, bookingDate, input.partySize, tx)
        : await assignBestFitTable(input.slotId, bookingDate, input.partySize, tx);

      return BookingRepository.create(
        {
          date: bookingDate,
          partySize: input.partySize,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone,
          notes: input.notes,
          tableId: assignedTableId,
          slotId: input.slotId,
        },
        tx,
      );
    });
  },
};
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- tests/unit/services/booking.service.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/services/booking.service.ts tests/unit/services/booking.service.test.ts
git commit -m "feat: booking service create() with auto-assign and conflict detection"
```

---

## Task 19: Booking Service — `getById`, `cancel`, `adminUpdate`, `list`, `availableTables`

**Files:**
- Modify: `src/services/booking.service.ts` (add methods to the existing `BookingService` object)
- Modify: `tests/unit/services/booking.service.test.ts` (add test suites)

**Interfaces:**
- Consumes: same as Task 18, plus `Table` type from `@prisma/client`.
- Produces: `BookingService.{getById(id), cancel(id), adminUpdate(id, {status?, tableId?}), list(filters: BookingListFilters), availableTables(slotId, date, partySize)}`. Consumed by `booking.controller.ts` (Task 20) and admin booking controller (Task 21).

- [ ] **Step 1: Write the failing tests** (append to `tests/unit/services/booking.service.test.ts`)

```ts
import { NotFoundError, ConflictError } from '../../../src/errors/AppError';

describe('BookingService.getById', () => {
  it('returns the booking when found', async () => {
    mockedBookingRepo.findById.mockResolvedValue({ id: 'uuid-1' } as any);
    const result = await BookingService.getById('uuid-1');
    expect(result.id).toBe('uuid-1');
  });

  it('throws NotFoundError when not found', async () => {
    mockedBookingRepo.findById.mockResolvedValue(null);
    await expect(BookingService.getById('missing')).rejects.toThrow(NotFoundError);
  });
});

describe('BookingService.cancel', () => {
  it('sets status to cancelled', async () => {
    mockedBookingRepo.findById.mockResolvedValue({ id: 'uuid-1', status: 'confirmed' } as any);
    mockedBookingRepo.updateStatus.mockResolvedValue({ id: 'uuid-1', status: 'cancelled' } as any);
    const result = await BookingService.cancel('uuid-1');
    expect(result.status).toBe('cancelled');
  });

  it('throws NotFoundError when booking does not exist', async () => {
    mockedBookingRepo.findById.mockResolvedValue(null);
    await expect(BookingService.cancel('missing')).rejects.toThrow(NotFoundError);
  });
});

describe('BookingService.adminUpdate', () => {
  const existingBooking = {
    id: 'uuid-1',
    tableId: 2,
    slotId: 1,
    date: new Date(),
    partySize: 2,
    status: 'confirmed',
  } as any;

  it('cancels the booking when status is cancelled', async () => {
    mockedBookingRepo.findById.mockResolvedValue(existingBooking);
    mockedBookingRepo.updateStatus.mockResolvedValue({ ...existingBooking, status: 'cancelled' });
    const result = await BookingService.adminUpdate('uuid-1', { status: 'cancelled' });
    expect(result.status).toBe('cancelled');
  });

  it('reassigns the table when tableId is provided and available', async () => {
    mockedBookingRepo.findById.mockResolvedValue(existingBooking);
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue({
      id: 7,
      name: 'Table 7',
      capacity: 4,
      description: null,
      createdAt: new Date(),
    });
    mockedBookingRepo.updateTable.mockResolvedValue({ ...existingBooking, tableId: 7 });
    const result = await BookingService.adminUpdate('uuid-1', { tableId: 7 });
    expect(result.tableId).toBe(7);
  });

  it('throws ConflictError when the new table is unavailable', async () => {
    mockedBookingRepo.findById.mockResolvedValue(existingBooking);
    mockedTableRepo.findAvailableWithSpecificTable.mockResolvedValue(null);
    await expect(BookingService.adminUpdate('uuid-1', { tableId: 9 })).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when booking does not exist', async () => {
    mockedBookingRepo.findById.mockResolvedValue(null);
    await expect(BookingService.adminUpdate('missing', { status: 'cancelled' })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('BookingService.availableTables', () => {
  it('throws NotFoundError when slot is inactive', async () => {
    mockedSlotRepo.findById.mockResolvedValue({ ...activeSlot, isActive: false });
    await expect(BookingService.availableTables(1, tomorrowStr, 2)).rejects.toThrow(NotFoundError);
  });

  it('returns available tables for an active slot', async () => {
    mockedSlotRepo.findById.mockResolvedValue(activeSlot);
    mockedTableRepo.findAvailable.mockResolvedValue([
      { id: 2, name: 'Table 2', capacity: 2, description: null, createdAt: new Date() },
    ]);
    const result = await BookingService.availableTables(1, tomorrowStr, 2);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify the new tests fail**

Run: `npm run test:unit -- tests/unit/services/booking.service.test.ts`
Expected: FAIL — `BookingService.getById is not a function` (and similar for the other new methods).

- [ ] **Step 3: Modify `src/services/booking.service.ts`** — add these methods inside the existing `BookingService` object literal (after `create`), and add `Table` to the `@prisma/client` import:

```ts
import { Prisma, Booking, Table } from '@prisma/client';
import { BookingRepository, BookingListFilters } from '../repositories/booking.repository';
```

```ts
  async getById(id: string): Promise<Booking> {
    const booking = await BookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError(`Booking ${id} not found`);
    }
    return booking;
  },

  async cancel(id: string): Promise<Booking> {
    const booking = await BookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError(`Booking ${id} not found`);
    }
    return BookingRepository.updateStatus(id, 'cancelled');
  },

  async adminUpdate(id: string, input: { status?: 'cancelled'; tableId?: number }): Promise<Booking> {
    const booking = await BookingRepository.findById(id);
    if (!booking) {
      throw new NotFoundError(`Booking ${id} not found`);
    }

    if (input.status === 'cancelled') {
      return BookingRepository.updateStatus(id, 'cancelled');
    }

    if (input.tableId) {
      if (input.tableId === booking.tableId) {
        return booking;
      }
      const available = await TableRepository.findAvailableWithSpecificTable(
        input.tableId,
        booking.slotId,
        booking.date,
        booking.partySize,
      );
      if (!available) {
        throw new ConflictError('Requested table is not available for this slot and date');
      }
      return BookingRepository.updateTable(id, input.tableId);
    }

    return booking;
  },

  async list(filters: BookingListFilters): Promise<{ bookings: Booking[]; total: number }> {
    return BookingRepository.list(filters);
  },

  async availableTables(slotId: number, date: string, partySize: number): Promise<Table[]> {
    const slot = await SlotRepository.findById(slotId);
    if (!slot || !slot.isActive) {
      throw new NotFoundError('Time slot not found or inactive');
    }
    return TableRepository.findAvailable(slotId, new Date(date), partySize);
  },
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:unit -- tests/unit/services/booking.service.test.ts`
Expected: 18 passed.

- [ ] **Step 5: Run the full unit suite with coverage to check the 80% gate**

Run: `npm run test:unit -- --coverage`
Expected: all suites pass; `src/services/**` coverage ≥ 80% branches/functions/lines/statements.

- [ ] **Step 6: Commit**

```bash
git add src/services/booking.service.ts tests/unit/services/booking.service.test.ts
git commit -m "feat: booking service getById/cancel/adminUpdate/list/availableTables"
```

---

## Task 20: Public Booking & Availability Routes, Controllers, Schemas + Integration Tests

**Files:**
- Create: `src/schemas/booking.schema.ts`
- Create: `src/controllers/booking.controller.ts`
- Create: `src/routes/booking.routes.ts`
- Modify: `src/app.ts` (mount `bookingRouter`)
- Test: `tests/integration/bookings.test.ts`

**Interfaces:**
- Consumes: `BookingService` (Tasks 18–19).
- Produces: `bookingRouter` at `GET /tables/available`, `POST /bookings`, `GET /bookings/:id`, `DELETE /bookings/:id`. `createBooking`, `getBooking`, `cancelBooking`, `getAvailableTables` controller functions — `adminListBookings`/`adminGetBooking`/`adminUpdateBooking` are added to this same `booking.controller.ts` file in Task 21, not duplicated.

- [ ] **Step 1: Write `src/schemas/booking.schema.ts`**

```ts
import { z } from 'zod';

export const createBookingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  slotId: z.coerce.number().int().positive(),
  partySize: z.coerce.number().int().positive(),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  notes: z.string().optional(),
  tableId: z.coerce.number().int().positive().optional(),
});

export const bookingIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const availableTablesQuerySchema = z.object({
  slotId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().positive(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
```

- [ ] **Step 2: Write `src/controllers/booking.controller.ts`**

```ts
import { RequestHandler } from 'express';
import { BookingService } from '../services/booking.service';
import { CreateBookingInput } from '../schemas/booking.schema';

export const createBooking: RequestHandler = async (req, res, next) => {
  try {
    const booking = await BookingService.create(req.body as CreateBookingInput);
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
};

export const getBooking: RequestHandler = async (req, res, next) => {
  try {
    const booking = await BookingService.getById((req.params as unknown as { id: string }).id);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
};

export const cancelBooking: RequestHandler = async (req, res, next) => {
  try {
    await BookingService.cancel((req.params as unknown as { id: string }).id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

export const getAvailableTables: RequestHandler = async (req, res, next) => {
  try {
    const { slotId, date, partySize } = req.query as unknown as {
      slotId: number;
      date: string;
      partySize: number;
    };
    const tables = await BookingService.availableTables(slotId, date, partySize);
    res.status(200).json(tables);
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 3: Write `src/routes/booking.routes.ts`**

```ts
import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../middleware/validate';
import { createBookingSchema, bookingIdParamSchema, availableTablesQuerySchema } from '../schemas/booking.schema';
import { createBooking, getBooking, cancelBooking, getAvailableTables } from '../controllers/booking.controller';

export const bookingRouter = Router();

bookingRouter.get('/tables/available', validateQuery(availableTablesQuerySchema), getAvailableTables);
bookingRouter.post('/bookings', validateBody(createBookingSchema), createBooking);
bookingRouter.get('/bookings/:id', validateParams(bookingIdParamSchema), getBooking);
bookingRouter.delete('/bookings/:id', validateParams(bookingIdParamSchema), cancelBooking);
```

- [ ] **Step 4: Modify `src/app.ts`** — add the import and `app.use(bookingRouter)` before `app.use(errorHandler)`.

- [ ] **Step 5: Write the failing integration test**

```ts
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDb } from './helpers/resetDb';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function seedTableAndSlot() {
  const table = await prisma.table.create({ data: { name: 'Table 1', capacity: 4 } });
  const slot = await prisma.timeSlot.create({
    data: { label: 'Lunch', startTime: '12:00', durationMinutes: 90, isActive: true },
  });
  return { table, slot };
}

function tomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('POST /bookings', () => {
  it('creates a booking end-to-end and assigns a table', async () => {
    const { slot } = await seedTableAndSlot();
    const res = await request(app).post('/bookings').send({
      date: tomorrow(),
      slotId: slot.id,
      partySize: 2,
      guestName: 'Alice',
      guestEmail: 'alice@test.com',
    });
    expect(res.status).toBe(201);
    expect(res.body.tableId).toEqual(expect.any(Number));
    expect(res.body.status).toBe('confirmed');
  });

  it('returns 409 when the same table+slot+date is booked twice', async () => {
    const { table, slot } = await seedTableAndSlot();
    const first = await request(app).post('/bookings').send({
      date: tomorrow(),
      slotId: slot.id,
      partySize: 2,
      guestName: 'Alice',
      guestEmail: 'alice@test.com',
      tableId: table.id,
    });
    expect(first.status).toBe(201);

    const second = await request(app).post('/bookings').send({
      date: tomorrow(),
      slotId: slot.id,
      partySize: 2,
      guestName: 'Bob',
      guestEmail: 'bob@test.com',
      tableId: table.id,
    });
    expect(second.status).toBe(409);
  });

  it('returns 422 for an invalid body', async () => {
    const res = await request(app).post('/bookings').send({ date: 'not-a-date' });
    expect(res.status).toBe(422);
  });
});

describe('GET /bookings/:id and DELETE /bookings/:id', () => {
  it('fetches and then cancels a booking by id', async () => {
    const { slot } = await seedTableAndSlot();
    const createRes = await request(app).post('/bookings').send({
      date: tomorrow(),
      slotId: slot.id,
      partySize: 2,
      guestName: 'Alice',
      guestEmail: 'alice@test.com',
    });
    const id = createRes.body.id;

    const getRes = await request(app).get(`/bookings/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(id);

    const deleteRes = await request(app).delete(`/bookings/${id}`);
    expect(deleteRes.status).toBe(204);

    const afterDelete = await request(app).get(`/bookings/${id}`);
    expect(afterDelete.body.status).toBe('cancelled');
  });

  it('returns 404 for a non-existent booking id', async () => {
    const res = await request(app).get('/bookings/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm run test:integration -- tests/integration/bookings.test.ts`
Expected: 5 passed.

- [ ] **Step 7: Commit**

```bash
git add src/schemas/booking.schema.ts src/controllers/booking.controller.ts src/routes/booking.routes.ts src/app.ts tests/integration/bookings.test.ts
git commit -m "feat: public booking and availability routes with integration tests"
```

---

## Task 21: Admin Booking Routes, Controllers, Schemas + Integration Tests

**Files:**
- Modify: `src/schemas/booking.schema.ts` (add admin schemas)
- Modify: `src/controllers/booking.controller.ts` (add admin controller functions)
- Create: `src/routes/adminBooking.routes.ts`
- Modify: `src/app.ts` (mount `adminBookingRouter`)
- Test: `tests/integration/admin-bookings.test.ts`

**Interfaces:**
- Consumes: `BookingService.{list, getById, adminUpdate}` (Task 19), `authenticate` (Task 9).
- Produces: `adminBookingRouter` at `GET /admin/bookings`, `GET /admin/bookings/:id`, `PATCH /admin/bookings/:id`.

- [ ] **Step 1: Modify `src/schemas/booking.schema.ts`** — append:

```ts
export const adminListBookingsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
  slotId: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

export const adminUpdateBookingSchema = z
  .object({
    status: z.literal('cancelled').optional(),
    tableId: z.coerce.number().int().positive().optional(),
  })
  .refine((data) => data.status !== undefined || data.tableId !== undefined, {
    message: 'Either status or tableId must be provided',
  });
```

- [ ] **Step 2: Modify `src/controllers/booking.controller.ts`** — append:

```ts
export const adminListBookings: RequestHandler = async (req, res, next) => {
  try {
    const { date, status, slotId, page, pageSize } = req.query as unknown as {
      date?: string;
      status?: 'confirmed' | 'cancelled';
      slotId?: number;
      page: number;
      pageSize: number;
    };
    const result = await BookingService.list({ date, status, slotId, page, pageSize });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

export const adminGetBooking: RequestHandler = async (req, res, next) => {
  try {
    const booking = await BookingService.getById((req.params as unknown as { id: string }).id);
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
};

export const adminUpdateBooking: RequestHandler = async (req, res, next) => {
  try {
    const booking = await BookingService.adminUpdate(
      (req.params as unknown as { id: string }).id,
      req.body as { status?: 'cancelled'; tableId?: number },
    );
    res.status(200).json(booking);
  } catch (err) {
    next(err);
  }
};
```

- [ ] **Step 3: Write `src/routes/adminBooking.routes.ts`**

```ts
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { validateParams, validateQuery, validateBody } from '../middleware/validate';
import {
  bookingIdParamSchema,
  adminListBookingsQuerySchema,
  adminUpdateBookingSchema,
} from '../schemas/booking.schema';
import { adminListBookings, adminGetBooking, adminUpdateBooking } from '../controllers/booking.controller';

export const adminBookingRouter = Router();

adminBookingRouter.get(
  '/admin/bookings',
  authenticate,
  validateQuery(adminListBookingsQuerySchema),
  adminListBookings,
);
adminBookingRouter.get(
  '/admin/bookings/:id',
  authenticate,
  validateParams(bookingIdParamSchema),
  adminGetBooking,
);
adminBookingRouter.patch(
  '/admin/bookings/:id',
  authenticate,
  validateParams(bookingIdParamSchema),
  validateBody(adminUpdateBookingSchema),
  adminUpdateBooking,
);
```

- [ ] **Step 4: Modify `src/app.ts`** — add the import and `app.use(adminBookingRouter)` before `app.use(errorHandler)`.

- [ ] **Step 5: Write the failing integration test**

```ts
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDb } from './helpers/resetDb';
import { getAuthToken } from './helpers/getAuthToken';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Admin booking management', () => {
  it('returns 401 for GET /admin/bookings without a token', async () => {
    const res = await request(app).get('/admin/bookings');
    expect(res.status).toBe(401);
  });

  it('logs in then lists bookings with a valid token', async () => {
    const token = await getAuthToken(app);

    const res = await request(app).get('/admin/bookings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ bookings: [], total: 0 });
  });

  it('cancels a booking via PATCH', async () => {
    const token = await getAuthToken(app);
    const table = await prisma.table.create({ data: { name: 'Table 1', capacity: 4 } });
    const slot = await prisma.timeSlot.create({
      data: { label: 'Lunch', startTime: '12:00', durationMinutes: 90 },
    });
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1);
    const booking = await prisma.booking.create({
      data: {
        date: futureDate,
        partySize: 2,
        guestName: 'Guest',
        guestEmail: 'guest@test.com',
        tableId: table.id,
        slotId: slot.id,
      },
    });

    const res = await request(app)
      .patch(`/admin/bookings/${booking.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('cancelled');
  });
});
```

- [ ] **Step 6: Run it**

Run: `npm run test:integration -- tests/integration/admin-bookings.test.ts`
Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add src/schemas/booking.schema.ts src/controllers/booking.controller.ts src/routes/adminBooking.routes.ts src/app.ts tests/integration/admin-bookings.test.ts
git commit -m "feat: admin booking routes with integration tests"
```

---

## Task 22: Final Wiring Check

**Files:**
- Modify: `src/app.ts` (verify final mount order)
- Test: `tests/integration/routes-smoke.test.ts`

**Interfaces:**
- Consumes: every router from Tasks 5, 10, 13, 16, 20, 21.
- Produces: nothing new — this task only verifies the wiring is complete and correctly ordered.

- [ ] **Step 1: Read `src/app.ts` and confirm it matches this final shape** (reorder/add imports if any task above landed them differently):

```ts
import express, { Express } from 'express';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { tableRouter } from './routes/table.routes';
import { slotRouter } from './routes/slot.routes';
import { bookingRouter } from './routes/booking.routes';
import { adminBookingRouter } from './routes/adminBooking.routes';
import { errorHandler } from './middleware/errorHandler';
import './types/express';

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(healthRouter);
  app.use(authRouter);
  app.use(tableRouter);
  app.use(slotRouter);
  app.use(bookingRouter);
  app.use(adminBookingRouter);
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 2: Write the failing smoke test**

```ts
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { resetDb } from './helpers/resetDb';

const app = createApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('Route table smoke test', () => {
  it('every documented route is reachable (not 404)', async () => {
    const checks: Array<[string, () => Promise<request.Response>]> = [
      ['GET /health', () => request(app).get('/health')],
      ['POST /auth/login', () => request(app).post('/auth/login').send({})],
      ['GET /slots', () => request(app).get('/slots')],
      ['GET /tables/available', () => request(app).get('/tables/available')],
      ['POST /bookings', () => request(app).post('/bookings').send({})],
      ['GET /admin/tables', () => request(app).get('/admin/tables')],
      ['GET /admin/slots', () => request(app).get('/admin/slots')],
      ['GET /admin/bookings', () => request(app).get('/admin/bookings')],
    ];

    for (const [name, run] of checks) {
      const res = await run();
      expect(res.status, `${name} returned 404`).not.toBe(404);
    }
  });
});
```

- [ ] **Step 3: Run it**

Run: `npm run test:integration -- tests/integration/routes-smoke.test.ts`
Expected: 1 passed.

- [ ] **Step 4: Run the full test suite end-to-end**

Run: `npm run test:unit -- --coverage && npm run test:integration`
Expected: all unit and integration suites pass; coverage gate on `src/services/**` met.

- [ ] **Step 5: Commit**

```bash
git add src/app.ts tests/integration/routes-smoke.test.ts
git commit -m "test: route table smoke test confirming full wiring"
```

---

## Task 23: Local Dev Seed Script

**Files:**
- Create: `prisma/seed.ts`

**Interfaces:**
- Consumes: `prisma` client directly (seed scripts are a Prisma-blessed exception to the "only repositories touch prisma" rule, since they run standalone outside the app's request lifecycle).
- Produces: `npx prisma db seed` populates one admin (`admin@restaurant.com` / `admin123`), 3 time slots, 5 tables — for manual local testing via `docker compose up`.

- [ ] **Step 1: Write `prisma/seed.ts`**

```ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.admin.upsert({
    where: { email: 'admin@restaurant.com' },
    update: {},
    create: { email: 'admin@restaurant.com', passwordHash },
  });

  await prisma.timeSlot.createMany({
    data: [
      { label: 'Lunch 12:00', startTime: '12:00', durationMinutes: 90, isActive: true },
      { label: 'Dinner 18:00', startTime: '18:00', durationMinutes: 90, isActive: true },
      { label: 'Dinner 20:00', startTime: '20:00', durationMinutes: 90, isActive: true },
    ],
    skipDuplicates: true,
  });

  await prisma.table.createMany({
    data: [
      { name: 'Table 1', capacity: 2 },
      { name: 'Table 2', capacity: 2 },
      { name: 'Table 3', capacity: 4 },
      { name: 'Table 4', capacity: 4 },
      { name: 'Table 5', capacity: 6 },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Run it against the local dev DB**

Run: `npx prisma db seed`
Expected: no errors; `docker compose exec postgres psql -U postgres -d booking_api -c 'select email from admins;'` shows `admin@restaurant.com`.

- [ ] **Step 3: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: local dev seed script"
```
