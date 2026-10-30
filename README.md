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
| `GET /boards` | sí | Lista los tableros del usuario, cada uno con su `role` (el más nuevo primero) |
| `GET /boards/:id` | sí | El tablero con su `role` y sus `columns` en orden, cada una con sus `cards` en orden (`viewer`) |
| `PATCH /boards/:id` | sí | Cambia `name` y/o `description` (`editor`) |
| `DELETE /boards/:id` | sí | Borra el tablero con sus columnas y tarjetas (`owner`); 204 |
| `GET /boards/:id/members` | sí | Lista los miembros con su rol (`viewer`) |
| `POST /boards/:id/members` | sí | Agrega un miembro por `email` con un `role` (`owner`) |
| `PATCH /boards/:id/members/:userId` | sí | Cambia el rol de un miembro (`owner`); el tablero siempre conserva al menos un owner |
| `DELETE /boards/:id/members/:userId` | sí | Quita a un miembro (`owner`), o cualquier miembro puede salirse solo; 204 |
| `GET /boards/:id/columns` | sí | Lista las columnas en orden (`viewer`) |
| `POST /boards/:id/columns` | sí | Crea una columna al final (`editor`) |
| `PATCH /columns/:id` | sí | Cambia el `title` de la columna (`editor`) |
| `PATCH /columns/:id/move` | sí | Mueve la columna: body `{ "afterId": <id de la columna que queda arriba> \| null }` (`editor`) |
| `DELETE /columns/:id` | sí | Borra la columna con sus tarjetas (`editor`); 204 |
| `POST /columns/:id/cards` | sí | Crea una tarjeta al final de la columna (`editor`) |
| `PATCH /cards/:id` | sí | Cambia `title` y/o `description` (`editor`) |
| `PATCH /cards/:id/move` | sí | Mueve la tarjeta, incluso a otra columna del mismo tablero: body `{ "columnId": <columna destino>, "afterId": <id de la tarjeta que queda arriba> \| null }` (`editor`) |
| `DELETE /cards/:id` | sí | Borra la tarjeta (`editor`); 204 |

Roles por tablero: `owner`, `editor`, `viewer`. Quien no es miembro recibe 404 (no se revela que el tablero existe); un miembro sin rol suficiente recibe 403.

El orden de columnas y tarjetas se guarda en un número `position` que calcula siempre el servidor: el cliente nunca lo manda. Para mover, el cliente dice "después de quién" (`afterId`, `null` = al principio) y el servidor elige la posición (el punto medio entre las dos vecinas; si ya no queda hueco, renumera esa lista). Un `afterId` o un `columnId` que no corresponde (no existe, es de otro tablero o es el propio elemento) responde 400 `Movimiento invalido`. Como un movimiento puede renumerar a las demás, el cliente debe confiar en el orden en que le llegan las listas y no guardar posiciones.

## Organización

```text
backend/
  src/
    db/            cliente de Drizzle y esquema
    middlewares/   requireAuth, manejo de errores
    modules/       auth/, boards/, columns/, cards/ (routes, controller, service, schemas)
    errors.ts      errores compartidos (autorización y movimiento inválido)
    position.ts    cálculo de la posición de un elemento entre dos vecinos
    config.ts      variables de entorno validadas
  test/            tests de integración (uno por módulo)
  drizzle/         migraciones generadas
```

## Convenciones

- Commits: Conventional Commits (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`).
- Una rama `feature/<nombre>` por bloque de trabajo; `main` solo recibe merges con squash y un tag de hito (`hito-setup`, `hito-auth`, ...). Las ramas `feature/*` no se borran.
