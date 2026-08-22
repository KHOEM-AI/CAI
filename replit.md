# CAI Pro Vision

Khmer-first AI-assisted field scanning for secure counting, GPS-aware records, and role-based operations.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/cai-pro-vision` — responsive web application and scanner workspace
- `artifacts/api-server` — shared Express API for authentication, scans, and dashboard summary
- `lib/api-spec/openapi.yaml` — source of truth for generated API clients and validation
- `lib/db/src/schema/cai.ts` — PostgreSQL schema for CAI users and signed scans

## Architecture decisions

- The web app is designed as a PWA-style responsive surface so the same workspace works on phones, desktops, and browser-capable displays.
- Scan image fingerprints are created locally with SHA-256 before the record is sent to the API.
- The first AI assist uses local TensorFlow.js coco-ssd inference with manual correction because the general model is not trained specifically for Cambodian wood or sugarcane workflows.

## Product

Users can sign in with a database-backed account, upload a field image, run local object detection, correct the count, attach GPS, save a signed record, search history, export CSV, and review dashboard summaries. Admins can see team-wide records while staff see their own records.

## User preferences

The user prefers Khmer-first experiences and wants the app to be usable across Android, iOS, computers, and other browser-capable electronics.

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
