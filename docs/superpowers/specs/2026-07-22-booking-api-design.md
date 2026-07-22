# Booking/Reservation API — Design Spec

**Date:** 2026-07-22
**Status:** Approved — ready for implementation planning

## Context & Goals

A restaurant table booking/reservation REST API, built as a deliberate exercise in engineering discipline — the counterpart to TJ's Kebab Centre (a live production app built fast, without tests/CI/CD, which suffered a leaked Firebase API key). This project applies the lessons learned: secrets management from commit one, layered architecture, automated testing, CI/CD, and infrastructure as code.

The domain (restaurant table bookings) is intentionally the same one already understood from TJ's Kebab, so effort goes into engineering quality rather than learning a new domain.

## Stack

- **Runtime/Language:** Node.js + TypeScript
- **Framework:** Express
- **Database:** PostgreSQL, accessed via Prisma (migrations, not manual SQL)
- **Validation:** Zod
- **Testing:** Jest (unit) + Supertest (integration, against a Dockerized test Postgres)
- **CI/CD:** GitHub Actions
- **Containerization:** Docker (multi-stage) + docker-compose for local dev
- **Infrastructure:** Terraform, targeting Oracle Cloud Infrastructure (OCI)

## Section 1 — Entities & ER Diagram

Five core entities:

**`Table`** — a physical table in the restaurant
`id, name (e.g. "Table 4"), capacity (int), description (nullable), created_at`

**`TimeSlot`** — a recurring daily slot the restaurant offers
`id, label (e.g. "Lunch 12:00"), start_time (TIME), duration_minutes (int, default 90), is_active (bool), created_at`

**`Booking`** — a reservation joining a guest to a table at a slot on a date
`id (UUID), date (DATE), status (enum: confirmed | cancelled), party_size (int), guest_name, guest_email, guest_phone (nullable), notes (nullable), table_id (FK → Table), slot_id (FK → TimeSlot), created_at, updated_at`

`id` is a UUID, not a sequential integer — `GET/DELETE /bookings/:id` are unauthenticated by design (guest self-service), so the ID itself is the only thing standing between a guest and someone else's booking. A sequential ID would make bookings enumerable/guessable; a UUID doesn't.

**`Admin`** — restaurant staff who can manage bookings and tables
`id, email (unique), password_hash, created_at`

**`RefreshToken`** — for JWT refresh flow
`id, token_hash, admin_id (FK → Admin), expires_at, revoked (bool)`

No `Customer` entity — guests are captured inline on `Booking`. Repeat customer tracking is explicitly out of scope for v1.

## Section 2 — API Endpoints

Grouped by actor. All `/admin/*` routes require `Authorization: Bearer <accessToken>`.

**Auth (admin only)**
```
POST   /auth/login          Body: { email, password } → { accessToken, refreshToken }
POST   /auth/refresh        Body: { refreshToken }     → { accessToken }
POST   /auth/logout         Body: { refreshToken }     → 204
```

**Public — slots & availability**
```
GET    /slots                              → list of active time slots
GET    /tables/available                   ?slotId=&date=&partySize= → available tables
```

**Public — bookings (guest, no auth)**
```
POST   /bookings            Body: { date, slotId, partySize, guestName, guestEmail, guestPhone?, notes?, tableId? }
                            → 201 booking (with assigned table)
                            → 409 if no table available / conflict
GET    /bookings/:id        → booking detail (for confirmation page)
DELETE /bookings/:id        → cancel (guest self-cancel by ID)
```

**Admin — booking management**
```
GET    /admin/bookings      ?date=&status=&slotId= → paginated list
GET    /admin/bookings/:id  → full booking detail
PATCH  /admin/bookings/:id  Body: { status: 'cancelled' } | { tableId } → updated booking
```

**Admin — table management**
```
GET    /admin/tables        → all tables
POST   /admin/tables        Body: { name, capacity, description? }
PATCH  /admin/tables/:id    Body: { name?, capacity?, description? }
DELETE /admin/tables/:id    → 204 (blocked if table has future confirmed bookings)
```

**Admin — slot management**
```
GET    /admin/slots         → all slots (including inactive)
POST   /admin/slots         Body: { label, startTime, durationMinutes, isActive? }
PATCH  /admin/slots/:id     Body: { label?, startTime?, durationMinutes?, isActive? }
DELETE /admin/slots/:id     → 204 (blocked if slot has future confirmed bookings)
```

**System**
```
GET    /health              → { status: 'ok', db: 'ok' }
```

**Booking status lifecycle:** `confirmed` on creation (system assigns table atomically) → `cancelled` by guest or admin. No `pending` state — if no table fits, the API returns 409 immediately.

## Section 3 — Architecture & Layer Responsibilities

Strict layered request flow, one direction only:

```
HTTP Request
  → routes/          (Express router — mounts middleware, calls controller)
  → controllers/     (parse req, call service, send res — NO logic)
  → services/        (all business rules, conflict detection, JWT logic)
  → repositories/    (Prisma queries only — NO business logic)
  → Prisma / PostgreSQL
```

**`routes/`** — Registers Express routes, attaches Zod validation middleware and `authenticate` middleware. No `req.body` parsing logic, no conditionals.

**`controllers/`** — Extracts validated input from `req`, calls exactly one service method, sends the response. A controller function is typically 5–8 lines.

**`services/`** — All business rules live here:
- `BookingService.create()` — validates date is future, slot is active, runs conflict check, auto-assigns or validates chosen table, creates booking in a single Prisma transaction
- Overlap query: existing booking on same table+slot+date where `status = confirmed`
- Auto-assign: find tables where `capacity >= partySize`, exclude those with confirmed bookings on that slot+date, pick smallest (best-fit)
- `AuthService.login()` — bcrypt compare, issue access JWT (15 min) + refresh JWT (7 days), store refresh token hash in DB

**`repositories/`** — One file per entity. Only Prisma calls, e.g. `BookingRepository.findConflicting(tableId, slotId, date)` returns raw data — no filtering, no business decisions.

**Table assignment:** `tableId` on `POST /bookings` is optional.
- Omitted → service auto-assigns best-fit table (smallest available table that fits party size)
- Provided → service validates that specific table is available and fits the party size, then assigns it

Both paths run through the same conflict-detection logic and the same atomic transaction.

**Validation:** Zod schemas in `src/schemas/`. Middleware runs `schema.parse(req.body)` and returns 422 with field errors on failure. Controllers receive already-validated, typed data.

**Error handling:** A single `errorHandler` Express middleware catches everything. Services throw typed errors (`NotFoundError`, `ConflictError`, `UnauthorizedError`, `ValidationError`) that map to HTTP status codes in one place.

**JWT strategy:** Short-lived access token (15 min, HS256, secret from env). Refresh token stored as a bcrypt hash in the `RefreshToken` table — revocable, expiry enforced in DB.

## Section 4 — Testing Strategy

Two layers, clearly separated.

**Unit tests — service layer only (Jest, no DB)**

Every service method tested in isolation; repositories mocked with `jest.fn()`. Fast (no I/O), and forces business logic to live only in the service layer — if it can't be unit tested without a DB, it's in the wrong layer.

Key `BookingService` cases:
- Creates booking and auto-assigns smallest fitting table when `tableId` omitted
- Creates booking with specific `tableId` when provided and available
- Returns `ConflictError` when chosen table already booked at that slot+date
- Returns `ConflictError` when no tables available for auto-assign
- Returns `ValidationError` when date is in the past
- Returns `ValidationError` when `partySize` exceeds all table capacities
- Returns `NotFoundError` when `slotId` doesn't exist or slot is inactive
- Overlap detection: booking at 18:00 for 90 min blocks 18:45 start on same table

**Integration tests — full HTTP stack (Jest + Supertest + Docker Postgres)**

Run against a real Postgres instance (Docker, separate test DB). Each suite runs migrations fresh, seeds minimal data, tears down after. Tests call the actual Express app via Supertest — no mocking.

Key flows:
- `POST /bookings` end-to-end: creates booking, returns 201 with table assigned
- `POST /bookings` conflict: second booking same slot+date+table returns 409
- `POST /auth/login` → `GET /admin/bookings` with valid token → 200
- `GET /admin/bookings` without token → 401
- `DELETE /admin/tables/:id` with future bookings → 409

**Coverage target:** 80% on service layer. Integration tests cover critical paths, not every edge case — that's what unit tests are for.

## Section 5 — Infrastructure

**Docker — two-stage build**

Stage 1 (`builder`): installs all dependencies, compiles TypeScript to `dist/`.
Stage 2 (`production`): copies only `dist/` and prod `node_modules` from builder. Final image has no TypeScript compiler, no dev dependencies.

`docker-compose.yml` for local dev runs two services: `app` (port 3000) + `postgres` (official `postgres:16` image, port 5432, named volume). `docker compose up` gives a fully working local environment.

**Environment variables — from commit one**

`.env.example` committed to git with every variable name and a safe placeholder value. `.env` gitignored. Application validates all required vars at startup using a Zod schema in `src/config/env.ts` — if `DATABASE_URL` or `JWT_SECRET` is missing, the process exits immediately with a clear error. No silent failures.

**GitHub Actions CI pipeline**

Three jobs, all must pass before merge:
1. `lint` — ESLint + Prettier check
2. `test` — spins up a Postgres service container, runs migrations, runs unit + integration tests, uploads coverage report
3. `build` — compiles TypeScript, builds Docker image, confirms it starts healthy

**OCI Deployment via Terraform**

Terraform provisions: one OCI Container Instance (A1 ARM, always-free tier), one OCI Autonomous Database (free tier Postgres-compatible), one OCI Registry repository for the Docker image. GitHub Actions `deploy` job (runs only on `main`) builds the image, pushes to OCI Registry, triggers a container restart. No manual console clicks after initial `terraform apply`.

OCI was chosen over AWS specifically for cost: the always-free tier (4 OCPUs + 24GB RAM, 200GB block storage, no 12-month expiry) covers running both the app and Postgres containers indefinitely at zero cost, versus AWS ECS Fargate (not free) and RDS (free for 12 months only, then ~$15/month).

## Out of Scope (v1)

- Customer accounts / login (guest booking only)
- Repeat-customer tracking or booking history lookup by guest
- `pending` booking state / admin manual confirmation workflow
- Any frontend (this is a pure REST backend)
- Email/SMS notifications on booking confirm/cancel
- Rate limiting / abuse prevention on public endpoints (`POST /bookings` is unauthenticated and unthrottled in v1)
