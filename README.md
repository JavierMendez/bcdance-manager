# BC Dance Manager

Aplicación de gestión para BC Dance, construida con SvelteKit.

## Requisitos

- Node.js 22+
- pnpm 9+
- Docker (opcional)

## Desarrollo local

```sh
pnpm install
cp .env.example .env
pnpm dev
```

## Docker

### Desarrollo

Levanta la app en modo desarrollo con hot-reload y PostgreSQL:

```sh
cp .env.example .env
pnpm docker:up
```

- App: http://localhost:5173
- Migraciones: `docker compose exec app pnpm db:migrate`

```sh
pnpm docker:logs   # ver logs
pnpm docker:down   # detener
```

### Producción

Construye y publica la aplicación en Docker (build optimizado + migraciones automáticas). Usa `DATABASE_URL` de tu `.env` (p. ej. Supabase):

```sh
cp .env.example .env
pnpm docker:prod:up
```

- App: http://localhost:5174
- Las migraciones se ejecutan al iniciar el contenedor contra la base configurada en `DATABASE_URL`

```sh
pnpm docker:prod:logs   # ver logs
pnpm docker:prod:down   # detener
```

### Solo base de datos

```sh
pnpm docker:db
```

Usa `DATABASE_URL=postgresql://bcdance:bcdance@localhost:5432/bcdance_manager` en `.env`.

## Supabase

Para usar la base de datos de Supabase en lugar de Postgres local, configura en `.env`:

```env
DATABASE_URL=postgresql://postgres.[PROJECT_REF]:[YOUR-PASSWORD]@aws-1-us-west-2.pooler.supabase.com:5432/postgres
```

Sustituye `[YOUR-PASSWORD]` por la contraseña de la base de datos (Supabase → Project Settings → Database).

Aplica el esquema y crea el admin:

```sh
pnpm db:migrate
pnpm seed:admin
```

La app detecta conexiones a `supabase.co` y activa SSL automáticamente.

## Build

```sh
pnpm build
pnpm preview
```

## Solución de problemas

### `Cannot find native binding` (rolldown / esbuild)

Suele ocurrir si `node_modules` se instaló dentro de Docker (Linux) y luego ejecutas `pnpm dev` en macOS. Las dependencias nativas son distintas por plataforma.

**Solución:** reinstala en tu máquina local:

```sh
rm -rf node_modules
pnpm install
```

No ejecutes `pnpm install` montando el proyecto en un contenedor Docker si vas a desarrollar en local. Usa `pnpm docker:up` para desarrollo en Docker (tiene su propio volumen de `node_modules`).
