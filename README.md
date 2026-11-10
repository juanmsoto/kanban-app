# Kanban con equipos

Tablero Kanban con equipos (tipo Trello). Proyecto de aprendizaje: cada pieza importante está escrita y entendida paso a paso.

**Estado:** versión 1 casi completa. En la app funcionan el registro y el login, los tableros, las columnas y tarjetas (crear, editar, eliminar), el arrastre de tarjetas y columnas con mouse o teclado y los miembros de cada tablero (el dueño agrega por email, cambia roles y quita; cualquier miembro puede salirse), respetando el rol de cada usuario. El estado detallado y los próximos pasos están en [`PROGRESO.md`](PROGRESO.md).

## Stack

| Parte | Tecnología |
|---|---|
| Backend | Node 22, Express 5, TypeScript |
| Base de datos | PostgreSQL 16 con Drizzle ORM (migraciones) |
| Autenticación | JWT en el header `Authorization: Bearer <token>`, contraseñas con bcrypt |
| Validación | Zod |
| Seguridad | `helmet` (headers de seguridad), `express-rate-limit` (límite de intentos en login y registro), CORS solo para el origen del frontend |
| Tests | Vitest + supertest (tests de integración contra una base de tests) |
| Frontend | React 19 + TypeScript con Vite, React Router, CSS Modules, `@dnd-kit/react` para arrastrar y soltar |

La API es JSON puro (sin vistas ni redirects): sirve igual para la web y para una futura app móvil.

## Cómo correrlo

Requisitos: Node 22.12 o más nuevo y PostgreSQL 16. Se levantan dos procesos: la API (`backend/`, puerto 3000) y el frontend (`frontend/`, puerto 5173).

### Backend

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

3. Completar el `.env`: la contraseña del rol en las dos URLs y un `JWT_SECRET` propio (`openssl rand -hex 32`). La API no arranca con el valor de la plantilla ni con secretos de menos de 32 caracteres. `CORS_ORIGIN` ya apunta al frontend local (`http://localhost:5173`).

4. Aplicar las migraciones a las dos bases:

   ```bash
   npm run db:migrate
   npm run db:migrate:test
   ```

5. Levantar la API (en `http://localhost:3000`) o correr los tests:

   ```bash
   npm run dev
   npm test
   ```

Los tests vacían las tablas de `kanban_app_test` entre un test y otro y se niegan a correr contra una base cuyo nombre no termine en `_test`. Hay que correr un solo proceso de tests a la vez.

### Frontend

Con la API ya corriendo, en otra terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

La app queda en `http://localhost:5173`. El `.env` solo tiene `VITE_API_URL` (la dirección de la API). Todo lo que empieza con `VITE_` termina visible en el código que descarga el navegador: nunca va ahí un secreto.

## Scripts

En `backend/`:

| Script | Qué hace |
|---|---|
| `npm run dev` | API con recarga automática |
| `npm test` | Tests de integración |
| `npm run typecheck` | Chequeo de tipos sin compilar |
| `npm run build` / `npm start` | Compila a `dist/` y la ejecuta |
| `npm run db:generate` | Genera una migración a partir del esquema de Drizzle |
| `npm run db:migrate` / `db:migrate:test` | Aplica las migraciones (desarrollo / tests) |

En `frontend/`:

| Script | Qué hace |
|---|---|
| `npm run dev` | App con recarga automática en `http://localhost:5173` |
| `npm run build` | Chequea tipos y genera la versión de producción en `dist/` |
| `npm run preview` | Sirve esa versión de producción para probarla |
| `npm run lint` | Revisa el código con oxlint |

## Endpoints

| Método y ruta | Auth | Descripción |
|---|---|---|
| `GET /health` | no | Responde 200 si la API llega a la base |
| `POST /auth/register` | no | Crea un usuario (`name`, `email`, `password`). Máximo 10 registros por hora por IP |
| `POST /auth/login` | no | Devuelve `{ token, user }`. Máximo 10 intentos fallidos cada 15 minutos por IP |
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
| `PATCH /columns/:id/move` | sí | Mueve la columna: body `{ "afterId": <id de la columna que queda antes> \| null }` (`editor`) |
| `DELETE /columns/:id` | sí | Borra la columna con sus tarjetas (`editor`); 204 |
| `POST /columns/:id/cards` | sí | Crea una tarjeta al final de la columna (`editor`) |
| `PATCH /cards/:id` | sí | Cambia `title` y/o `description` (`editor`) |
| `PATCH /cards/:id/move` | sí | Mueve la tarjeta, incluso a otra columna del mismo tablero: body `{ "columnId": <columna destino>, "afterId": <id de la tarjeta que queda arriba> \| null }` (`editor`) |
| `DELETE /cards/:id` | sí | Borra la tarjeta (`editor`); 204 |

Roles por tablero: `owner`, `editor`, `viewer`. Quien no es miembro recibe 404 (no se revela que el tablero existe); un miembro sin rol suficiente recibe 403.

Los errores siempre llegan como JSON: `{ "error": "<mensaje>" }`, y en los 400 de validación además `fields` con los errores de cada campo. Pasado el límite de intentos, login y registro responden 429 y los headers `RateLimit` y `RateLimit-Policy` dicen cuándo se puede volver a intentar.

El orden de columnas y tarjetas se guarda en un número `position` que calcula siempre el servidor: el cliente nunca lo manda. Para mover, el cliente dice "después de quién" (`afterId`, `null` = al principio) y el servidor elige la posición (el punto medio entre las dos vecinas; si ya no queda hueco, renumera esa lista). Un `afterId` o un `columnId` que no corresponde (no existe, es de otro tablero o es el propio elemento) responde 400 `Movimiento invalido`. Como un movimiento puede renumerar a las demás, el cliente debe confiar en el orden en que le llegan las listas y no guardar posiciones.

## Organización

```text
backend/
  src/
    db/            cliente de Drizzle y esquema
    middlewares/   requireAuth, límite de intentos, manejo de errores
    modules/       auth/, boards/, columns/, cards/ (routes, controller, service, schemas)
    errors.ts      errores compartidos (autorización y movimiento inválido)
    position.ts    cálculo de la posición de un elemento entre dos vecinos
    config.ts      variables de entorno validadas
  test/            tests de integración (uno por módulo)
  drizzle/         migraciones generadas

frontend/src/
  main.tsx, App.tsx, index.css   entrada, rutas y estilos globales
  pages/          pantallas que no son de ninguna funcionalidad (inicio, página no encontrada)
  components/     piezas visuales compartidas (ui/, layout/)
  routes/         guardias de ruteo (rutas protegidas y públicas)
  context/        sesión del usuario (React Context)
  services/       comunicación con la API (apiFetch, errores, token, tipos)
  features/       una carpeta por funcionalidad (auth/, boards/), cada una con pages/, components/ y services/
```

En el frontend, una funcionalidad nunca importa de otra: lo que comparten va a las carpetas de arriba.

## Convenciones

- Commits: Conventional Commits (`feat`, `fix`, `docs`, `chore`, `refactor`, `test`).
- Una rama `feature/<nombre>` por bloque de trabajo; `main` solo recibe merges con squash y un tag de hito (`hito-setup`, `hito-auth`, ...). Las ramas `feature/*` no se borran.
