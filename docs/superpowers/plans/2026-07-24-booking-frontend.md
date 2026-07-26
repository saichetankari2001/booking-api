# Booking Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the guest booking flow and admin dashboard as one combined React app (`frontend/`) consuming the existing booking-api backend, plus the one required backend change (CORS).

**Architecture:** Vite + React + TypeScript SPA. TanStack Query for all server state, React Hook Form + Zod for forms. Admin auth token held in-memory (React context) with a refresh token in `localStorage` and silent refresh on load. Same visual system (Terracotta & Linen palette, Fraunces/Inter type) across guest and admin, admin using denser list/filter layouts. Per `docs/superpowers/specs/2026-07-24-booking-frontend-design.md`.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Radix UI primitives, React Router, TanStack Query, React Hook Form, Zod, Vitest + React Testing Library + MSW.

## Global Constraints

- Frontend lives in `frontend/` inside this repo (not a separate repo/package).
- One combined app — admin routes are login-gated within the same app, not a separate deployment.
- No Framer Motion, no 3D, no animation library — CSS transitions only.
- Palette: background `#faf6f0`, accent (terracotta) `#b5502f`, text `#2b2521`, border `#e4dccf`. Headings: Fraunces. Body/UI: Inter. ~6px corner radius on components.
- Data fetching: TanStack Query only for server state — no other data-fetching library, no Redux/Zustand.
- Forms: React Hook Form + Zod only.
- Admin access token: in-memory only (React context), never written to `localStorage`/`sessionStorage`. Refresh token: `localStorage` only.
- The **only** backend change permitted is CORS middleware + a `CORS_ORIGIN` env var (Task 3). No route, schema, or business-logic changes to `src/` outside that.
- Backend response shapes are exactly what's defined in `src/schemas/*.ts`, `src/controllers/*.ts`, and Prisma models — verified against the running source in this plan, not assumed. In particular: `Booking` responses are the flat Prisma row (`id, date, status, partySize, guestName, guestEmail, guestPhone, notes, tableId, slotId, createdAt, updatedAt`) — **no nested `table`/`slot` objects**. There is no public "get table by id" or "list all tables" endpoint — only `GET /tables/available` (requires `slotId`+`date`+`partySize`) and the authenticated `GET /admin/tables`. Any guest-facing page that needs a table's name must either already have it from an available-tables response in the current flow, or fall back to showing `Table #{tableId}`.
- Error responses: Zod validation failures are `422 { error: 'ValidationError', fields: [{ path, message }] }`; typed `AppError`s are `{statusCode} { error: <ErrorName>, message }`; unhandled errors are `500 { error: 'InternalServerError', message }`.
- Testing: Vitest + React Testing Library for components, MSW for mocking the API in tests. Tests live in `frontend/tests/` (mirrors this repo's existing `tests/unit` / `tests/integration` split for the backend), not colocated with source.
- CI: frontend steps are added to the _existing_ `.github/workflows/ci.yml` jobs (`lint`, `test`, `build`) — no new jobs.
- **Deliberate deviations from the design spec's illustrative folder tree (Section 3):** the spec sketches `apiClient.ts` under `lib/` and shows `api/*.ts` files as owning "fetch calls + TanStack Query hooks" together. This plan instead puts `apiClient.ts` in `api/` (it's an API concern, not a general-purpose lib helper) and splits TanStack Query hooks into a parallel `hooks/` directory, one file per resource (`useSlots.ts`, `useBookings.ts`, `useAdminTables.ts`, etc.), keeping each `api/*.ts` file as plain fetch functions only. This keeps fetch logic independently testable without a React render, and hook files small and single-purpose. Functionally equivalent, purely a file-organization call — every consumer listed in this plan imports from the paths given here, not the spec's sketch. The spec's `lib/dateUtils.ts` is omitted: no task in this plan ends up needing date formatting/parsing beyond native `<input type="date">` values and raw `YYYY-MM-DD` strings passed straight through to the API, so there's nothing for it to contain (YAGNI) — add it if a real need shows up during implementation.
- **Hero photography (spec Section 2):** no photo asset exists yet, so Task 7 ships the text-only hero treatment the spec names as the graceful fallback. Dropping in a real photo later (e.g. a `background-image` on the existing hero container) needs no architecture change and is out of scope for this plan.

---

## Task 1: Frontend Scaffolding & Tooling

**Files:**

- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/vitest.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/postcss.config.js`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/eslint.config.mjs`
- Create: `frontend/.prettierrc`
- Create: `frontend/.gitignore`
- Create: `frontend/.env.example`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/pages/Home.tsx`
- Create: `frontend/tests/setup.ts`
- Test: `frontend/tests/unit/sanity.test.tsx`

**Interfaces:**

- Produces: npm scripts (`dev`, `build`, `lint`, `format`, `test`) in `frontend/package.json` that every later task relies on. `App.tsx` exports a default `App` component mounting a `BrowserRouter` — later tasks add routes to it.

- [ ] **Step 1: Write `frontend/package.json`**

```json
{
  "name": "booking-frontend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint . --max-warnings 0",
    "format": "prettier --check .",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.1",
    "@tanstack/react-query": "^5.51.23",
    "react-hook-form": "^7.52.2",
    "@hookform/resolvers": "^3.9.0",
    "zod": "^3.23.8",
    "@radix-ui/react-dialog": "^1.1.1",
    "@radix-ui/react-select": "^2.1.1",
    "@radix-ui/react-tabs": "^1.1.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.4",
    "vite": "^5.4.0",
    "vitest": "^2.0.5",
    "jsdom": "^24.1.1",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8",
    "@testing-library/user-event": "^14.5.2",
    "msw": "^2.3.5",
    "tailwindcss": "^3.4.10",
    "postcss": "^8.4.41",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.9.0",
    "@eslint/js": "^9.9.0",
    "typescript-eslint": "^8.1.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.9",
    "prettier": "^3.3.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `cd frontend && npm install`
Expected: installs cleanly, `frontend/node_modules/` created, `frontend/package-lock.json` created.

- [ ] **Step 3: Write `frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client", "vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 4: Write `frontend/tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 5: Write `frontend/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 6: Write `frontend/vitest.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 7: Write `frontend/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Book a Table</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8: Write `frontend/postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 9: Write `frontend/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#faf6f0',
        accent: '#b5502f',
        text: '#2b2521',
        border: '#e4dccf',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '6px',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 10: Write `frontend/eslint.config.mjs`**

```js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  {
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);
```

- [ ] **Step 11: Write `frontend/.prettierrc`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100
}
```

- [ ] **Step 12: Write `frontend/.gitignore`**

```
node_modules/
dist/
.env
coverage/
*.log
```

- [ ] **Step 13: Write `frontend/.env.example`**

```
VITE_API_BASE_URL=http://localhost:3000
```

- [ ] **Step 14: Write `frontend/src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=Inter:wght@400;500;600&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-background text-text font-sans;
}
```

- [ ] **Step 15: Write `frontend/src/pages/Home.tsx`** (placeholder — Task 7 replaces the body)

```tsx
export default function Home() {
  return <div className="p-6">Home</div>;
}
```

- [ ] **Step 16: Write `frontend/src/App.tsx`**

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 17: Write `frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 18: Write `frontend/tests/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 19: Write the sanity test `frontend/tests/unit/sanity.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../../src/App';

describe('App', () => {
  it('renders the home page at /', () => {
    render(<App />);
    expect(screen.getByText('Home')).toBeInTheDocument();
  });
});
```

- [ ] **Step 20: Run it**

Run: `cd frontend && npm test`
Expected: `sanity.test.tsx` passes, 1 passed.

- [ ] **Step 21: Type-check and lint**

Run: `cd frontend && npx tsc -b && npm run lint`
Expected: no errors.

- [ ] **Step 22: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/vitest.config.ts frontend/index.html frontend/postcss.config.js frontend/tailwind.config.ts frontend/eslint.config.mjs frontend/.prettierrc frontend/.gitignore frontend/.env.example frontend/src frontend/tests
git commit -m "chore: frontend scaffolding and tooling"
```

---

## Task 2: Design Tokens & Button Primitive

**Files:**

- Create: `frontend/src/lib/cn.ts`
- Create: `frontend/src/components/Button.tsx`
- Test: `frontend/tests/unit/components/Button.test.tsx`

**Interfaces:**

- Consumes: nothing.
- Produces: `cn(...classes: (string | false | undefined | null)[]): string`, `Button` component with props `{ variant?: 'primary' | 'secondary'; } & React.ButtonHTMLAttributes<HTMLButtonElement>`. Used by every later page/component task.

- [ ] **Step 1: Write `frontend/src/lib/cn.ts`**

```ts
export function cn(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
```

- [ ] **Step 2: Write the failing test `frontend/tests/unit/components/Button.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from '../../../src/components/Button';

describe('Button', () => {
  it('renders children and responds to click', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Check availability</Button>);
    const button = screen.getByRole('button', { name: 'Check availability' });
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies the secondary variant class', () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('border-accent');
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Submit</Button>);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npm test -- Button`
Expected: FAIL — cannot find module `../../../src/components/Button`.

- [ ] **Step 4: Write `frontend/src/components/Button.tsx`**

```tsx
import { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'rounded px-4 py-2 text-sm font-medium font-sans transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary' && 'bg-accent text-background hover:bg-accent/90',
        variant === 'secondary' &&
          'border border-accent text-accent bg-transparent hover:bg-accent/10',
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd frontend && npm test -- Button`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/cn.ts frontend/src/components/Button.tsx frontend/tests/unit/components/Button.test.tsx
git commit -m "feat(frontend): design tokens and Button primitive"
```

---

## Task 3: Backend CORS Middleware

**Files:**

- Modify: `src/config/env.ts`
- Modify: `.env.example`
- Modify: `.env.test.example`
- Modify: `src/app.ts`
- Modify: `package.json` (root, backend)
- Test: `tests/integration/cors.test.ts`

**Interfaces:**

- Consumes: `env` (existing).
- Produces: `env.CORS_ORIGIN: string`, CORS middleware mounted in `createApp()` before other routers. This is the only backend change in this plan — no other file under `src/` (outside `env.ts`/`app.ts`) is touched.

- [ ] **Step 1: Install `cors`**

Run: `npm install cors && npm install -D @types/cors`
Expected: `cors` added to `dependencies`, `@types/cors` added to `devDependencies` in the root `package.json`.

- [ ] **Step 2: Write the failing test `tests/integration/cors.test.ts`**

```ts
import request from 'supertest';
import { createApp } from '../../src/app';

const app = createApp();

describe('CORS', () => {
  it('reflects an allowed origin in Access-Control-Allow-Origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('responds to a preflight OPTIONS request', async () => {
    const res = await request(app)
      .options('/bookings')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test:integration -- tests/integration/cors.test.ts`
Expected: FAIL — `access-control-allow-origin` header is `undefined`.

- [ ] **Step 4: Modify `src/config/env.ts`** — add `CORS_ORIGIN` to the schema

```ts
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(7),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});
```

(Only the `envSchema` object changes — the rest of `env.ts` is unchanged.)

- [ ] **Step 5: Modify `.env.example`** — append

```
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 6: Modify `.env.test.example`** — append

```
CORS_ORIGIN=http://localhost:5173
```

- [ ] **Step 7: Modify `src/app.ts`** — mount `cors()` first, before `express.json()`

```ts
import express, { Express } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health.routes';
import { authRouter } from './routes/auth.routes';
import { tableRouter } from './routes/table.routes';
import { slotRouter } from './routes/slot.routes';
import { bookingRouter } from './routes/booking.routes';
import { adminBookingRouter } from './routes/adminBooking.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();
  app.use(cors({ origin: env.CORS_ORIGIN }));
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

- [ ] **Step 8: Run it to verify it passes**

Run: `npm run test:integration -- tests/integration/cors.test.ts`
Expected: 2 passed.

- [ ] **Step 9: Run the full backend test suite to confirm no regressions**

Run: `npm run test:unit && npm run test:integration`
Expected: all existing suites still pass.

- [ ] **Step 10: Commit**

```bash
git add src/config/env.ts src/app.ts .env.example .env.test.example package.json package-lock.json tests/integration/cors.test.ts
git commit -m "feat: add CORS middleware for frontend dev server"
```

---

## Task 4: API Client Core

**Files:**

- Create: `frontend/src/api/apiClient.ts`
- Modify: `frontend/tests/setup.ts`
- Test: `frontend/tests/unit/api/apiClient.test.ts`

**Interfaces:**

- Consumes: `import.meta.env.VITE_API_BASE_URL`.
- Produces: `ApiError` (has `status: number`, `body: unknown`), `request<T>(path: string, options?: RequestOptions): Promise<T>`, `setAuthHandlers(handlers: AuthHandlers): void`, `clearAuthHandlers(): void`. `RequestOptions extends RequestInit` adds `authenticated?: boolean`. `AuthHandlers` has `getAccessToken(): string | null`, `refreshAccessToken(): Promise<string | null>`, `onAuthFailure(): void`. Every later `api/*.ts` module (Tasks 6, 8, 11, 13, 14, 15) calls `request()`; `AdminAuthContext` (Task 11) calls `setAuthHandlers`.

- [ ] **Step 0: Modify `frontend/tests/setup.ts`** — stub `VITE_API_BASE_URL` for the whole test run, matching `frontend/.env.example`

```ts
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000');
```

- [ ] **Step 1: Write the failing test `frontend/tests/unit/api/apiClient.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request, ApiError, setAuthHandlers, clearAuthHandlers } from '../../../src/api/apiClient';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('apiClient.request', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearAuthHandlers();
  });

  it('returns parsed JSON on success', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 'ok' }));
    const result = await request<{ status: string }>('/health');
    expect(result).toEqual({ status: 'ok' });
  });

  it('returns undefined for a 204 response', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    const result = await request('/bookings/abc');
    expect(result).toBeUndefined();
  });

  it('throws ApiError with the status and message on a non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'NotFoundError', message: 'Booking not found' }, 404),
    );
    await expect(request('/bookings/missing')).rejects.toMatchObject({
      status: 404,
      message: 'Booking not found',
    });
  });

  it('does not attach an Authorization header when no auth handlers are registered', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
    await request('/admin/tables', { authenticated: true });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('attaches an Authorization header from getAccessToken when authenticated', async () => {
    setAuthHandlers({
      getAccessToken: () => 'token-123',
      refreshAccessToken: vi.fn(),
      onAuthFailure: vi.fn(),
    });
    vi.mocked(fetch).mockResolvedValue(jsonResponse([]));
    await request('/admin/tables', { authenticated: true });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer token-123');
  });

  it('refreshes once and retries on a 401, then succeeds', async () => {
    const refreshAccessToken = vi.fn().mockResolvedValue('new-token');
    setAuthHandlers({
      getAccessToken: () => 'stale-token',
      refreshAccessToken,
      onAuthFailure: vi.fn(),
    });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: 'UnauthorizedError', message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse([{ id: 1 }]));

    const result = await request<unknown[]>('/admin/tables', { authenticated: true });

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('calls onAuthFailure when refresh does not resolve the 401', async () => {
    const onAuthFailure = vi.fn();
    setAuthHandlers({
      getAccessToken: () => 'stale-token',
      refreshAccessToken: vi.fn().mockResolvedValue(null),
      onAuthFailure,
    });
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: 'UnauthorizedError', message: 'expired' }, 401),
    );

    await expect(request('/admin/tables', { authenticated: true })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npm test -- apiClient`
Expected: FAIL — cannot find module `../../../src/api/apiClient`.

- [ ] **Step 3: Write `frontend/src/api/apiClient.ts`**

```ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface AuthHandlers {
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  onAuthFailure: () => void;
}

let authHandlers: AuthHandlers | null = null;

export function setAuthHandlers(handlers: AuthHandlers): void {
  authHandlers = handlers;
}

export function clearAuthHandlers(): void {
  authHandlers = null;
}

export interface RequestOptions extends RequestInit {
  authenticated?: boolean;
}

async function doFetch(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  return fetch(`${API_BASE_URL}${path}`, { ...init, headers });
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) {
    return undefined as T;
  }
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : `Request failed with status ${res.status}`;
    throw new ApiError(res.status, body, message);
  }
  return body as T;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { authenticated, ...init } = options;
  const token = authenticated && authHandlers ? authHandlers.getAccessToken() : null;
  let res = await doFetch(path, init, token);

  if (authenticated && res.status === 401 && authHandlers) {
    const newToken = await authHandlers.refreshAccessToken();
    if (newToken) {
      res = await doFetch(path, init, newToken);
    }
    if (res.status === 401) {
      authHandlers.onAuthFailure();
    }
  }

  return parseResponse<T>(res);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && npm test -- apiClient`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/apiClient.ts frontend/tests/setup.ts frontend/tests/unit/api/apiClient.test.ts
git commit -m "feat(frontend): api client core with auth retry-once handling"
```

---

## Task 5: API Response Types & Form Validation Schemas

**Files:**

- Create: `frontend/src/api/types.ts`
- Create: `frontend/src/lib/schemas/booking.schema.ts`
- Create: `frontend/src/lib/schemas/table.schema.ts`
- Create: `frontend/src/lib/schemas/slot.schema.ts`
- Create: `frontend/src/lib/schemas/auth.schema.ts`
- Test: `frontend/tests/unit/lib/schemas/booking.schema.test.ts`
- Test: `frontend/tests/unit/lib/schemas/table.schema.test.ts`
- Test: `frontend/tests/unit/lib/schemas/slot.schema.test.ts`
- Test: `frontend/tests/unit/lib/schemas/auth.schema.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: types `Booking`, `Table`, `Slot`, `BookingStatus`, `AdminBookingListResponse`, `LoginResponse`, `RefreshResponse` (from `api/types.ts`) — used by every later `api/*.ts` module and page. `guestBookingFormSchema`, `GuestBookingFormInput` (from `lib/schemas/booking.schema.ts`) — used by Task 9. `createTableFormSchema`, `updateTableFormSchema` — used by Task 14. `createSlotFormSchema`, `updateSlotFormSchema` — used by Task 15. `loginFormSchema` — used by Task 12. No dedicated test for `types.ts` — it has no runtime behavior; exercised indirectly by every task that imports it.

- [ ] **Step 1: Write `frontend/src/api/types.ts`**

```ts
export type BookingStatus = 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  date: string;
  status: BookingStatus;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string | null;
  notes: string | null;
  tableId: number;
  slotId: number;
  createdAt: string;
  updatedAt: string;
}

export interface Table {
  id: number;
  name: string;
  capacity: number;
  description: string | null;
  createdAt: string;
}

export interface Slot {
  id: number;
  label: string;
  startTime: string;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export interface AdminBookingListResponse {
  bookings: Booking[];
  total: number;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
}
```

- [ ] **Step 2: Write the failing test `frontend/tests/unit/lib/schemas/booking.schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { guestBookingFormSchema } from '../../../../src/lib/schemas/booking.schema';

describe('guestBookingFormSchema', () => {
  it('accepts a valid guest booking form', () => {
    const result = guestBookingFormSchema.safeParse({
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
      guestPhone: '555-1234',
      notes: 'Window seat please',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an empty phone and notes (both optional)', () => {
    const result = guestBookingFormSchema.safeParse({
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = guestBookingFormSchema.safeParse({
      guestName: 'Jane Doe',
      guestEmail: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an empty guest name', () => {
    const result = guestBookingFormSchema.safeParse({
      guestName: '',
      guestEmail: 'jane@example.com',
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 3: Write the failing test `frontend/tests/unit/lib/schemas/table.schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  createTableFormSchema,
  updateTableFormSchema,
} from '../../../../src/lib/schemas/table.schema';

describe('table form schemas', () => {
  it('accepts a valid new table', () => {
    expect(
      createTableFormSchema.safeParse({ name: 'Table 4', capacity: 4, description: '' }).success,
    ).toBe(true);
  });

  it('rejects a non-positive capacity', () => {
    expect(createTableFormSchema.safeParse({ name: 'Table 4', capacity: 0 }).success).toBe(false);
  });

  it('allows a partial update', () => {
    expect(updateTableFormSchema.safeParse({ capacity: 6 }).success).toBe(true);
  });
});
```

- [ ] **Step 4: Write the failing test `frontend/tests/unit/lib/schemas/slot.schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import {
  createSlotFormSchema,
  updateSlotFormSchema,
} from '../../../../src/lib/schemas/slot.schema';

describe('slot form schemas', () => {
  it('accepts a valid new slot', () => {
    expect(
      createSlotFormSchema.safeParse({
        label: 'Lunch 12:00',
        startTime: '12:00',
        durationMinutes: 90,
        isActive: true,
      }).success,
    ).toBe(true);
  });

  it('rejects a malformed startTime', () => {
    expect(
      createSlotFormSchema.safeParse({ label: 'Lunch', startTime: '12pm', durationMinutes: 90 })
        .success,
    ).toBe(false);
  });

  it('allows a partial update', () => {
    expect(updateSlotFormSchema.safeParse({ isActive: false }).success).toBe(true);
  });
});
```

- [ ] **Step 5: Write the failing test `frontend/tests/unit/lib/schemas/auth.schema.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { loginFormSchema } from '../../../../src/lib/schemas/auth.schema';

describe('loginFormSchema', () => {
  it('accepts a valid login', () => {
    expect(
      loginFormSchema.safeParse({ email: 'admin@restaurant.com', password: 'password123' }).success,
    ).toBe(true);
  });

  it('rejects a missing password', () => {
    expect(loginFormSchema.safeParse({ email: 'admin@restaurant.com', password: '' }).success).toBe(
      false,
    );
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

Run: `cd frontend && npm test -- schemas`
Expected: FAIL — cannot find the four schema modules.

- [ ] **Step 7: Write `frontend/src/lib/schemas/booking.schema.ts`**

```ts
import { z } from 'zod';

export const guestBookingFormSchema = z.object({
  guestName: z.string().min(1, 'Name is required'),
  guestEmail: z.string().email('Enter a valid email'),
  guestPhone: z.string().optional(),
  notes: z.string().optional(),
});

export type GuestBookingFormInput = z.infer<typeof guestBookingFormSchema>;
```

- [ ] **Step 8: Write `frontend/src/lib/schemas/table.schema.ts`**

```ts
import { z } from 'zod';

export const createTableFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  capacity: z.coerce.number().int().positive('Capacity must be a positive number'),
  description: z.string().optional(),
});

export const updateTableFormSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  description: z.string().optional(),
});

export type CreateTableFormInput = z.infer<typeof createTableFormSchema>;
export type UpdateTableFormInput = z.infer<typeof updateTableFormSchema>;
```

- [ ] **Step 9: Write `frontend/src/lib/schemas/slot.schema.ts`**

```ts
import { z } from 'zod';

export const createSlotFormSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM format'),
  durationMinutes: z.coerce.number().int().positive().default(90),
  isActive: z.boolean().optional(),
});

export const updateSlotFormSchema = z.object({
  label: z.string().min(1).optional(),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'Use HH:MM format')
    .optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export type CreateSlotFormInput = z.infer<typeof createSlotFormSchema>;
export type UpdateSlotFormInput = z.infer<typeof updateSlotFormSchema>;
```

- [ ] **Step 10: Write `frontend/src/lib/schemas/auth.schema.ts`**

```ts
import { z } from 'zod';

export const loginFormSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormInput = z.infer<typeof loginFormSchema>;
```

- [ ] **Step 11: Run the tests to verify they pass**

Run: `cd frontend && npm test -- schemas`
Expected: 13 passed.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/api/types.ts frontend/src/lib/schemas frontend/tests/unit/lib/schemas
git commit -m "feat(frontend): api response types and form validation schemas"
```

---

## Task 6: Slots & Available-Tables API Modules, Query Hooks, MSW Test Setup

**Files:**

- Create: `frontend/src/api/slots.ts`
- Create: `frontend/src/api/tables.ts`
- Create: `frontend/src/hooks/useSlots.ts`
- Create: `frontend/src/hooks/useAvailableTables.ts`
- Create: `frontend/tests/mocks/handlers.ts`
- Create: `frontend/tests/mocks/server.ts`
- Modify: `frontend/tests/setup.ts`
- Test: `frontend/tests/unit/api/slots.test.ts`
- Test: `frontend/tests/unit/api/tables.test.ts`
- Test: `frontend/tests/unit/hooks/useSlots.test.tsx`

**Interfaces:**

- Consumes: `request` (Task 4), `Slot`, `Table` (Task 5).
- Produces: `fetchSlots(): Promise<Slot[]>`, `AvailableTablesParams { slotId: number; date: string; partySize: number }`, `fetchAvailableTables(params): Promise<Table[]>`, `useSlots()`, `useAvailableTables(params: AvailableTablesParams | null)` — both TanStack Query hooks. `server` (MSW) — every later test file that hits the network relies on the `beforeAll`/`afterEach`/`afterAll` lifecycle wired into `tests/setup.ts` here. `useAvailableTables` is exercised end-to-end by Task 9's Book page tests rather than a dedicated hook test here (identical shape to `useSlots`, avoids redundant coverage).

- [ ] **Step 1: Write `frontend/tests/mocks/handlers.ts`**

```ts
import { http, HttpResponse } from 'msw';

const API_BASE_URL = 'http://localhost:3000';

export const handlers = [
  http.get(`${API_BASE_URL}/slots`, () =>
    HttpResponse.json([
      {
        id: 1,
        label: 'Lunch 12:00',
        startTime: '12:00',
        durationMinutes: 90,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 2,
        label: 'Dinner 18:00',
        startTime: '18:00',
        durationMinutes: 90,
        isActive: true,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]),
  ),
];
```

- [ ] **Step 2: Write `frontend/tests/mocks/server.ts`**

```ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

- [ ] **Step 3: Modify `frontend/tests/setup.ts`** — wire the MSW server lifecycle

```ts
import '@testing-library/jest-dom/vitest';
import { vi, beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3000');

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 4: Write the failing test `frontend/tests/unit/api/slots.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { fetchSlots } from '../../../src/api/slots';

describe('fetchSlots', () => {
  it('returns the list of active slots', async () => {
    const slots = await fetchSlots();
    expect(slots).toHaveLength(2);
    expect(slots[0].label).toBe('Lunch 12:00');
  });
});
```

- [ ] **Step 5: Write the failing test `frontend/tests/unit/api/tables.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { fetchAvailableTables } from '../../../src/api/tables';

describe('fetchAvailableTables', () => {
  it('requests /tables/available with the given query params', async () => {
    server.use(
      http.get('http://localhost:3000/tables/available', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('slotId')).toBe('1');
        expect(url.searchParams.get('date')).toBe('2026-08-01');
        expect(url.searchParams.get('partySize')).toBe('2');
        return HttpResponse.json([
          {
            id: 3,
            name: 'Table 3',
            capacity: 4,
            description: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]);
      }),
    );

    const tables = await fetchAvailableTables({ slotId: 1, date: '2026-08-01', partySize: 2 });
    expect(tables).toEqual([
      {
        id: 3,
        name: 'Table 3',
        capacity: 4,
        description: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });
});
```

- [ ] **Step 6: Write the failing test `frontend/tests/unit/hooks/useSlots.test.tsx`**

```tsx
import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSlots } from '../../../src/hooks/useSlots';

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useSlots', () => {
  it('loads slots from the API', async () => {
    const { result } = renderHook(() => useSlots(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `cd frontend && npm test -- slots tables useSlots`
Expected: FAIL — cannot find `src/api/slots.ts`, `src/api/tables.ts`, `src/hooks/useSlots.ts`.

- [ ] **Step 8: Write `frontend/src/api/slots.ts`**

```ts
import { request } from './apiClient';
import { Slot } from './types';

export function fetchSlots(): Promise<Slot[]> {
  return request<Slot[]>('/slots');
}
```

- [ ] **Step 9: Write `frontend/src/api/tables.ts`**

```ts
import { request } from './apiClient';
import { Table } from './types';

export interface AvailableTablesParams {
  slotId: number;
  date: string;
  partySize: number;
}

export function fetchAvailableTables(params: AvailableTablesParams): Promise<Table[]> {
  const query = new URLSearchParams({
    slotId: String(params.slotId),
    date: params.date,
    partySize: String(params.partySize),
  });
  return request<Table[]>(`/tables/available?${query.toString()}`);
}
```

- [ ] **Step 10: Write `frontend/src/hooks/useSlots.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchSlots } from '../api/slots';

export function useSlots() {
  return useQuery({ queryKey: ['slots'], queryFn: fetchSlots });
}
```

- [ ] **Step 11: Write `frontend/src/hooks/useAvailableTables.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchAvailableTables, AvailableTablesParams } from '../api/tables';

export function useAvailableTables(params: AvailableTablesParams | null) {
  return useQuery({
    queryKey: ['tables', 'available', params],
    queryFn: () => fetchAvailableTables(params as AvailableTablesParams),
    enabled: params !== null,
  });
}
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `cd frontend && npm test -- slots tables useSlots`
Expected: 3 passed.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/api/slots.ts frontend/src/api/tables.ts frontend/src/hooks/useSlots.ts frontend/src/hooks/useAvailableTables.ts frontend/tests/mocks frontend/tests/setup.ts frontend/tests/unit/api/slots.test.ts frontend/tests/unit/api/tables.test.ts frontend/tests/unit/hooks/useSlots.test.tsx
git commit -m "feat(frontend): slots and available-tables api modules, query hooks, msw test setup"
```

---

## Task 7: Home Page (`/`)

**Files:**

- Modify: `frontend/src/pages/Home.tsx`
- Test: `frontend/tests/unit/pages/Home.test.tsx`

**Interfaces:**

- Consumes: `useSlots` (Task 6), `Button` (Task 2).
- Produces: `Home` page that navigates to `/book?date=...&partySize=...&slotId=...` on submit — the query param names/shape are relied on by Task 9's `/book` page.

- [ ] **Step 1: Write the failing test `frontend/tests/unit/pages/Home.test.tsx`**

```tsx
import type { ReactNode } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from '../../../src/pages/Home';

let capturedLocation = '';

function LocationDisplay() {
  const location = useLocation();
  capturedLocation = `${location.pathname}${location.search}`;
  return null;
}

function renderHome() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  capturedLocation = '';
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <Home />
                <LocationDisplay />
              </>
            }
          />
          <Route path="/book" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Home', () => {
  it('lists time slots loaded from the API', async () => {
    renderHome();
    expect(await screen.findByText('Lunch 12:00')).toBeInTheDocument();
    expect(screen.getByText('Dinner 18:00')).toBeInTheDocument();
  });

  it('disables submit until date, party size, and slot are all set', async () => {
    renderHome();
    await screen.findByText('Lunch 12:00');
    expect(screen.getByRole('button', { name: 'Check availability' })).toBeDisabled();
  });

  it('navigates to /book with the selected values as query params', async () => {
    const user = userEvent.setup();
    renderHome();
    await screen.findByText('Lunch 12:00');

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-01' } });
    await user.type(screen.getByLabelText('Party size'), '4');
    await user.selectOptions(screen.getByLabelText('Time'), '1');
    await user.click(screen.getByRole('button', { name: 'Check availability' }));

    expect(capturedLocation).toBe('/book?date=2026-08-01&partySize=4&slotId=1');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npm test -- Home`
Expected: FAIL — the placeholder `Home` has no form, so `getByLabelText('Date')` etc. throw.

- [ ] **Step 3: Write `frontend/src/pages/Home.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSlots } from '../hooks/useSlots';
import { Button } from '../components/Button';

export default function Home() {
  const { data: slots, isLoading, isError } = useSlots();
  const navigate = useNavigate();
  const [date, setDate] = useState('');
  const [partySize, setPartySize] = useState('');
  const [slotId, setSlotId] = useState('');

  const canSubmit = date !== '' && partySize !== '' && slotId !== '';

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    const params = new URLSearchParams({ date, partySize, slotId });
    navigate(`/book?${params.toString()}`);
  }

  return (
    <div className="min-h-screen flex items-center px-6">
      <div className="max-w-md w-full mx-auto">
        <h1 className="font-display text-3xl font-semibold mb-2">Reserve a table</h1>
        <p className="text-text/70 mb-6">
          Pick a date, party size, and time — we&apos;ll find your table.
        </p>
        {isError && (
          <p role="alert" className="text-accent mb-4">
            Couldn&apos;t load time slots. Please try again.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="date" className="block text-sm font-medium mb-1">
              Date
            </label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded border border-border px-3 py-2"
              required
            />
          </div>
          <div>
            <label htmlFor="partySize" className="block text-sm font-medium mb-1">
              Party size
            </label>
            <input
              id="partySize"
              type="number"
              min={1}
              value={partySize}
              onChange={(e) => setPartySize(e.target.value)}
              className="w-full rounded border border-border px-3 py-2"
              required
            />
          </div>
          <div>
            <label htmlFor="slotId" className="block text-sm font-medium mb-1">
              Time
            </label>
            <select
              id="slotId"
              value={slotId}
              onChange={(e) => setSlotId(e.target.value)}
              className="w-full rounded border border-border px-3 py-2"
              required
              disabled={isLoading}
            >
              <option value="" disabled>
                Select a time
              </option>
              {slots?.map((slot) => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={!canSubmit}>
            Check availability
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && npm test -- Home`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Home.tsx frontend/tests/unit/pages/Home.test.tsx
git commit -m "feat(frontend): home page with date/party-size/slot picker"
```

---

## Task 8: Bookings API Module & Hooks

**Files:**

- Create: `frontend/src/api/bookings.ts`
- Create: `frontend/src/hooks/useBookings.ts`
- Test: `frontend/tests/unit/api/bookings.test.ts`

**Interfaces:**

- Consumes: `request`, `ApiError` (Task 4), `Booking` (Task 5).
- Produces: `CreateBookingPayload`, `createBooking(payload): Promise<Booking>`, `fetchBooking(id): Promise<Booking>`, `cancelBooking(id): Promise<void>`, `useCreateBooking()` (mutation), `useBooking(id: string | undefined)` (query), `useCancelBooking(id: string)` (mutation, invalidates `useBooking`'s query key on success). `useBooking`/`useCancelBooking` are exercised via Task 10's confirmation page tests rather than dedicated hook tests here (same reasoning as Task 6's `useAvailableTables`).

- [ ] **Step 1: Write the failing test `frontend/tests/unit/api/bookings.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import { createBooking, fetchBooking, cancelBooking } from '../../../src/api/bookings';

const sampleBooking = {
  id: 'booking-1',
  date: '2026-08-01',
  status: 'confirmed',
  partySize: 2,
  guestName: 'Jane Doe',
  guestEmail: 'jane@example.com',
  guestPhone: null,
  notes: null,
  tableId: 5,
  slotId: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('bookings api', () => {
  it('createBooking posts the payload and returns the created booking', async () => {
    server.use(
      http.post('http://localhost:3000/bookings', () =>
        HttpResponse.json(sampleBooking, { status: 201 }),
      ),
    );
    const result = await createBooking({
      date: '2026-08-01',
      slotId: 1,
      partySize: 2,
      guestName: 'Jane Doe',
      guestEmail: 'jane@example.com',
      tableId: 5,
    });
    expect(result).toEqual(sampleBooking);
  });

  it('fetchBooking gets the booking by id', async () => {
    server.use(
      http.get('http://localhost:3000/bookings/booking-1', () => HttpResponse.json(sampleBooking)),
    );
    const result = await fetchBooking('booking-1');
    expect(result).toEqual(sampleBooking);
  });

  it('cancelBooking sends a DELETE and resolves with no content', async () => {
    server.use(
      http.delete(
        'http://localhost:3000/bookings/booking-1',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await expect(cancelBooking('booking-1')).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npm test -- bookings.test`
Expected: FAIL — cannot find module `../../../src/api/bookings`.

- [ ] **Step 3: Write `frontend/src/api/bookings.ts`**

```ts
import { request } from './apiClient';
import { Booking } from './types';

export interface CreateBookingPayload {
  date: string;
  slotId: number;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  notes?: string;
  tableId?: number;
}

export function createBooking(payload: CreateBookingPayload): Promise<Booking> {
  return request<Booking>('/bookings', { method: 'POST', body: JSON.stringify(payload) });
}

export function fetchBooking(id: string): Promise<Booking> {
  return request<Booking>(`/bookings/${id}`);
}

export function cancelBooking(id: string): Promise<void> {
  return request<void>(`/bookings/${id}`, { method: 'DELETE' });
}
```

- [ ] **Step 4: Write `frontend/src/hooks/useBookings.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createBooking, fetchBooking, cancelBooking, CreateBookingPayload } from '../api/bookings';

export function useCreateBooking() {
  return useMutation({
    mutationFn: (payload: CreateBookingPayload) => createBooking(payload),
  });
}

export function useBooking(id: string | undefined) {
  return useQuery({
    queryKey: ['bookings', id],
    queryFn: () => fetchBooking(id as string),
    enabled: id !== undefined,
  });
}

export function useCancelBooking(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cancelBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings', id] });
    },
  });
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd frontend && npm test -- bookings.test`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/bookings.ts frontend/src/hooks/useBookings.ts frontend/tests/unit/api/bookings.test.ts
git commit -m "feat(frontend): bookings api module and query/mutation hooks"
```

---

## Task 9: Book Page (`/book`)

**Files:**

- Create: `frontend/src/pages/Book.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/unit/pages/Book.test.tsx`

**Interfaces:**

- Consumes: `useAvailableTables` (Task 6), `useCreateBooking` (Task 8), `guestBookingFormSchema`, `GuestBookingFormInput` (Task 5), `Button` (Task 2), `ApiError` (Task 4).
- Produces: `Book` page mounted at `/book`, reading `date`/`partySize`/`slotId` from the URL query string (the exact param names Task 7 writes), navigating to `/bookings/:id` on successful creation. The full `/` → `/book` → `/bookings/:id` multi-page journey is covered by a dedicated flow test in Task 10 (once the confirmation page exists) — this task's tests cover `/book` in isolation.

- [ ] **Step 1: Write the failing test `frontend/tests/unit/pages/Book.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import Book from '../../../src/pages/Book';

let capturedLocation = '';

function LocationDisplay() {
  const location = useLocation();
  capturedLocation = `${location.pathname}${location.search}`;
  return null;
}

function renderBook(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  capturedLocation = '';
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/book"
            element={
              <>
                <Book />
                <LocationDisplay />
              </>
            }
          />
          <Route path="/bookings/:id" element={<LocationDisplay />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const availableTable = {
  id: 5,
  name: 'Table 5',
  capacity: 4,
  description: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('Book', () => {
  it('shows a "start over" message when query params are missing', () => {
    renderBook('/book');
    expect(screen.getByText('Start over')).toBeInTheDocument();
  });

  it('shows a message when no tables are available', async () => {
    server.use(http.get('http://localhost:3000/tables/available', () => HttpResponse.json([])));
    renderBook('/book?date=2026-08-01&partySize=2&slotId=1');
    expect(
      await screen.findByText('No tables available for this date, time, and party size.'),
    ).toBeInTheDocument();
  });

  it('lets the guest pick a table, submit the form, and navigates to the confirmation page', async () => {
    server.use(
      http.get('http://localhost:3000/tables/available', () => HttpResponse.json([availableTable])),
      http.post('http://localhost:3000/bookings', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.tableId).toBe(5);
        expect(body.date).toBe('2026-08-01');
        expect(body.slotId).toBe(1);
        expect(body.partySize).toBe(2);
        return HttpResponse.json(
          {
            id: 'booking-abc',
            date: '2026-08-01',
            status: 'confirmed',
            partySize: 2,
            guestName: body.guestName,
            guestEmail: body.guestEmail,
            guestPhone: null,
            notes: null,
            tableId: 5,
            slotId: 1,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );

    const user = userEvent.setup();
    renderBook('/book?date=2026-08-01&partySize=2&slotId=1');

    await user.click(await screen.findByText('Table 5'));
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    await waitFor(() => expect(capturedLocation).toBe('/bookings/booking-abc'));
  });

  it('shows the API error when booking creation fails', async () => {
    server.use(
      http.get('http://localhost:3000/tables/available', () => HttpResponse.json([availableTable])),
      http.post('http://localhost:3000/bookings', () =>
        HttpResponse.json(
          { error: 'ConflictError', message: 'Table was just booked' },
          { status: 409 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderBook('/book?date=2026-08-01&partySize=2&slotId=1');

    await user.click(await screen.findByText('Table 5'));
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText('Table was just booked')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npm test -- Book.test`
Expected: FAIL — cannot find module `../../../src/pages/Book`.

- [ ] **Step 3: Write `frontend/src/pages/Book.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAvailableTables } from '../hooks/useAvailableTables';
import { useCreateBooking } from '../hooks/useBookings';
import { guestBookingFormSchema, GuestBookingFormInput } from '../lib/schemas/booking.schema';
import { Button } from '../components/Button';
import { ApiError } from '../api/apiClient';

export default function Book() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const date = searchParams.get('date');
  const partySize = Number(searchParams.get('partySize'));
  const slotId = Number(searchParams.get('slotId'));
  const hasValidParams = Boolean(date) && Number.isInteger(partySize) && Number.isInteger(slotId);

  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);

  const availableTablesParams = useMemo(
    () => (hasValidParams ? { date: date as string, partySize, slotId } : null),
    [hasValidParams, date, partySize, slotId],
  );
  const { data: tables, isLoading, isError } = useAvailableTables(availableTablesParams);
  const createBooking = useCreateBooking();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GuestBookingFormInput>({ resolver: zodResolver(guestBookingFormSchema) });

  if (!hasValidParams) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p>
          Missing booking details.{' '}
          <a href="/" className="underline text-accent">
            Start over
          </a>
          .
        </p>
      </div>
    );
  }

  async function onSubmit(values: GuestBookingFormInput) {
    if (selectedTableId === null) return;
    try {
      const booking = await createBooking.mutateAsync({
        date: date as string,
        slotId,
        partySize,
        tableId: selectedTableId,
        ...values,
      });
      navigate(`/bookings/${booking.id}`);
    } catch {
      // surfaced via createBooking.error below
    }
  }

  return (
    <div className="min-h-screen px-6 py-10 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-6">Choose a table</h1>

      {isLoading && <p>Loading availability…</p>}
      {isError && (
        <p role="alert" className="text-accent">
          Couldn&apos;t load available tables.
        </p>
      )}
      {tables && tables.length === 0 && (
        <p>No tables available for this date, time, and party size.</p>
      )}

      {tables && tables.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-8">
          {tables.map((table) => (
            <button
              key={table.id}
              type="button"
              onClick={() => setSelectedTableId(table.id)}
              aria-pressed={selectedTableId === table.id}
              className={`rounded border px-4 py-3 text-left ${
                selectedTableId === table.id ? 'border-accent bg-accent/10' : 'border-border'
              }`}
            >
              <div className="font-medium">{table.name}</div>
              <div className="text-sm text-text/70">Seats {table.capacity}</div>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="guestName" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="guestName"
            className="w-full rounded border border-border px-3 py-2"
            {...register('guestName')}
          />
          {errors.guestName && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.guestName.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="guestEmail" className="block text-sm font-medium mb-1">
            Email
          </label>
          <input
            id="guestEmail"
            type="email"
            className="w-full rounded border border-border px-3 py-2"
            {...register('guestEmail')}
          />
          {errors.guestEmail && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.guestEmail.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="guestPhone" className="block text-sm font-medium mb-1">
            Phone (optional)
          </label>
          <input
            id="guestPhone"
            className="w-full rounded border border-border px-3 py-2"
            {...register('guestPhone')}
          />
        </div>
        <div>
          <label htmlFor="notes" className="block text-sm font-medium mb-1">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            className="w-full rounded border border-border px-3 py-2"
            {...register('notes')}
          />
        </div>
        {createBooking.isError && (
          <p role="alert" className="text-accent text-sm">
            {createBooking.error instanceof ApiError
              ? createBooking.error.message
              : 'Something went wrong. Please try again.'}
          </p>
        )}
        <Button type="submit" disabled={selectedTableId === null || createBooking.isPending}>
          {createBooking.isPending ? 'Booking…' : 'Confirm booking'}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Modify `frontend/src/App.tsx`** — add the `/book` route

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import Book from './pages/Book';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/book" element={<Book />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd frontend && npm test -- Book.test`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Book.tsx frontend/src/App.tsx frontend/tests/unit/pages/Book.test.tsx
git commit -m "feat(frontend): book page with table selection and guest details form"
```

---

## Task 10: Confirm Dialog, Booking Confirmation Page (`/bookings/:id`), Guest Flow Test

**Files:**

- Create: `frontend/src/components/ConfirmDialog.tsx`
- Create: `frontend/src/pages/BookingConfirmation.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/unit/components/ConfirmDialog.test.tsx`
- Test: `frontend/tests/unit/pages/BookingConfirmation.test.tsx`
- Test: `frontend/tests/flows/guestBooking.flow.test.tsx`

**Interfaces:**

- Consumes: `Button` (Task 2), `useBooking`, `useCancelBooking` (Task 8), `useSlots` (Task 6).
- Produces: `ConfirmDialog` (reusable, also used by Task 13's admin cancel action), `BookingConfirmation` page mounted at `/bookings/:id`. `App.tsx` is refactored to export `AppRoutes` (the `<Routes>` tree, no router) separately from the default `App` (which wraps `AppRoutes` in `BrowserRouter` + `QueryClientProvider`) — `AppRoutes` is what tests mount inside their own `MemoryRouter`, and is reused by every later admin task that adds routes.

- [ ] **Step 1: Write the failing test `frontend/tests/unit/components/ConfirmDialog.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../../../src/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders title and description when open, and calls onConfirm on click', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Cancel this booking?"
        description="This can't be undone."
        confirmLabel="Confirm cancellation"
        onConfirm={onConfirm}
      />,
    );

    expect(screen.getByText('Cancel this booking?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onOpenChange(false) when dismissed', async () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Cancel this booking?"
        description="This can't be undone."
        confirmLabel="Confirm cancellation"
        onConfirm={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Never mind' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders nothing when closed', () => {
    render(
      <ConfirmDialog
        open={false}
        onOpenChange={vi.fn()}
        title="Cancel this booking?"
        description="This can't be undone."
        confirmLabel="Confirm cancellation"
        onConfirm={vi.fn()}
      />,
    );
    expect(screen.queryByText('Cancel this booking?')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npm test -- ConfirmDialog`
Expected: FAIL — cannot find module `../../../src/components/ConfirmDialog`.

- [ ] **Step 3: Write `frontend/src/components/ConfirmDialog.tsx`**

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  isConfirming?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  isConfirming = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-text/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-background border border-border p-6 w-full max-w-sm">
          <Dialog.Title className="font-display text-lg font-semibold mb-2">{title}</Dialog.Title>
          <Dialog.Description className="text-sm text-text/70 mb-6">
            {description}
          </Dialog.Description>
          <div className="flex justify-end gap-3">
            <Dialog.Close asChild>
              <Button variant="secondary" type="button">
                Never mind
              </Button>
            </Dialog.Close>
            <Button type="button" onClick={onConfirm} disabled={isConfirming}>
              {isConfirming ? 'Please wait…' : confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && npm test -- ConfirmDialog`
Expected: 3 passed.

- [ ] **Step 5: Write the failing test `frontend/tests/unit/pages/BookingConfirmation.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import BookingConfirmation from '../../../src/pages/BookingConfirmation';

function renderConfirmation(id: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/bookings/${id}`]}>
        <Routes>
          <Route path="/bookings/:id" element={<BookingConfirmation />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const baseBooking = {
  id: 'booking-1',
  date: '2026-08-01',
  status: 'confirmed',
  partySize: 2,
  guestName: 'Jane Doe',
  guestEmail: 'jane@example.com',
  guestPhone: null,
  notes: null,
  tableId: 5,
  slotId: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('BookingConfirmation', () => {
  it('shows booking details with the resolved slot label and table number', async () => {
    server.use(
      http.get('http://localhost:3000/bookings/booking-1', () => HttpResponse.json(baseBooking)),
    );
    renderConfirmation('booking-1');

    expect(await screen.findByText("You're booked!")).toBeInTheDocument();
    expect(screen.getByText('Lunch 12:00')).toBeInTheDocument();
    expect(screen.getByText('Table #5')).toBeInTheDocument();
  });

  it('shows a not-found message when the booking does not exist', async () => {
    server.use(
      http.get('http://localhost:3000/bookings/missing', () =>
        HttpResponse.json(
          { error: 'NotFoundError', message: 'Booking missing not found' },
          { status: 404 },
        ),
      ),
    );
    renderConfirmation('missing');
    expect(await screen.findByText("We couldn't find that booking.")).toBeInTheDocument();
  });

  it('cancels the booking through the confirm dialog', async () => {
    let cancelled = false;
    server.use(
      http.get('http://localhost:3000/bookings/booking-1', () =>
        HttpResponse.json({ ...baseBooking, status: cancelled ? 'cancelled' : 'confirmed' }),
      ),
      http.delete('http://localhost:3000/bookings/booking-1', () => {
        cancelled = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    const user = userEvent.setup();
    renderConfirmation('booking-1');

    await user.click(await screen.findByRole('button', { name: 'Cancel booking' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => expect(screen.getByText('cancelled')).toBeInTheDocument());
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd frontend && npm test -- BookingConfirmation`
Expected: FAIL — cannot find module `../../../src/pages/BookingConfirmation`.

- [ ] **Step 7: Write `frontend/src/pages/BookingConfirmation.tsx`**

```tsx
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useBooking, useCancelBooking } from '../hooks/useBookings';
import { useSlots } from '../hooks/useSlots';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';

export default function BookingConfirmation() {
  const { id } = useParams<{ id: string }>();
  const { data: booking, isLoading, isError } = useBooking(id);
  const { data: slots } = useSlots();
  const cancelBooking = useCancelBooking(id as string);
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  if (isError || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <p role="alert">We couldn&apos;t find that booking.</p>
      </div>
    );
  }

  const slot = slots?.find((s) => s.id === booking.slotId);

  return (
    <div className="min-h-screen px-6 py-10 max-w-lg mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-4">
        {booking.status === 'cancelled' ? 'Booking cancelled' : "You're booked!"}
      </h1>
      <dl className="space-y-2 mb-8">
        <div>
          <dt className="text-sm text-text/70">Date</dt>
          <dd>{booking.date}</dd>
        </div>
        <div>
          <dt className="text-sm text-text/70">Time</dt>
          <dd>{slot ? slot.label : `Slot #${booking.slotId}`}</dd>
        </div>
        <div>
          <dt className="text-sm text-text/70">Party size</dt>
          <dd>{booking.partySize}</dd>
        </div>
        <div>
          <dt className="text-sm text-text/70">Table</dt>
          <dd>Table #{booking.tableId}</dd>
        </div>
        <div>
          <dt className="text-sm text-text/70">Status</dt>
          <dd className="capitalize">{booking.status}</dd>
        </div>
      </dl>

      {booking.status === 'confirmed' && (
        <>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>
            Cancel booking
          </Button>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Cancel this booking?"
            description="This can't be undone. You'll need to make a new booking if you change your mind."
            confirmLabel="Confirm cancellation"
            isConfirming={cancelBooking.isPending}
            onConfirm={() => {
              cancelBooking.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
            }}
          />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Modify `frontend/src/App.tsx`** — extract `AppRoutes`, add the `/bookings/:id` route

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import Book from './pages/Book';
import BookingConfirmation from './pages/BookingConfirmation';

const queryClient = new QueryClient();

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Book />} />
      <Route path="/bookings/:id" element={<BookingConfirmation />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 9: Run the page test to verify it passes**

Run: `cd frontend && npm test -- BookingConfirmation`
Expected: 3 passed.

- [ ] **Step 10: Write the failing flow test `frontend/tests/flows/guestBooking.flow.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../mocks/server';
import { AppRoutes } from '../../src/App';

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('guest booking flow', () => {
  it('books a table end-to-end from the homepage to the confirmation page', async () => {
    server.use(
      http.get('http://localhost:3000/tables/available', () =>
        HttpResponse.json([
          {
            id: 5,
            name: 'Table 5',
            capacity: 4,
            description: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
      ),
      http.post('http://localhost:3000/bookings', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            id: 'booking-flow-1',
            date: body.date,
            status: 'confirmed',
            partySize: body.partySize,
            guestName: body.guestName,
            guestEmail: body.guestEmail,
            guestPhone: null,
            notes: null,
            tableId: body.tableId,
            slotId: body.slotId,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
      http.get('http://localhost:3000/bookings/booking-flow-1', () =>
        HttpResponse.json({
          id: 'booking-flow-1',
          date: '2026-08-01',
          status: 'confirmed',
          partySize: 2,
          guestName: 'Jane Doe',
          guestEmail: 'jane@example.com',
          guestPhone: null,
          notes: null,
          tableId: 5,
          slotId: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        }),
      ),
    );

    const user = userEvent.setup();
    renderApp();

    await screen.findByText('Lunch 12:00');
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-01' } });
    await user.type(screen.getByLabelText('Party size'), '2');
    await user.selectOptions(screen.getByLabelText('Time'), '1');
    await user.click(screen.getByRole('button', { name: 'Check availability' }));

    await user.click(await screen.findByText('Table 5'));
    await user.type(screen.getByLabelText('Name'), 'Jane Doe');
    await user.type(screen.getByLabelText('Email'), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }));

    expect(await screen.findByText("You're booked!")).toBeInTheDocument();
    expect(screen.getByText('Lunch 12:00')).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Run it to verify it passes**

Run: `cd frontend && npm test -- guestBooking.flow`
Expected: 1 passed.

- [ ] **Step 12: Run the full frontend test suite to confirm no regressions**

Run: `cd frontend && npm test`
Expected: all suites pass.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/components/ConfirmDialog.tsx frontend/src/pages/BookingConfirmation.tsx frontend/src/App.tsx frontend/tests/unit/components/ConfirmDialog.test.tsx frontend/tests/unit/pages/BookingConfirmation.test.tsx frontend/tests/flows/guestBooking.flow.test.tsx
git commit -m "feat(frontend): booking confirmation page, confirm dialog, guest flow test"
```

---

## Task 11: Auth API Module & AdminAuthContext

**Files:**

- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/context/AdminAuthContext.tsx`
- Test: `frontend/tests/unit/context/AdminAuthContext.test.tsx`

**Interfaces:**

- Consumes: `request` (Task 4), `setAuthHandlers`, `clearAuthHandlers` (Task 4), `LoginResponse`, `RefreshResponse` (Task 5).
- Produces: `login(email, password): Promise<LoginResponse>`, `refresh(refreshToken): Promise<RefreshResponse>`, `logout(refreshToken): Promise<void>` (`api/auth.ts`); `AdminAuthProvider`, `useAdminAuth(): { status: 'pending' | 'authenticated' | 'unauthenticated'; login(email, password): Promise<void>; logout(): void }`, `REFRESH_TOKEN_KEY` (`context/AdminAuthContext.tsx`) — used by Task 12's `RequireAdmin`/`AdminLogin` and every later admin page for the `authenticated: true` requests they make through `apiClient.request`. `AdminAuthProvider` is not yet mounted in `App.tsx` — that happens in Task 12 alongside the admin routes it protects.

- [ ] **Step 1: Write `frontend/src/api/auth.ts`**

```ts
import { request } from './apiClient';
import { LoginResponse, RefreshResponse } from './types';

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function refresh(refreshToken: string): Promise<RefreshResponse> {
  return request<RefreshResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export function logout(refreshToken: string): Promise<void> {
  return request<void>('/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}
```

- [ ] **Step 2: Write the failing test `frontend/tests/unit/context/AdminAuthContext.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import {
  AdminAuthProvider,
  useAdminAuth,
  REFRESH_TOKEN_KEY,
} from '../../../src/context/AdminAuthContext';
import { request } from '../../../src/api/apiClient';

function AuthProbe() {
  const { status, login, logout } = useAdminAuth();
  return (
    <div>
      <p>status: {status}</p>
      <button onClick={() => login('admin@test.com', 'password123')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

function renderProbe() {
  render(
    <AdminAuthProvider>
      <AuthProbe />
    </AdminAuthProvider>,
  );
}

describe('AdminAuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('resolves to unauthenticated when there is no stored refresh token', async () => {
    renderProbe();
    expect(screen.getByText('status: pending')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());
  });

  it('silently authenticates on mount when a refresh token is already stored', async () => {
    localStorage.setItem(REFRESH_TOKEN_KEY, 'existing-refresh-token');
    server.use(
      http.post('http://localhost:3000/auth/refresh', () =>
        HttpResponse.json({ accessToken: 'new-access' }),
      ),
    );
    renderProbe();
    await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument());
  });

  it('authenticates after a successful login and stores the refresh token', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      ),
    );
    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument());
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1');
  });

  it('logs out, clearing status and the stored refresh token', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      ),
      http.post('http://localhost:3000/auth/logout', () => new HttpResponse(null, { status: 204 })),
    );
    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());
    expect(localStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('wires the access token into apiClient so authenticated requests carry it', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      ),
    );
    const user = userEvent.setup();
    renderProbe();
    await waitFor(() => expect(screen.getByText('status: unauthenticated')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Login' }));
    await waitFor(() => expect(screen.getByText('status: authenticated')).toBeInTheDocument());

    let capturedAuth: string | null = null;
    server.use(
      http.get('http://localhost:3000/admin/tables', ({ request: req }) => {
        capturedAuth = req.headers.get('Authorization');
        return HttpResponse.json([]);
      }),
    );
    await request('/admin/tables', { authenticated: true });
    expect(capturedAuth).toBe('Bearer access-1');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npm test -- AdminAuthContext`
Expected: FAIL — cannot find module `../../../src/context/AdminAuthContext`.

- [ ] **Step 4: Write `frontend/src/context/AdminAuthContext.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { login as apiLogin, refresh as apiRefresh, logout as apiLogout } from '../api/auth';
import { setAuthHandlers, clearAuthHandlers } from '../api/apiClient';

export const REFRESH_TOKEN_KEY = 'booking_admin_refresh_token';

type AuthStatus = 'pending' | 'authenticated' | 'unauthenticated';

interface AdminAuthContextValue {
  status: AuthStatus;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('pending');
  const accessTokenRef = useRef<string | null>(null);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!storedRefreshToken) return null;
    try {
      const { accessToken } = await apiRefresh(storedRefreshToken);
      accessTokenRef.current = accessToken;
      return accessToken;
    } catch {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      accessTokenRef.current = null;
      return null;
    }
  }, []);

  const handleAuthFailure = useCallback(() => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    accessTokenRef.current = null;
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    setAuthHandlers({
      getAccessToken: () => accessTokenRef.current,
      refreshAccessToken: doRefresh,
      onAuthFailure: handleAuthFailure,
    });
    return () => clearAuthHandlers();
  }, [doRefresh, handleAuthFailure]);

  useEffect(() => {
    let cancelled = false;
    doRefresh().then((token) => {
      if (!cancelled) setStatus(token ? 'authenticated' : 'unauthenticated');
    });
    return () => {
      cancelled = true;
    };
    // Runs once on mount only — doRefresh is stable (empty dep array via useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string): Promise<void> {
    const { accessToken, refreshToken } = await apiLogin(email, password);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    accessTokenRef.current = accessToken;
    setStatus('authenticated');
  }

  function logout(): void {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (storedRefreshToken) {
      apiLogout(storedRefreshToken).catch(() => {});
    }
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    accessTokenRef.current = null;
    setStatus('unauthenticated');
  }

  return (
    <AdminAuthContext.Provider value={{ status, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return ctx;
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd frontend && npm test -- AdminAuthContext`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/auth.ts frontend/src/context/AdminAuthContext.tsx frontend/tests/unit/context/AdminAuthContext.test.tsx
git commit -m "feat(frontend): auth api module and in-memory admin auth context"
```

---

## Task 12: RequireAdmin Guard, AdminNav, AdminLogin Page

**Files:**

- Create: `frontend/src/components/RequireAdmin.tsx`
- Create: `frontend/src/components/AdminNav.tsx`
- Create: `frontend/src/pages/AdminLogin.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/unit/components/RequireAdmin.test.tsx`
- Test: `frontend/tests/unit/components/AdminNav.test.tsx`
- Test: `frontend/tests/unit/pages/AdminLogin.test.tsx`

**Interfaces:**

- Consumes: `useAdminAuth` (Task 11), `Button` (Task 2), `loginFormSchema`, `LoginFormInput` (Task 5), `ApiError` (Task 4).
- Produces: `RequireAdmin` (wraps protected content, redirects to `/admin/login` when unauthenticated), `AdminNav` (top nav with links + logout), `AdminLogin` page mounted at `/admin/login`. `App.tsx` now wraps the whole tree in `AdminAuthProvider` and adds an `/admin` layout route (`RequireAdmin` + `AdminNav` + `<Outlet />`) that Tasks 13–15 attach nested `bookings` / `tables` / `slots` child routes to.

- [ ] **Step 1: Write the failing test `frontend/tests/unit/components/RequireAdmin.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAdmin } from '../../../src/components/RequireAdmin';
import { useAdminAuth } from '../../../src/context/AdminAuthContext';

vi.mock('../../../src/context/AdminAuthContext', () => ({
  useAdminAuth: vi.fn(),
}));

function renderWithStatus(status: 'pending' | 'authenticated' | 'unauthenticated') {
  vi.mocked(useAdminAuth).mockReturnValue({ status, login: vi.fn(), logout: vi.fn() });
  render(
    <MemoryRouter initialEntries={['/admin/bookings']}>
      <Routes>
        <Route path="/admin/login" element={<div>Login page</div>} />
        <Route
          path="/admin/bookings"
          element={
            <RequireAdmin>
              <div>Protected content</div>
            </RequireAdmin>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireAdmin', () => {
  it('shows a loading state while auth status is pending', () => {
    renderWithStatus('pending');
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderWithStatus('authenticated');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects to /admin/login when unauthenticated', () => {
    renderWithStatus('unauthenticated');
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write the failing test `frontend/tests/unit/components/AdminNav.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AdminNav } from '../../../src/components/AdminNav';
import { useAdminAuth } from '../../../src/context/AdminAuthContext';

vi.mock('../../../src/context/AdminAuthContext', () => ({
  useAdminAuth: vi.fn(),
}));

describe('AdminNav', () => {
  it('renders nav links and calls logout on click', async () => {
    const logout = vi.fn();
    vi.mocked(useAdminAuth).mockReturnValue({ status: 'authenticated', login: vi.fn(), logout });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Bookings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tables' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Slots' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Write the failing test `frontend/tests/unit/pages/AdminLogin.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '../../mocks/server';
import { AdminAuthProvider } from '../../../src/context/AdminAuthContext';
import AdminLogin from '../../../src/pages/AdminLogin';

function renderLogin() {
  render(
    <AdminAuthProvider>
      <MemoryRouter initialEntries={['/admin/login']}>
        <Routes>
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/bookings" element={<div>Bookings page</div>} />
        </Routes>
      </MemoryRouter>
    </AdminAuthProvider>,
  );
}

describe('AdminLogin', () => {
  it('logs in and navigates to /admin/bookings on success', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      ),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(screen.getByText('Bookings page')).toBeInTheDocument());
  });

  it('shows an error message on invalid credentials', async () => {
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json(
          { error: 'UnauthorizedError', message: 'Invalid email or password' },
          { status: 401 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `cd frontend && npm test -- RequireAdmin AdminNav AdminLogin`
Expected: FAIL — none of the three source modules exist yet.

- [ ] **Step 5: Write `frontend/src/components/RequireAdmin.tsx`**

```tsx
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status } = useAdminAuth();

  if (status === 'pending') {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 6: Write `frontend/src/components/AdminNav.tsx`**

```tsx
import { NavLink } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Button } from './Button';

const links = [
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/tables', label: 'Tables' },
  { to: '/admin/slots', label: 'Slots' },
];

export function AdminNav() {
  const { logout } = useAdminAuth();
  return (
    <nav className="flex items-center justify-between border-b border-border px-6 py-4">
      <div className="flex gap-6">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              isActive ? 'font-medium text-accent' : 'text-text/70 hover:text-text'
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
      <Button variant="secondary" onClick={logout}>
        Log out
      </Button>
    </nav>
  );
}
```

- [ ] **Step 7: Write `frontend/src/pages/AdminLogin.tsx`**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAdminAuth } from '../context/AdminAuthContext';
import { loginFormSchema, LoginFormInput } from '../lib/schemas/auth.schema';
import { Button } from '../components/Button';
import { ApiError } from '../api/apiClient';

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [loginError, setLoginError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInput>({ resolver: zodResolver(loginFormSchema) });

  async function onSubmit(values: LoginFormInput) {
    setLoginError(null);
    try {
      await login(values.email, values.password);
      navigate('/admin/bookings');
    } catch (err) {
      setLoginError(
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.',
      );
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <h1 className="font-display text-2xl font-semibold mb-6">Admin login</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full rounded border border-border px-3 py-2"
              {...register('email')}
            />
            {errors.email && (
              <p role="alert" className="text-accent text-sm mt-1">
                {errors.email.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full rounded border border-border px-3 py-2"
              {...register('password')}
            />
            {errors.password && (
              <p role="alert" className="text-accent text-sm mt-1">
                {errors.password.message}
              </p>
            )}
          </div>
          {loginError && (
            <p role="alert" className="text-accent text-sm">
              {loginError}
            </p>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Modify `frontend/src/App.tsx`** — wrap in `AdminAuthProvider`, add `/admin/login` and the `/admin` layout route

```tsx
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import Book from './pages/Book';
import BookingConfirmation from './pages/BookingConfirmation';
import AdminLogin from './pages/AdminLogin';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { RequireAdmin } from './components/RequireAdmin';
import { AdminNav } from './components/AdminNav';

const queryClient = new QueryClient();

function AdminLayout() {
  return (
    <RequireAdmin>
      <AdminNav />
      <Outlet />
    </RequireAdmin>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Book />} />
      <Route path="/bookings/:id" element={<BookingConfirmation />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        {/* Tasks 13-15 add nested "bookings" / "tables" / "slots" routes here */}
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `cd frontend && npm test -- RequireAdmin AdminNav AdminLogin`
Expected: 6 passed.

- [ ] **Step 10: Run the full frontend test suite to confirm no regressions**

Run: `cd frontend && npm test`
Expected: all suites pass.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/components/RequireAdmin.tsx frontend/src/components/AdminNav.tsx frontend/src/pages/AdminLogin.tsx frontend/src/App.tsx frontend/tests/unit/components/RequireAdmin.test.tsx frontend/tests/unit/components/AdminNav.test.tsx frontend/tests/unit/pages/AdminLogin.test.tsx
git commit -m "feat(frontend): admin route guard, nav, and login page"
```

---

## Task 13: Admin Bookings API/Hooks, AdminBookings Page, Admin Flow Test

**Files:**

- Create: `frontend/src/api/adminTables.ts`
- Create: `frontend/src/api/adminSlots.ts`
- Create: `frontend/src/api/adminBookings.ts`
- Create: `frontend/src/hooks/useAdminTables.ts`
- Create: `frontend/src/hooks/useAdminSlots.ts`
- Create: `frontend/src/hooks/useAdminBookings.ts`
- Create: `frontend/src/pages/AdminBookings.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/unit/api/adminBookings.test.ts`
- Test: `frontend/tests/unit/pages/AdminBookings.test.tsx`
- Test: `frontend/tests/flows/adminCancelBooking.flow.test.tsx`

**Interfaces:**

- Consumes: `request` (Task 4), `Table`, `Slot`, `Booking`, `BookingStatus`, `AdminBookingListResponse` (Task 5), `Button`, `ConfirmDialog` (Tasks 2, 10), `AdminAuthProvider` (Task 11), `AppRoutes` (Task 12).
- Produces: `fetchAdminTables(): Promise<Table[]>`, `useAdminTables()` — **Task 14 modifies both files to add create/update/delete.** `fetchAdminSlots(): Promise<Slot[]>`, `useAdminSlots()` — **Task 15 modifies both files to add create/update/delete.** `AdminBookingListParams`, `fetchAdminBookings`, `cancelAdminBooking`, `reassignAdminBooking`, `useAdminBookings`, `useCancelAdminBooking`, `useReassignAdminBooking` (final, not extended further). `App.tsx`'s `/admin` layout route gets its first nested child route (`bookings`, plus an `index` redirect to it) — Tasks 14/15 add the `tables`/`slots` siblings.

- [ ] **Step 1: Write `frontend/src/api/adminTables.ts`**

```ts
import { request } from './apiClient';
import { Table } from './types';

export function fetchAdminTables(): Promise<Table[]> {
  return request<Table[]>('/admin/tables', { authenticated: true });
}
```

- [ ] **Step 2: Write `frontend/src/hooks/useAdminTables.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchAdminTables } from '../api/adminTables';

export function useAdminTables() {
  return useQuery({ queryKey: ['admin', 'tables'], queryFn: fetchAdminTables });
}
```

- [ ] **Step 3: Write `frontend/src/api/adminSlots.ts`**

```ts
import { request } from './apiClient';
import { Slot } from './types';

export function fetchAdminSlots(): Promise<Slot[]> {
  return request<Slot[]>('/admin/slots', { authenticated: true });
}
```

- [ ] **Step 4: Write `frontend/src/hooks/useAdminSlots.ts`**

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchAdminSlots } from '../api/adminSlots';

export function useAdminSlots() {
  return useQuery({ queryKey: ['admin', 'slots'], queryFn: fetchAdminSlots });
}
```

- [ ] **Step 5: Write the failing test `frontend/tests/unit/api/adminBookings.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import {
  fetchAdminBookings,
  cancelAdminBooking,
  reassignAdminBooking,
} from '../../../src/api/adminBookings';

const sampleBooking = {
  id: 'booking-1',
  date: '2026-08-01',
  status: 'confirmed',
  partySize: 2,
  guestName: 'Jane Doe',
  guestEmail: 'jane@example.com',
  guestPhone: null,
  notes: null,
  tableId: 5,
  slotId: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('adminBookings api', () => {
  it('fetchAdminBookings builds the query string from the given filters', async () => {
    server.use(
      http.get('http://localhost:3000/admin/bookings', ({ request: req }) => {
        const url = new URL(req.url);
        expect(url.searchParams.get('date')).toBe('2026-08-01');
        expect(url.searchParams.get('status')).toBe('confirmed');
        expect(url.searchParams.get('page')).toBe('2');
        expect(url.searchParams.get('pageSize')).toBe('20');
        return HttpResponse.json({ bookings: [sampleBooking], total: 1 });
      }),
    );
    const result = await fetchAdminBookings({
      date: '2026-08-01',
      status: 'confirmed',
      page: 2,
      pageSize: 20,
    });
    expect(result).toEqual({ bookings: [sampleBooking], total: 1 });
  });

  it('cancelAdminBooking PATCHes status: cancelled', async () => {
    server.use(
      http.patch('http://localhost:3000/admin/bookings/booking-1', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ status: 'cancelled' });
        return HttpResponse.json({ ...sampleBooking, status: 'cancelled' });
      }),
    );
    const result = await cancelAdminBooking('booking-1');
    expect(result.status).toBe('cancelled');
  });

  it('reassignAdminBooking PATCHes the new tableId', async () => {
    server.use(
      http.patch('http://localhost:3000/admin/bookings/booking-1', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ tableId: 9 });
        return HttpResponse.json({ ...sampleBooking, tableId: 9 });
      }),
    );
    const result = await reassignAdminBooking('booking-1', 9);
    expect(result.tableId).toBe(9);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd frontend && npm test -- adminBookings.test`
Expected: FAIL — cannot find module `../../../src/api/adminBookings`.

- [ ] **Step 7: Write `frontend/src/api/adminBookings.ts`**

```ts
import { request } from './apiClient';
import { AdminBookingListResponse, Booking, BookingStatus } from './types';

export interface AdminBookingListParams {
  date?: string;
  status?: BookingStatus;
  slotId?: number;
  page?: number;
  pageSize?: number;
}

export function fetchAdminBookings(
  params: AdminBookingListParams,
): Promise<AdminBookingListResponse> {
  const query = new URLSearchParams();
  if (params.date) query.set('date', params.date);
  if (params.status) query.set('status', params.status);
  if (params.slotId !== undefined) query.set('slotId', String(params.slotId));
  if (params.page !== undefined) query.set('page', String(params.page));
  if (params.pageSize !== undefined) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  return request<AdminBookingListResponse>(`/admin/bookings${qs ? `?${qs}` : ''}`, {
    authenticated: true,
  });
}

export function cancelAdminBooking(id: string): Promise<Booking> {
  return request<Booking>(`/admin/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'cancelled' }),
    authenticated: true,
  });
}

export function reassignAdminBooking(id: string, tableId: number): Promise<Booking> {
  return request<Booking>(`/admin/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ tableId }),
    authenticated: true,
  });
}
```

- [ ] **Step 8: Write `frontend/src/hooks/useAdminBookings.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminBookings,
  cancelAdminBooking,
  reassignAdminBooking,
  AdminBookingListParams,
} from '../api/adminBookings';

export function useAdminBookings(params: AdminBookingListParams) {
  return useQuery({
    queryKey: ['admin', 'bookings', params],
    queryFn: () => fetchAdminBookings(params),
  });
}

export function useCancelAdminBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelAdminBooking(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    },
  });
}

export function useReassignAdminBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tableId }: { id: string; tableId: number }) =>
      reassignAdminBooking(id, tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'bookings'] });
    },
  });
}
```

- [ ] **Step 9: Run it to verify it passes**

Run: `cd frontend && npm test -- adminBookings.test`
Expected: 3 passed.

- [ ] **Step 10: Write the failing test `frontend/tests/unit/pages/AdminBookings.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import AdminBookings from '../../../src/pages/AdminBookings';

const booking = {
  id: 'booking-1',
  date: '2026-08-01',
  status: 'confirmed',
  partySize: 2,
  guestName: 'Jane Doe',
  guestEmail: 'jane@example.com',
  guestPhone: null,
  notes: null,
  tableId: 5,
  slotId: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const tablesHandler = http.get('http://localhost:3000/admin/tables', () =>
  HttpResponse.json([
    {
      id: 5,
      name: 'Table 5',
      capacity: 4,
      description: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]),
);
const slotsHandler = http.get('http://localhost:3000/admin/slots', () =>
  HttpResponse.json([
    {
      id: 1,
      label: 'Lunch 12:00',
      startTime: '12:00',
      durationMinutes: 90,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ]),
);

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminBookings />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminBookings', () => {
  it('lists bookings with resolved table names and slot labels', async () => {
    server.use(
      http.get('http://localhost:3000/admin/bookings', () =>
        HttpResponse.json({ bookings: [booking], total: 1 }),
      ),
      tablesHandler,
      slotsHandler,
    );
    renderPage();

    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('Table 5')).toBeInTheDocument();
    expect(screen.getByText('Lunch 12:00')).toBeInTheDocument();
  });

  it('cancels a booking through the confirm dialog', async () => {
    let status: 'confirmed' | 'cancelled' = 'confirmed';
    server.use(
      http.get('http://localhost:3000/admin/bookings', () =>
        HttpResponse.json({ bookings: [{ ...booking, status }], total: 1 }),
      ),
      tablesHandler,
      slotsHandler,
      http.patch('http://localhost:3000/admin/bookings/booking-1', () => {
        status = 'cancelled';
        return HttpResponse.json({ ...booking, status: 'cancelled' });
      }),
    );

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => expect(screen.getByText('cancelled')).toBeInTheDocument());
  });
});
```

- [ ] **Step 11: Run it to verify it fails**

Run: `cd frontend && npm test -- AdminBookings.test`
Expected: FAIL — cannot find module `../../../src/pages/AdminBookings`.

- [ ] **Step 12: Write `frontend/src/pages/AdminBookings.tsx`**

```tsx
import { useState } from 'react';
import { useAdminBookings, useCancelAdminBooking } from '../hooks/useAdminBookings';
import { useAdminTables } from '../hooks/useAdminTables';
import { useAdminSlots } from '../hooks/useAdminSlots';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BookingStatus } from '../api/types';

const PAGE_SIZE = 20;

export default function AdminBookings() {
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<BookingStatus | ''>('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useAdminBookings({
    date: date || undefined,
    status: status || undefined,
    page,
    pageSize: PAGE_SIZE,
  });
  const { data: tables } = useAdminTables();
  const { data: slots } = useAdminSlots();
  const cancelBooking = useCancelAdminBooking();
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  function tableName(tableId: number): string {
    return tables?.find((t) => t.id === tableId)?.name ?? `Table #${tableId}`;
  }
  function slotLabel(slotId: number): string {
    return slots?.find((s) => s.id === slotId)?.label ?? `Slot #${slotId}`;
  }

  return (
    <div className="px-6 py-8">
      <h1 className="font-display text-2xl font-semibold mb-6">Bookings</h1>

      <div className="flex gap-4 mb-6">
        <div>
          <label htmlFor="filter-date" className="block text-sm font-medium mb-1">
            Date
          </label>
          <input
            id="filter-date"
            type="date"
            value={date}
            onChange={(e) => {
              setPage(1);
              setDate(e.target.value);
            }}
            className="rounded border border-border px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="filter-status" className="block text-sm font-medium mb-1">
            Status
          </label>
          <select
            id="filter-status"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as BookingStatus | '');
            }}
            className="rounded border border-border px-3 py-2"
          >
            <option value="">All</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {isLoading && <p>Loading bookings…</p>}
      {isError && (
        <p role="alert" className="text-accent">
          Couldn&apos;t load bookings.
        </p>
      )}

      {data && data.bookings.length === 0 && <p>No bookings match these filters.</p>}

      {data && data.bookings.length > 0 && (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-sm text-text/70">
              <th className="py-2">Guest</th>
              <th className="py-2">Date</th>
              <th className="py-2">Slot</th>
              <th className="py-2">Table</th>
              <th className="py-2">Party</th>
              <th className="py-2">Status</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.bookings.map((booking) => (
              <tr key={booking.id} className="border-b border-border">
                <td className="py-2">{booking.guestName}</td>
                <td className="py-2">{booking.date}</td>
                <td className="py-2">{slotLabel(booking.slotId)}</td>
                <td className="py-2">{tableName(booking.tableId)}</td>
                <td className="py-2">{booking.partySize}</td>
                <td className="py-2 capitalize">{booking.status}</td>
                <td className="py-2">
                  {booking.status === 'confirmed' && (
                    <Button variant="secondary" onClick={() => setCancelTargetId(booking.id)}>
                      Cancel
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && (
        <div className="flex gap-3 mt-4 items-center">
          <Button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-text/70">Page {page}</span>
          <Button
            variant="secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={page * PAGE_SIZE >= data.total}
          >
            Next
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={cancelTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTargetId(null);
        }}
        title="Cancel this booking?"
        description="The guest's table will be released for this slot and date."
        confirmLabel="Confirm cancellation"
        isConfirming={cancelBooking.isPending}
        onConfirm={() => {
          if (cancelTargetId) {
            cancelBooking.mutate(cancelTargetId, { onSuccess: () => setCancelTargetId(null) });
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 13: Modify `frontend/src/App.tsx`** — add the `bookings` nested route and an `/admin` index redirect

```tsx
import { BrowserRouter, Routes, Route, Outlet, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from './pages/Home';
import Book from './pages/Book';
import BookingConfirmation from './pages/BookingConfirmation';
import AdminLogin from './pages/AdminLogin';
import AdminBookings from './pages/AdminBookings';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { RequireAdmin } from './components/RequireAdmin';
import { AdminNav } from './components/AdminNav';

const queryClient = new QueryClient();

function AdminLayout() {
  return (
    <RequireAdmin>
      <AdminNav />
      <Outlet />
    </RequireAdmin>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Book />} />
      <Route path="/bookings/:id" element={<BookingConfirmation />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="bookings" replace />} />
        <Route path="bookings" element={<AdminBookings />} />
        {/* Task 14 adds "tables", Task 15 adds "slots" */}
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 14: Run it to verify it passes**

Run: `cd frontend && npm test -- AdminBookings.test`
Expected: 2 passed.

- [ ] **Step 15: Write the failing flow test `frontend/tests/flows/adminCancelBooking.flow.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../mocks/server';
import { AppRoutes } from '../../src/App';
import { AdminAuthProvider } from '../../src/context/AdminAuthContext';

const booking = {
  id: 'booking-1',
  date: '2026-08-01',
  status: 'confirmed',
  partySize: 2,
  guestName: 'Jane Doe',
  guestEmail: 'jane@example.com',
  guestPhone: null,
  notes: null,
  tableId: 5,
  slotId: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <MemoryRouter initialEntries={['/admin/login']}>
          <AppRoutes />
        </MemoryRouter>
      </AdminAuthProvider>
    </QueryClientProvider>,
  );
}

describe('admin cancel booking flow', () => {
  it('logs in and cancels a booking from the admin bookings list', async () => {
    let status: 'confirmed' | 'cancelled' = 'confirmed';
    server.use(
      http.post('http://localhost:3000/auth/login', () =>
        HttpResponse.json({ accessToken: 'access-1', refreshToken: 'refresh-1' }),
      ),
      http.get('http://localhost:3000/admin/bookings', () =>
        HttpResponse.json({ bookings: [{ ...booking, status }], total: 1 }),
      ),
      http.get('http://localhost:3000/admin/tables', () =>
        HttpResponse.json([
          {
            id: 5,
            name: 'Table 5',
            capacity: 4,
            description: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
      ),
      http.get('http://localhost:3000/admin/slots', () =>
        HttpResponse.json([
          {
            id: 1,
            label: 'Lunch 12:00',
            startTime: '12:00',
            durationMinutes: 90,
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ]),
      ),
      http.patch('http://localhost:3000/admin/bookings/booking-1', () => {
        status = 'cancelled';
        return HttpResponse.json({ ...booking, status: 'cancelled' });
      }),
    );

    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText('Email'), 'admin@test.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => expect(screen.getByText('cancelled')).toBeInTheDocument());
  });
});
```

- [ ] **Step 16: Run it to verify it passes**

Run: `cd frontend && npm test -- adminCancelBooking.flow`
Expected: 1 passed.

- [ ] **Step 17: Run the full frontend test suite to confirm no regressions**

Run: `cd frontend && npm test`
Expected: all suites pass.

- [ ] **Step 18: Commit**

```bash
git add frontend/src/api/adminTables.ts frontend/src/api/adminSlots.ts frontend/src/api/adminBookings.ts frontend/src/hooks/useAdminTables.ts frontend/src/hooks/useAdminSlots.ts frontend/src/hooks/useAdminBookings.ts frontend/src/pages/AdminBookings.tsx frontend/src/App.tsx frontend/tests/unit/api/adminBookings.test.ts frontend/tests/unit/pages/AdminBookings.test.tsx frontend/tests/flows/adminCancelBooking.flow.test.tsx
git commit -m "feat(frontend): admin bookings list/filter/cancel and admin flow test"
```

---

## Task 14: Admin Tables CRUD

**Files:**

- Modify: `frontend/src/api/adminTables.ts`
- Modify: `frontend/src/hooks/useAdminTables.ts`
- Create: `frontend/src/pages/AdminTables.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/unit/api/adminTables.test.ts`
- Test: `frontend/tests/unit/pages/AdminTables.test.tsx`

**Interfaces:**

- Consumes: `request` (Task 4), `Table` (Task 5), `createTableFormSchema`, `CreateTableFormInput`, `UpdateTableFormInput` (Task 5), `Button`, `ConfirmDialog` (Tasks 2, 10), `ApiError` (Task 4), `fetchAdminTables`/`useAdminTables` (Task 13, extended here).
- Produces: `createAdminTable`, `updateAdminTable`, `deleteAdminTable` (added to `api/adminTables.ts`); `useCreateTable`, `useUpdateTable`, `useDeleteTable` (added to `hooks/useAdminTables.ts`, each invalidating the `['admin', 'tables']` query on success); `AdminTables` page mounted at `/admin/tables`.

- [ ] **Step 1: Write the failing test `frontend/tests/unit/api/adminTables.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import {
  fetchAdminTables,
  createAdminTable,
  updateAdminTable,
  deleteAdminTable,
} from '../../../src/api/adminTables';

const sampleTable = {
  id: 1,
  name: 'Table 1',
  capacity: 2,
  description: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('adminTables api', () => {
  it('fetchAdminTables returns the list of tables', async () => {
    server.use(
      http.get('http://localhost:3000/admin/tables', () => HttpResponse.json([sampleTable])),
    );
    expect(await fetchAdminTables()).toEqual([sampleTable]);
  });

  it('createAdminTable POSTs the payload', async () => {
    server.use(
      http.post('http://localhost:3000/admin/tables', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ name: 'Table 2', capacity: 4 });
        return HttpResponse.json(
          {
            id: 2,
            name: 'Table 2',
            capacity: 4,
            description: null,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );
    const result = await createAdminTable({ name: 'Table 2', capacity: 4 });
    expect(result.id).toBe(2);
  });

  it('updateAdminTable PATCHes the payload', async () => {
    server.use(
      http.patch('http://localhost:3000/admin/tables/1', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ capacity: 6 });
        return HttpResponse.json({ ...sampleTable, capacity: 6 });
      }),
    );
    const result = await updateAdminTable(1, { capacity: 6 });
    expect(result.capacity).toBe(6);
  });

  it('deleteAdminTable sends a DELETE', async () => {
    server.use(
      http.delete(
        'http://localhost:3000/admin/tables/1',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await expect(deleteAdminTable(1)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npm test -- adminTables.test`
Expected: FAIL — `createAdminTable`, `updateAdminTable`, `deleteAdminTable` are not exported yet.

- [ ] **Step 3: Modify `frontend/src/api/adminTables.ts`** — append the CRUD functions

```ts
import { request } from './apiClient';
import { Table } from './types';
import { CreateTableFormInput, UpdateTableFormInput } from '../lib/schemas/table.schema';

export function fetchAdminTables(): Promise<Table[]> {
  return request<Table[]>('/admin/tables', { authenticated: true });
}

export function createAdminTable(payload: CreateTableFormInput): Promise<Table> {
  return request<Table>('/admin/tables', {
    method: 'POST',
    body: JSON.stringify(payload),
    authenticated: true,
  });
}

export function updateAdminTable(id: number, payload: UpdateTableFormInput): Promise<Table> {
  return request<Table>(`/admin/tables/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    authenticated: true,
  });
}

export function deleteAdminTable(id: number): Promise<void> {
  return request<void>(`/admin/tables/${id}`, { method: 'DELETE', authenticated: true });
}
```

- [ ] **Step 4: Modify `frontend/src/hooks/useAdminTables.ts`** — append the mutation hooks

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminTables,
  createAdminTable,
  updateAdminTable,
  deleteAdminTable,
} from '../api/adminTables';
import { CreateTableFormInput, UpdateTableFormInput } from '../lib/schemas/table.schema';

export function useAdminTables() {
  return useQuery({ queryKey: ['admin', 'tables'], queryFn: fetchAdminTables });
}

export function useCreateTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTableFormInput) => createAdminTable(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] }),
  });
}

export function useUpdateTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateTableFormInput }) =>
      updateAdminTable(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] }),
  });
}

export function useDeleteTable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAdminTable(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'tables'] }),
  });
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd frontend && npm test -- adminTables.test`
Expected: 4 passed.

- [ ] **Step 6: Write the failing test `frontend/tests/unit/pages/AdminTables.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import AdminTables from '../../../src/pages/AdminTables';

const table = {
  id: 1,
  name: 'Table 1',
  capacity: 2,
  description: '',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminTables />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminTables', () => {
  it('lists tables and creates a new one', async () => {
    let tables = [table];
    server.use(
      http.get('http://localhost:3000/admin/tables', () => HttpResponse.json(tables)),
      http.post('http://localhost:3000/admin/tables', async ({ request: req }) => {
        const body = (await req.json()) as { name: string; capacity: number; description?: string };
        const created = {
          id: 2,
          name: body.name,
          capacity: body.capacity,
          description: body.description ?? null,
          createdAt: '2026-01-01T00:00:00.000Z',
        };
        tables = [...tables, created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Table 1')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Name'), 'Table 2');
    await user.type(screen.getByLabelText('Capacity'), '4');
    await user.click(screen.getByRole('button', { name: 'Add table' }));

    expect(await screen.findByText('Table 2')).toBeInTheDocument();
  });

  it('edits a table', async () => {
    let currentTable = { ...table };
    server.use(
      http.get('http://localhost:3000/admin/tables', () => HttpResponse.json([currentTable])),
      http.patch('http://localhost:3000/admin/tables/1', async ({ request: req }) => {
        const body = (await req.json()) as Record<string, unknown>;
        currentTable = { ...currentTable, ...body } as typeof currentTable;
        return HttpResponse.json(currentTable);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const nameInput = screen.getByLabelText('Edit name');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed Table');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Renamed Table')).toBeInTheDocument();
  });

  it('shows the conflict error when deleting a table with future bookings', async () => {
    server.use(
      http.get('http://localhost:3000/admin/tables', () => HttpResponse.json([table])),
      http.delete('http://localhost:3000/admin/tables/1', () =>
        HttpResponse.json(
          { error: 'ConflictError', message: 'Table has future confirmed bookings' },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete table' }));

    expect(await screen.findByText('Table has future confirmed bookings')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `cd frontend && npm test -- AdminTables.test`
Expected: FAIL — cannot find module `../../../src/pages/AdminTables`.

- [ ] **Step 8: Write `frontend/src/pages/AdminTables.tsx`**

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useAdminTables,
  useCreateTable,
  useUpdateTable,
  useDeleteTable,
} from '../hooks/useAdminTables';
import { createTableFormSchema, CreateTableFormInput } from '../lib/schemas/table.schema';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ApiError } from '../api/apiClient';
import { Table } from '../api/types';

export default function AdminTables() {
  const { data: tables, isLoading, isError } = useAdminTables();
  const createTable = useCreateTable();
  const updateTable = useUpdateTable();
  const deleteTable = useDeleteTable();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ name: '', capacity: '', description: '' });
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTableFormInput>({ resolver: zodResolver(createTableFormSchema) });

  function startEdit(table: Table) {
    setEditingId(table.id);
    setEditValues({
      name: table.name,
      capacity: String(table.capacity),
      description: table.description ?? '',
    });
  }

  function saveEdit(id: number) {
    updateTable.mutate(
      {
        id,
        payload: {
          name: editValues.name,
          capacity: Number(editValues.capacity),
          description: editValues.description,
        },
      },
      { onSuccess: () => setEditingId(null) },
    );
  }

  async function onCreate(values: CreateTableFormInput) {
    await createTable.mutateAsync(values);
    reset();
  }

  function confirmDelete() {
    if (deleteTargetId === null) return;
    setDeleteError(null);
    deleteTable.mutate(deleteTargetId, {
      onSuccess: () => setDeleteTargetId(null),
      onError: (err) => {
        setDeleteError(err instanceof ApiError ? err.message : 'Could not delete table.');
      },
    });
  }

  return (
    <div className="px-6 py-8">
      <h1 className="font-display text-2xl font-semibold mb-6">Tables</h1>

      <form onSubmit={handleSubmit(onCreate)} className="flex gap-3 items-end mb-8">
        <div>
          <label htmlFor="new-name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            id="new-name"
            className="rounded border border-border px-3 py-2"
            {...register('name')}
          />
          {errors.name && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.name.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-capacity" className="block text-sm font-medium mb-1">
            Capacity
          </label>
          <input
            id="new-capacity"
            type="number"
            className="rounded border border-border px-3 py-2 w-24"
            {...register('capacity')}
          />
          {errors.capacity && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.capacity.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-description" className="block text-sm font-medium mb-1">
            Description
          </label>
          <input
            id="new-description"
            className="rounded border border-border px-3 py-2"
            {...register('description')}
          />
        </div>
        <Button type="submit">Add table</Button>
      </form>

      {isLoading && <p>Loading tables…</p>}
      {isError && (
        <p role="alert" className="text-accent">
          Couldn&apos;t load tables.
        </p>
      )}
      {deleteError && (
        <p role="alert" className="text-accent mb-4">
          {deleteError}
        </p>
      )}

      {tables && (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-sm text-text/70">
              <th className="py-2">Name</th>
              <th className="py-2">Capacity</th>
              <th className="py-2">Description</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {tables.map((table) =>
              editingId === table.id ? (
                <tr key={table.id} className="border-b border-border">
                  <td className="py-2">
                    <input
                      aria-label="Edit name"
                      value={editValues.name}
                      onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      className="rounded border border-border px-2 py-1"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label="Edit capacity"
                      type="number"
                      value={editValues.capacity}
                      onChange={(e) => setEditValues((v) => ({ ...v, capacity: e.target.value }))}
                      className="rounded border border-border px-2 py-1 w-20"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label="Edit description"
                      value={editValues.description}
                      onChange={(e) =>
                        setEditValues((v) => ({ ...v, description: e.target.value }))
                      }
                      className="rounded border border-border px-2 py-1"
                    />
                  </td>
                  <td className="py-2 flex gap-2">
                    <Button onClick={() => saveEdit(table.id)}>Save</Button>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={table.id} className="border-b border-border">
                  <td className="py-2">{table.name}</td>
                  <td className="py-2">{table.capacity}</td>
                  <td className="py-2">{table.description}</td>
                  <td className="py-2 flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(table)}>
                      Edit
                    </Button>
                    <Button variant="secondary" onClick={() => setDeleteTargetId(table.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
        title="Delete this table?"
        description="This can't be undone. Tables with future confirmed bookings can't be deleted."
        confirmLabel="Delete table"
        isConfirming={deleteTable.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
```

- [ ] **Step 9: Modify `frontend/src/App.tsx`** — add the `tables` nested route

```tsx
import AdminTables from './pages/AdminTables';
```

Add to the import list at the top, and add this route inside the `/admin` `<Route>` block, after `bookings`:

```tsx
<Route path="tables" element={<AdminTables />} />
```

- [ ] **Step 10: Run it to verify it passes**

Run: `cd frontend && npm test -- AdminTables.test`
Expected: 3 passed.

- [ ] **Step 11: Run the full frontend test suite to confirm no regressions**

Run: `cd frontend && npm test`
Expected: all suites pass.

- [ ] **Step 12: Commit**

```bash
git add frontend/src/api/adminTables.ts frontend/src/hooks/useAdminTables.ts frontend/src/pages/AdminTables.tsx frontend/src/App.tsx frontend/tests/unit/api/adminTables.test.ts frontend/tests/unit/pages/AdminTables.test.tsx
git commit -m "feat(frontend): admin tables crud page"
```

---

## Task 15: Admin Slots CRUD

**Files:**

- Modify: `frontend/src/api/adminSlots.ts`
- Modify: `frontend/src/hooks/useAdminSlots.ts`
- Create: `frontend/src/pages/AdminSlots.tsx`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/tests/unit/api/adminSlots.test.ts`
- Test: `frontend/tests/unit/pages/AdminSlots.test.tsx`

**Interfaces:**

- Consumes: `request` (Task 4), `Slot` (Task 5), `createSlotFormSchema`, `CreateSlotFormInput`, `UpdateSlotFormInput` (Task 5), `Button`, `ConfirmDialog` (Tasks 2, 10), `ApiError` (Task 4), `fetchAdminSlots`/`useAdminSlots` (Task 13, extended here).
- Produces: `createAdminSlot`, `updateAdminSlot`, `deleteAdminSlot` (added to `api/adminSlots.ts`); `useCreateSlot`, `useUpdateSlot`, `useDeleteSlot` (added to `hooks/useAdminSlots.ts`); `AdminSlots` page mounted at `/admin/slots`. This is the last task that touches `App.tsx`'s route tree — after this task the full route set from the spec exists.

- [ ] **Step 1: Write the failing test `frontend/tests/unit/api/adminSlots.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../mocks/server';
import {
  fetchAdminSlots,
  createAdminSlot,
  updateAdminSlot,
  deleteAdminSlot,
} from '../../../src/api/adminSlots';

const sampleSlot = {
  id: 1,
  label: 'Lunch 12:00',
  startTime: '12:00',
  durationMinutes: 90,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('adminSlots api', () => {
  it('fetchAdminSlots returns the list of slots', async () => {
    server.use(
      http.get('http://localhost:3000/admin/slots', () => HttpResponse.json([sampleSlot])),
    );
    expect(await fetchAdminSlots()).toEqual([sampleSlot]);
  });

  it('createAdminSlot POSTs the payload', async () => {
    server.use(
      http.post('http://localhost:3000/admin/slots', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ label: 'Dinner 18:00', startTime: '18:00', durationMinutes: 90 });
        return HttpResponse.json(
          {
            id: 2,
            label: 'Dinner 18:00',
            startTime: '18:00',
            durationMinutes: 90,
            isActive: true,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
          { status: 201 },
        );
      }),
    );
    const result = await createAdminSlot({
      label: 'Dinner 18:00',
      startTime: '18:00',
      durationMinutes: 90,
    });
    expect(result.id).toBe(2);
  });

  it('updateAdminSlot PATCHes the payload', async () => {
    server.use(
      http.patch('http://localhost:3000/admin/slots/1', async ({ request: req }) => {
        const body = await req.json();
        expect(body).toEqual({ isActive: false });
        return HttpResponse.json({ ...sampleSlot, isActive: false });
      }),
    );
    const result = await updateAdminSlot(1, { isActive: false });
    expect(result.isActive).toBe(false);
  });

  it('deleteAdminSlot sends a DELETE', async () => {
    server.use(
      http.delete(
        'http://localhost:3000/admin/slots/1',
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await expect(deleteAdminSlot(1)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npm test -- adminSlots.test`
Expected: FAIL — `createAdminSlot`, `updateAdminSlot`, `deleteAdminSlot` are not exported yet.

- [ ] **Step 3: Modify `frontend/src/api/adminSlots.ts`** — append the CRUD functions

```ts
import { request } from './apiClient';
import { Slot } from './types';
import { CreateSlotFormInput, UpdateSlotFormInput } from '../lib/schemas/slot.schema';

export function fetchAdminSlots(): Promise<Slot[]> {
  return request<Slot[]>('/admin/slots', { authenticated: true });
}

export function createAdminSlot(payload: CreateSlotFormInput): Promise<Slot> {
  return request<Slot>('/admin/slots', {
    method: 'POST',
    body: JSON.stringify(payload),
    authenticated: true,
  });
}

export function updateAdminSlot(id: number, payload: UpdateSlotFormInput): Promise<Slot> {
  return request<Slot>(`/admin/slots/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    authenticated: true,
  });
}

export function deleteAdminSlot(id: number): Promise<void> {
  return request<void>(`/admin/slots/${id}`, { method: 'DELETE', authenticated: true });
}
```

- [ ] **Step 4: Modify `frontend/src/hooks/useAdminSlots.ts`** — append the mutation hooks

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchAdminSlots,
  createAdminSlot,
  updateAdminSlot,
  deleteAdminSlot,
} from '../api/adminSlots';
import { CreateSlotFormInput, UpdateSlotFormInput } from '../lib/schemas/slot.schema';

export function useAdminSlots() {
  return useQuery({ queryKey: ['admin', 'slots'], queryFn: fetchAdminSlots });
}

export function useCreateSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSlotFormInput) => createAdminSlot(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'slots'] }),
  });
}

export function useUpdateSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSlotFormInput }) =>
      updateAdminSlot(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'slots'] }),
  });
}

export function useDeleteSlot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAdminSlot(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'slots'] }),
  });
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd frontend && npm test -- adminSlots.test`
Expected: 4 passed.

- [ ] **Step 6: Write the failing test `frontend/tests/unit/pages/AdminSlots.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { server } from '../../mocks/server';
import AdminSlots from '../../../src/pages/AdminSlots';

const slot = {
  id: 1,
  label: 'Lunch 12:00',
  startTime: '12:00',
  durationMinutes: 90,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AdminSlots />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AdminSlots', () => {
  it('lists slots and creates a new one', async () => {
    let slots = [slot];
    server.use(
      http.get('http://localhost:3000/admin/slots', () => HttpResponse.json(slots)),
      http.post('http://localhost:3000/admin/slots', async ({ request: req }) => {
        const body = (await req.json()) as {
          label: string;
          startTime: string;
          durationMinutes: number;
        };
        const created = { id: 2, ...body, isActive: true, createdAt: '2026-01-01T00:00:00.000Z' };
        slots = [...slots, created];
        return HttpResponse.json(created, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText('Lunch 12:00')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Label'), 'Dinner 18:00');
    await user.type(screen.getByLabelText('Start time'), '18:00');
    await user.type(screen.getByLabelText('Duration (min)'), '90');
    await user.click(screen.getByRole('button', { name: 'Add slot' }));

    expect(await screen.findByText('Dinner 18:00')).toBeInTheDocument();
  });

  it('edits a slot', async () => {
    let currentSlot = { ...slot };
    server.use(
      http.get('http://localhost:3000/admin/slots', () => HttpResponse.json([currentSlot])),
      http.patch('http://localhost:3000/admin/slots/1', async ({ request: req }) => {
        const body = (await req.json()) as Record<string, unknown>;
        currentSlot = { ...currentSlot, ...body } as typeof currentSlot;
        return HttpResponse.json(currentSlot);
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const labelInput = screen.getByLabelText('Edit label');
    await user.clear(labelInput);
    await user.type(labelInput, 'Renamed Slot');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Renamed Slot')).toBeInTheDocument();
  });

  it('shows the conflict error when deleting a slot with future bookings', async () => {
    server.use(
      http.get('http://localhost:3000/admin/slots', () => HttpResponse.json([slot])),
      http.delete('http://localhost:3000/admin/slots/1', () =>
        HttpResponse.json(
          { error: 'ConflictError', message: 'Slot has future confirmed bookings' },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Delete slot' }));

    expect(await screen.findByText('Slot has future confirmed bookings')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `cd frontend && npm test -- AdminSlots.test`
Expected: FAIL — cannot find module `../../../src/pages/AdminSlots`.

- [ ] **Step 8: Write `frontend/src/pages/AdminSlots.tsx`**

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAdminSlots, useCreateSlot, useUpdateSlot, useDeleteSlot } from '../hooks/useAdminSlots';
import { createSlotFormSchema, CreateSlotFormInput } from '../lib/schemas/slot.schema';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ApiError } from '../api/apiClient';
import { Slot } from '../api/types';

export default function AdminSlots() {
  const { data: slots, isLoading, isError } = useAdminSlots();
  const createSlot = useCreateSlot();
  const updateSlot = useUpdateSlot();
  const deleteSlot = useDeleteSlot();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({
    label: '',
    startTime: '',
    durationMinutes: '',
    isActive: true,
  });
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateSlotFormInput>({ resolver: zodResolver(createSlotFormSchema) });

  function startEdit(slot: Slot) {
    setEditingId(slot.id);
    setEditValues({
      label: slot.label,
      startTime: slot.startTime,
      durationMinutes: String(slot.durationMinutes),
      isActive: slot.isActive,
    });
  }

  function saveEdit(id: number) {
    updateSlot.mutate(
      {
        id,
        payload: {
          label: editValues.label,
          startTime: editValues.startTime,
          durationMinutes: Number(editValues.durationMinutes),
          isActive: editValues.isActive,
        },
      },
      { onSuccess: () => setEditingId(null) },
    );
  }

  async function onCreate(values: CreateSlotFormInput) {
    await createSlot.mutateAsync(values);
    reset();
  }

  function confirmDelete() {
    if (deleteTargetId === null) return;
    setDeleteError(null);
    deleteSlot.mutate(deleteTargetId, {
      onSuccess: () => setDeleteTargetId(null),
      onError: (err) => {
        setDeleteError(err instanceof ApiError ? err.message : 'Could not delete slot.');
      },
    });
  }

  return (
    <div className="px-6 py-8">
      <h1 className="font-display text-2xl font-semibold mb-6">Time Slots</h1>

      <form onSubmit={handleSubmit(onCreate)} className="flex gap-3 items-end mb-8">
        <div>
          <label htmlFor="new-label" className="block text-sm font-medium mb-1">
            Label
          </label>
          <input
            id="new-label"
            className="rounded border border-border px-3 py-2"
            {...register('label')}
          />
          {errors.label && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.label.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-startTime" className="block text-sm font-medium mb-1">
            Start time
          </label>
          <input
            id="new-startTime"
            placeholder="HH:MM"
            className="rounded border border-border px-3 py-2 w-24"
            {...register('startTime')}
          />
          {errors.startTime && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.startTime.message}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="new-durationMinutes" className="block text-sm font-medium mb-1">
            Duration (min)
          </label>
          <input
            id="new-durationMinutes"
            type="number"
            className="rounded border border-border px-3 py-2 w-24"
            {...register('durationMinutes')}
          />
          {errors.durationMinutes && (
            <p role="alert" className="text-accent text-sm mt-1">
              {errors.durationMinutes.message}
            </p>
          )}
        </div>
        <Button type="submit">Add slot</Button>
      </form>

      {isLoading && <p>Loading slots…</p>}
      {isError && (
        <p role="alert" className="text-accent">
          Couldn&apos;t load slots.
        </p>
      )}
      {deleteError && (
        <p role="alert" className="text-accent mb-4">
          {deleteError}
        </p>
      )}

      {slots && (
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border text-sm text-text/70">
              <th className="py-2">Label</th>
              <th className="py-2">Start</th>
              <th className="py-2">Duration</th>
              <th className="py-2">Active</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) =>
              editingId === slot.id ? (
                <tr key={slot.id} className="border-b border-border">
                  <td className="py-2">
                    <input
                      aria-label="Edit label"
                      value={editValues.label}
                      onChange={(e) => setEditValues((v) => ({ ...v, label: e.target.value }))}
                      className="rounded border border-border px-2 py-1"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label="Edit start time"
                      value={editValues.startTime}
                      onChange={(e) => setEditValues((v) => ({ ...v, startTime: e.target.value }))}
                      className="rounded border border-border px-2 py-1 w-20"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label="Edit duration"
                      type="number"
                      value={editValues.durationMinutes}
                      onChange={(e) =>
                        setEditValues((v) => ({ ...v, durationMinutes: e.target.value }))
                      }
                      className="rounded border border-border px-2 py-1 w-20"
                    />
                  </td>
                  <td className="py-2">
                    <input
                      aria-label="Edit active"
                      type="checkbox"
                      checked={editValues.isActive}
                      onChange={(e) => setEditValues((v) => ({ ...v, isActive: e.target.checked }))}
                    />
                  </td>
                  <td className="py-2 flex gap-2">
                    <Button onClick={() => saveEdit(slot.id)}>Save</Button>
                    <Button variant="secondary" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </td>
                </tr>
              ) : (
                <tr key={slot.id} className="border-b border-border">
                  <td className="py-2">{slot.label}</td>
                  <td className="py-2">{slot.startTime}</td>
                  <td className="py-2">{slot.durationMinutes} min</td>
                  <td className="py-2">{slot.isActive ? 'Yes' : 'No'}</td>
                  <td className="py-2 flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(slot)}>
                      Edit
                    </Button>
                    <Button variant="secondary" onClick={() => setDeleteTargetId(slot.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      )}

      <ConfirmDialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null);
        }}
        title="Delete this slot?"
        description="This can't be undone. Slots with future confirmed bookings can't be deleted."
        confirmLabel="Delete slot"
        isConfirming={deleteSlot.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
```

- [ ] **Step 9: Modify `frontend/src/App.tsx`** — add the `slots` nested route

```tsx
import AdminSlots from './pages/AdminSlots';
```

Add to the import list at the top, and add this route inside the `/admin` `<Route>` block, after `tables`:

```tsx
<Route path="slots" element={<AdminSlots />} />
```

The full nested block now reads:

```tsx
<Route path="/admin" element={<AdminLayout />}>
  <Route index element={<Navigate to="bookings" replace />} />
  <Route path="bookings" element={<AdminBookings />} />
  <Route path="tables" element={<AdminTables />} />
  <Route path="slots" element={<AdminSlots />} />
</Route>
```

- [ ] **Step 10: Run it to verify it passes**

Run: `cd frontend && npm test -- AdminSlots.test`
Expected: 3 passed.

- [ ] **Step 11: Run the full frontend test suite to confirm no regressions**

Run: `cd frontend && npm test`
Expected: all suites pass — this is the complete frontend test suite (guest flow + admin CRUD + both flow tests).

- [ ] **Step 12: Type-check and lint the whole frontend**

Run: `cd frontend && npx tsc -b && npm run lint && npm run format`
Expected: no errors.

- [ ] **Step 13: Commit**

```bash
git add frontend/src/api/adminSlots.ts frontend/src/hooks/useAdminSlots.ts frontend/src/pages/AdminSlots.tsx frontend/src/App.tsx frontend/tests/unit/api/adminSlots.test.ts frontend/tests/unit/pages/AdminSlots.test.tsx
git commit -m "feat(frontend): admin slots crud page"
```

---

## Task 16: Wire Frontend into CI

**Files:**

- Modify: `.github/workflows/ci.yml`

**Interfaces:**

- Consumes: `frontend/package.json`'s `lint`, `format`, `test`, `build` scripts (Task 1).
- Produces: nothing consumed by later tasks — this is the last task in the plan.

- [ ] **Step 1: Modify `.github/workflows/ci.yml`** — replace the file with the version below. Changes from the current file: `cache-dependency-path` covers both lockfiles in all three jobs; the `lint` job adds a frontend install + `lint` + `format`; the `test` job adds a frontend install + `test`; the `build` job adds a frontend install + `build` (before the Docker steps, since the frontend build doesn't depend on Postgres/Docker).

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
          cache-dependency-path: |
            package-lock.json
            frontend/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run format
      - run: npm ci
        working-directory: frontend
      - run: npm run lint
        working-directory: frontend
      - run: npm run format
        working-directory: frontend

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
          cache-dependency-path: |
            package-lock.json
            frontend/package-lock.json
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma migrate deploy
      - run: npm run test:unit -- --coverage
      - run: npm run test:integration
      - run: npm ci
        working-directory: frontend
      - run: npm test
        working-directory: frontend
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

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
          cache-dependency-path: |
            package-lock.json
            frontend/package-lock.json
      - run: npm ci
      - run: npm run build
      - run: npm ci
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
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

- [ ] **Step 2: Validate the YAML is well-formed**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))" && echo OK`
Expected: `OK`

- [ ] **Step 3: Push a branch and open a PR (or push directly if working on `main` per this repo's existing workflow) to confirm the CI run passes end to end**

Run: `git push -u origin HEAD` (or the repo's usual flow) and watch the Actions run for the commit.
Expected: `lint`, `test`, and `build` jobs all pass, including the new frontend steps.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run frontend lint, test, and build alongside backend"
```

---
