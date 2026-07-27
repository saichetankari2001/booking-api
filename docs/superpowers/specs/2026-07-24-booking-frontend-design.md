# Booking Frontend — Design Spec

**Date:** 2026-07-24
**Status:** Approved — ready for implementation planning

## Context & Goals

The backend (`docs/superpowers/specs/2026-07-22-booking-api-design.md`, implemented per `docs/superpowers/plans/2026-07-22-booking-api-core.md`) is a complete, tested, merged REST API for a restaurant table-booking system. This spec covers the frontend that consumes it: a guest-facing booking flow and an admin dashboard, combined into one React app.

The location precedent — a frontend living as a subfolder of the main repo — follows the same pattern used by a related project, TJ's Kebab Centre, which keeps its "merchant" app as a subfolder (`merchant/`) of its main repo. This project is deliberately lighter than TJ's Kebab Centre's frontend: no Framer Motion, no 3D, minimal animation.

## Section 1 — Scope

One combined React app in `frontend/`, not two separate apps. Admin routes are login-gated within the same app rather than deployed separately.

**Guest flow (public, no login):**

- `/` — pick date, party size, and time slot
- `/book` — shows available tables for the chosen date/party size/slot; guest fills in name, email, phone (optional), notes (optional); submits. The date/party size/slot chosen on `/` are passed to `/book` as URL query params (e.g. `/book?date=...&partySize=...&slotId=...`), not client-side-only state — so `/book` is directly linkable/reloadable and doesn't depend on navigation history.
- `/bookings/:id` — confirmation page showing booking details, with a cancel button

**Admin (behind login):**

- `/admin/login`
- `/admin/bookings` — list, filter (by date/status/slot), cancel or reassign a booking
- `/admin/tables` — CRUD
- `/admin/slots` — CRUD

## Section 2 — Visual System

Direction: **upscale & calm**, applied consistently across guest and admin (admin uses denser table/filter layouts, not a different visual language).

**Palette — "Terracotta & Linen":**

- Background: `#faf6f0` (warm off-white)
- Accent: `#b5502f` (terracotta)
- Text: `#2b2521` (charcoal)
- Border/neutral: `#e4dccf`

**Typography:** Fraunces (serif) for headings, Inter (sans) for body and UI text.

**Component style:** soft-rounded corners (~6px radius), generous whitespace, restrained shadows. Radix UI primitives (dialogs, dropdowns, tabs) styled to match — no default/unstyled Radix appearance.

**Imagery:** hero sections (primarily `/`) use the restaurant's own photography, not stock images. Photos are supplied by the restaurant owner; until supplied, the hero falls back to the text-only treatment (warm background, no image) — the layout must not depend on a photo being present.

**Motion:** minimal — simple CSS transitions for hover/focus states and fades only. No animation library, no 3D, no scroll-triggered effects.

**Validated against:** a real photo of the restaurant's dining area (wood tables/chairs, stone accent wall, warm tile) — the palette and warm/tactile direction were chosen with this space in mind, not picked in the abstract.

## Section 3 — Frontend Architecture

**Stack:** Vite + React + TypeScript. Tailwind CSS + Radix UI. React Router for routing.

**Data fetching:** TanStack Query for all server state (slots, tables, bookings, admin lists). Handles caching, loading/error states, and cache invalidation/refetch after mutations (booking creation, admin cancel/reassign, table/slot CRUD).

**Forms:** React Hook Form + Zod. Zod schemas in `frontend/src/lib/schemas/` mirror the backend's `src/schemas/` validation shapes (duplicated by hand — no shared package/monorepo tooling exists to share them directly).

**Admin authentication:**

- Access token held in-memory only, in a React context (`AdminAuthContext`) — never written to disk.
- Refresh token stored in `localStorage` (required to survive a page reload, since the access token doesn't).
- On app load, the admin area calls `POST /auth/refresh` once using the stored refresh token to silently re-establish a session if one exists. If it fails or no refresh token is present, the user is treated as logged out.
- A fetch/axios interceptor catches a single 401 response, attempts one refresh, retries the original request once, and redirects to `/admin/login` if that also fails.
- A `RequireAdmin` route wrapper blocks rendering of any `/admin/*` page (other than `/admin/login`) until the initial silent-refresh attempt resolves, then redirects to `/admin/login` if there's no valid access token.

**Folder structure:**

```
frontend/src/
  pages/          # Home, Book, BookingConfirmation, AdminLogin, AdminBookings, AdminTables, AdminSlots
  components/     # shared UI (Button, DatePicker, TableCard, etc.) — thin wrappers over Radix primitives
  api/            # bookings.ts, tables.ts, slots.ts, auth.ts — fetch calls + TanStack Query hooks
  context/        # AdminAuthContext
  lib/
    schemas/      # zod schemas mirroring backend validation
    dateUtils.ts
    apiClient.ts  # base fetch wrapper, injects Authorization header, handles 401 retry-once-then-redirect
  App.tsx         # router setup, mounts RequireAdmin around /admin/* routes
```

## Section 4 — Backend Addition (CORS)

The only backend change required: CORS middleware in `src/app.ts`, so the Vite dev server (`http://localhost:5173` in development) can call the API cross-origin.

- New env var `CORS_ORIGIN`, added to the Zod schema in `src/config/env.ts` and to `.env.example`. Defaults to `http://localhost:5173` in development; set to the deployed frontend's actual origin in production.
- No route, schema, or business-logic changes to the backend beyond this middleware and env var.

## Section 5 — Testing Strategy

**Frontend:** Vitest + React Testing Library.

- Component tests: form validation (booking form, admin table/slot CRUD forms) and key rendering states (available vs. no-availability, loading, error) for the pages that fetch data.
- Flow-level tests (API mocked via MSW): guest books a table end-to-end (`/` → `/book` → `/bookings/:id`); admin logs in and cancels a booking.

**CI integration:** wired into the existing `.github/workflows/ci.yml` rather than added as new jobs — frontend lint and test steps added alongside the backend's in the existing `lint`/`test` jobs, and a frontend build step added to the existing `build` job. One pipeline, no duplicate job scaffolding.

## Out of Scope (v1)

- SSR / Next.js — plain client-side Vite SPA
- Offline support / PWA
- Email confirmation UI (the backend doesn't send emails either, per the backend spec)
- Multi-restaurant / multi-tenant support — single restaurant, matching the backend
- A shared/published component library between this frontend and TJ's Kebab Centre's frontend, despite the shared subfolder-in-main-repo precedent
- Rate limiting / abuse prevention on the guest booking flow (inherited from backend scope — unauthenticated `POST /bookings` is unthrottled)
