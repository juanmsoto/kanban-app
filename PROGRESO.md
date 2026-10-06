# Progreso: Kanban con equipos

## Dónde estamos y qué sigue
Proyecto recién creado (2026-10-05). Carpeta con `CLAUDE.md` y `PROGRESO.md`; todavía no es un repo git.
**Próximo paso:** 1.4c (pequeño arreglo del config) y después 1.5: `app.ts` / `server.ts` con `GET /health` y el primer test de integración.

## Plan
- [x] Bloque 0: Fundamentos (sin código de app)
  - [x] 0.1 Modelo de datos en papel (tablas, relaciones, cómo guardar el orden)
  - [x] 0.2 Repaso de JS cliente: React vs DOM manual, filter, map/spread, referencias, destructuring
  - [x] 0.3 Estructura de carpetas frontend/backend
- [ ] Bloque 1 `feature/setup`: backend Express+TS, Postgres, Drizzle (conexión, esquema, primera migración), Vitest+supertest funcionando
  - [x] 1.1 Postgres local con rol propio `kanban_app` (sin superusuario) y bases `kanban_app` / `kanban_app_test`
  - [x] 1.2 Proyecto `backend/`: package.json, dependencias, tsconfig (typecheck y build)
  - [x] 1.3a `.env` / `.env.example` (ambas URLs verificadas: conectan como `kanban_app` a su base)
  - [x] 1.3b Cliente de Drizzle (`src/db/client.ts`): verificado en dev, con NODE_ENV=test (va a kanban_app_test) y sin variables (falla con mensaje claro)
  - [x] 1.4a Esquema de Drizzle (`src/db/schema.ts`, 5 tablas, `snakeCase.table`, `pgEnum`, PK compuesta): compila y los tipos inferidos coinciden con el diseño
  - [x] 1.4b `drizzle.config.ts`, migración `esquema_inicial` generada, revisada y aplicada a `kanban_app` y `kanban_app_test`; verificado en `psql` (cascade, enum, UNIQUE, PK compuesta, identity ALWAYS)
  - [ ] 1.4c Corregir `drizzle.config.ts`: `db:generate` no debería exigir la URL de la base (solo `migrate` la necesita)
  - [ ] 1.5 `app.ts` / `server.ts` con `GET /health` y primer test de integración (Vitest + supertest)
- [ ] Bloque 2 `feature/auth`: registro y login, decisión header vs cookie, JWT, middleware, tests
- [ ] Bloque 3 `feature/boards`: workspaces/tableros, miembros, permisos por tablero (muchos-a-muchos), tests
- [ ] Bloque 4 `feature/columns-cards`: columnas y tarjetas, orden persistido, mover/reordenar, tests
- [ ] Bloque 5 `feature/frontend-base`: Vite+React, rutas (`/boards/:id`), estado local y global, formularios controlados, login desde el cliente
- [ ] Bloque 6 `feature/board-ui`: render del tablero, crear/editar tarjetas sin recargar
- [ ] Bloque 7 `feature/dnd`: drag and drop con actualización optimista
- [ ] Bloque 8 `feature/pulido-v1`: errores, estados de carga, revisión de seguridad, README

Hitos (tags): `hito-setup`, `hito-auth`, `hito-boards`, `hito-columns-cards`, `hito-frontend-base`, `hito-board-ui`, `hito-dnd`, `hito-pulido-v1`.
Los tests de integración del backend van dentro de cada bloque, no aparte.

## Modelo de datos (v1)
```text
users ──< board_members >── boards ──< columns ──< cards
```
| Tabla | Columnas | Relaciones |
|---|---|---|
| `users` | id (identity), name, email (UNIQUE, minúsculas), password_hash, created_at | - |
| `boards` | id, name, description?, created_at, updated_at | - |
| `board_members` | board_id, user_id, role (enum owner/editor/viewer), created_at. PK (board_id, user_id) | FK a boards y users, ON DELETE CASCADE |
| `columns` | id, board_id, title, position (double precision), created_at | FK a boards, CASCADE |
| `cards` | id, column_id, title, description?, position (double precision), created_at, updated_at | FK a columns, CASCADE |

Reglas pendientes para más adelante: un tablero nunca queda sin `owner`; autorizar siempre por membresía (card -> column -> board -> board_members); índice sobre `lower(email)` como red de seguridad.

## Mapa de herramientas
Ver tabla en `CLAUDE.md`. 2026-10-05: niveles recalibrados leyendo `ventas-app`; Juan aclaró que no domina Node/Express/TS/JWT (solo sabe trabajar con ellos), así que pasan de nivel 3 a nivel 2. Solo SQL a mano queda en nivel 3.

## Conceptos cubiertos
- Migraciones con Drizzle: `db:generate` (escribe SQL + snapshot, no toca la base), `db:migrate` (aplica y registra en `drizzle.__drizzle_migrations`), una migración por cambio de esquema; el SQL generado se revisa antes de aplicar. Columnas de PK son NOT NULL implícito.
- Drizzle: `db` vs `pool`, tablas como código (`snakeCase.table`), columnas encadenadas, `.notNull()` -> tipo `T` vs `T | null`, FK con `.references` y `onDelete: 'cascade'`, PK compuesta, `pgEnum`, `$onUpdate` (lo hace Drizzle, no la base).
- Modelo de datos relacional del tablero: uno-a-muchos en cadena (boards -> columns -> cards) y muchos-a-muchos con tabla puente y rol (`board_members`).
- Orden persistido con posición fraccionaria (una fila por movimiento) y `ORDER BY` obligatorio.
- React vs DOM manual: pantalla = función(estado); `render()` único en vez de actualizar la pantalla por partes.
- Inmutabilidad: spread de arrays y objetos, `filter` (borrar), `map` (editar), `forEach`.
- Destructuring de objetos y arrays, renombrar, valores por defecto, en parámetros de función (forma típica de un componente de React); `useState` devuelve un array que se desarma. Juan lo dio por entendido sin ejercicios: se verifica en uso real (Bloque 5).
- Referencias: `===` compara identidad, no contenido; spread es copia superficial (los objetos de adentro se comparten); por eso se edita con `{ ...card, campo }`.

## Dudas que costaron y cómo se destrabaron
- Error del editor `Cannot find name 'process'` solo en `drizzle.config.ts` mientras `tsc` pasaba limpio: era el servidor de TypeScript del editor con estado viejo; se resolvió reiniciándolo. Lección: si `tsc` pasa, el error es del editor.
- `===` en arrays/objetos y copia superficial del spread: se destrabó con el dibujo de "casillero y llaves" y viendo `copia[0].id = 99` cambiar `cards[0].id`.
- Roles de Postgres: se destrabó con la analogía de edificio / tarjeta de acceso y una tabla de qué hace cada parte del `CREATE ROLE`.

## Decisiones tomadas
- 2026-10-05: stack React+TS (Vite) / Express+TS / PostgreSQL+Drizzle / JWT / Vitest+supertest.
- 2026-10-05: la API es JSON puro, apta para web y futura app móvil.
- 2026-10-05: merges a `main` con squash; ramas `feature/*` no se borran; tag de hito al mergear.
- 2026-10-05: modelo de permisos = opción A: solo tableros con miembros y rol por tablero (`board_members`). Sin workspaces en v1; si se agregan después, serán una migración (tabla `workspaces` + `workspace_id` en `boards`).
- 2026-10-05: claves primarias = entero autoincremental (`integer generated always as identity`), no UUID. Cambiar a UUID más adelante sería una migración.
- 2026-10-05: `users` (id, name, email UNIQUE, password_hash, created_at) y `boards` (id, name, description?, created_at, updated_at). El rol no vive en `users` sino en `board_members`; el dueño de un tablero es un miembro con rol `owner` (regla futura: un tablero nunca queda sin owner).
- 2026-10-05: emails duplicados por mayúsculas = opción A (normalizar a minúsculas en la app con Zod antes de guardar y buscar). A futuro sumar la B: índice único sobre `lower(email)` como red de seguridad en la base.
- 2026-10-05: `board_members` (board_id FK, user_id FK, role, created_at; PK compuesta (board_id, user_id); ON DELETE CASCADE en ambas FK). `role` = enum nativo de Postgres (`pgEnum`: owner | editor | viewer). Agregar un rol después es una migración.
- 2026-10-05: orden = posición fraccionaria (`double precision`) en `columns.position` y `cards.position`; mover = actualizar una sola fila (punto medio entre vecinos). Siempre `ORDER BY position`. Renumeración de rescate cuando el hueco se agote: se ve en el Bloque 4. Evolución posible: índices fraccionarios como texto (LexoRank).
- 2026-10-05: la sección de repaso de JS no se commitea (práctica personal, no es parte del proyecto). Juan borró la carpeta `repaso/` al terminar; `.gitignore` queda sin esa entrada. Los cambios pendientes de `PROGRESO.md` viajan en el primer commit del Bloque 1 (`feature/setup`).
- 2026-10-05: estructura = dos carpetas independientes en un solo repo (`backend/` y `frontend/`), cada una con su `package.json`, `node_modules` y `tsconfig`; nada compartido por ahora. Si duele duplicar tipos/esquemas Zod, pasar a npm workspaces con un paquete `shared`.
- 2026-10-05: interior del backend = por módulos de funcionalidad (`modules/auth`, `boards`, `columns`, `cards`), cada uno con routes, controller, service, schemas (Zod) y test de integración juntos. Lo común (db, middlewares, config) en carpetas aparte.
- 2026-10-05: Drizzle `1.0.0-rc.4` (`drizzle-orm@rc` y `drizzle-kit@rc`, versión exacta fijada) porque la documentación oficial ya enseña la 1.0; `latest` de npm sigue en 0.45.3. Se revisan los cambios al actualizar antes de la 1.0 final.
- 2026-10-05: la API se conecta con un rol propio `kanban_app` (mínimo privilegio), no con el superusuario. `@types/node` fijado en 22 para coincidir con Node 22.
- 2026-10-05: Postgres local estaba caído por un `postmaster.pid` viejo (PID reutilizado por un servicio de macOS); se borró el pid, se reinició con `brew services restart postgresql@16` y las bases de ventas-app quedaron intactas.
- 2026-10-05: conexión a la base = una sola variable `DATABASE_URL` (más `TEST_DATABASE_URL` para la base de tests), no campos DB_* sueltos. Evita el error #16 de ventas-app (URL completa en DB_HOST).
- 2026-10-05: nombres de columnas = `snakeCase.table(...)` con propiedades en camelCase (en la 1.0 ya no existe la opción `casing` del cliente; se verificó en el paquete instalado).
- Pendiente: JWT en header `Authorization: Bearer` vs cookie httpOnly (se decide en Bloque 2).
