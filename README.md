# Kanban con equipos

Tablero Kanban con equipos (tipo Trello). Proyecto de aprendizaje: cada pieza importante está escrita y entendida paso a paso.

**Estado:** en desarrollo. Hoy existe el backend (API JSON) con autenticación y la base de los tableros. El frontend (React) todavía no empezó. El estado detallado y los próximos pasos están en [`PROGRESO.md`](PROGRESO.md).

## Stack

| Parte | Tecnología |
|---|---|
| Backend | Node 22, Express 5, TypeScript |
| Base de datos | PostgreSQL 16 con Drizzle ORM (migraciones) |
| Autenticación | JWT en el header `Authorization: Bearer <token>`, contraseñas con bcrypt |
| Validación | Zod |
| Tests | Vitest + supertest (tests de integración contra una base de tests) |
| Frontend (pendiente) | React + TypeScript (Vite) |

La API es JSON puro (sin vistas ni redirects): sirve igual para la web y para una futura app móvil.

## Cómo correr el backend

Requisitos: Node 22 y PostgreSQL 16.

1. Crear un rol sin privilegios de superusuario y dos bases (desarrollo y tests):

   ```bash
   createuser --pwprompt kanban_app
   createdb -O kanban_app kanban_app
   createdb -O kanban_app kanban_app_test
   ```

2. Instalar dependencias y crear el `.env` a partir de la plantilla (con `cp`, no lo renombres):

   ```bash
   cd backend
   npm install
   cp .env.example .env
   ```

3. Completar el `.env`: la contraseña del rol en las dos URLs y un `JWT_SECRET` propio (`openssl rand -hex 32`). La API no arranca con el valor de la plantilla ni con secretos de menos de 32 caracteres.

4. Aplicar las migraciones a las dos bases:

   ```bash
   npm run db:migrate
   npm run db:migrate:test
   ```

5. Levantar la API (por defecto en `http://localhost:3000`) o correr los tests:

   ```bash
   npm run dev
   npm test
   ```

Los tests vacían las tablas de `kanban_app_test` entre un test y otro y se niegan a correr contra una base cuyo nombre no termine en `_test`. Hay que correr un solo proceso de tests a la vez.

## Scripts (en `backend/`)

| Script | Qué hace |
|---|---|
| `npm run dev` | API con recarga automática |
| `npm test` | Tests de integración |
| `npm run typecheck` | Chequeo de tipos sin compilar |
| `npm run build` / `npm start` | Compila a `dist/` y la ejecuta |
| `npm run db:generate` | Genera una migración a partir del esquema de Drizzle |
| `npm run db:migrate` / `db:migrate:test` | Aplica las migraciones (desarrollo / tests) |

## Endpoints

| Método y ruta | Auth | Descripción |
|---|---|---|
| `GET /health` | no | Responde 200 si la API llega a la base |
| `POST /auth/register` | no | Crea un usuario (`name`, `email`, `password`) |
| `POST /auth/login` | no | Devuelve `{ token, user }` |
| `GET /auth/me` | sí | Datos del usuario autenticado |
| `POST /boards` | sí | Crea un tablero; quien lo crea queda como `owner` |
| `GET /boards/:id` | sí | Devuelve `{ board, role }` si el usuario es miembro; 404 si no lo es |

Roles por tablero: `owner`, `editor`, `viewer`. Quien no es miembro recibe 404 (no se revela que el tablero existe); un miembro sin rol suficiente recibe 403.

## Organización

```text
backend/
  src/
    db/            cliente de Drizzle y esquema
    middlewares/   requireAuth, manejo de errores
    modules/       auth/, boards/ (routes, controller, service, schemas)
    errors.ts      errores de autorización compartidos
    config.ts      variables de entorno validadas
  test/            tests de integración (uno por módulo)
  drizzle/         migraciones generadas
```

## Convenciones

- Commits: Conventional Commits (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`).
- Una rama `feature/<nombre>` por bloque de trabajo; `main` solo recibe merges con squash y un tag de hito (`hito-setup`, `hito-auth`, ...). Las ramas `feature/*` no se borran.
