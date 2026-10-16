# Repository Guidelines

## Project Structure & Module Organization

This is a SvelteKit application. Route pages and server handlers live in `src/routes/`; reusable business logic and UI components live in `src/lib/`. Shared UI primitives are under `src/lib/components/ui/`. Static images and icons belong in `static/`. Database migrations are in `drizzle/`, with migration tooling and seed scripts in `scripts/`. Keep route-specific data loading in the route's `+page.server.ts` and reusable logic in `src/lib/`.

## Build, Test, and Development Commands

- `pnpm install` installs dependencies (Node.js 22+ and pnpm 9+).
- `pnpm dev` starts the local Vite development server.
- `pnpm check` runs Svelte and TypeScript diagnostics.
- `pnpm build` creates a production build; `pnpm preview` serves it locally.
- `pnpm docker:up` starts the app and PostgreSQL in Docker; `pnpm docker:down` stops them.
- `pnpm db:generate` creates a Drizzle migration from schema changes; `pnpm db:migrate` applies migrations.

## Coding Style & Naming Conventions

Follow the existing TypeScript and Svelte style: tabs for indentation, single quotes where used, and semicolons in TypeScript. Use SvelteKit's file conventions (`+page.svelte`, `+page.server.ts`) and descriptive kebab-case names for component files. Keep database changes in numbered Drizzle migrations rather than editing applied migrations. Reuse shared helpers and UI components from `src/lib/`.

## Testing Guidelines

No dedicated automated test suite is configured. Run `pnpm check` and `pnpm build` for changes affecting application code. For UI changes, verify the affected route in `pnpm dev`; for database changes, apply migrations against a development database and verify the affected workflow.

## Commit & Pull Request Guidelines

Recent commits use concise, lowercase Spanish summaries with a change-type prefix, such as `add: devcontainer para el proyecto`, `fix: se corrige bug en botón`, and `change: se agregan filtros`. Follow that pattern and keep each commit focused. Pull requests should describe the user-visible change, note relevant database or environment changes, link related issues when available, and include screenshots for substantial UI changes.

## Security & Configuration

Copy `.env.example` to `.env` for local configuration. Never commit secrets or production credentials. Database access uses `DATABASE_URL`; review environment and migration impact before changing authentication or database behavior.
