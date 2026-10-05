# Progreso: Kanban con equipos

## Dónde estamos y qué sigue
Proyecto recién creado (2026-10-05). Carpeta con `CLAUDE.md` y `PROGRESO.md`; todavía no es un repo git.
**Próximo paso:** Bloque 0.2: repaso de JS cliente (qué problema resuelve React frente al DOM manual, destructuring, filter, repaso de map/spread). Antes, hacer el primer commit (`git init`).

## Plan
- [ ] Bloque 0: Fundamentos (sin código de app)
  - [x] 0.1 Modelo de datos en papel (tablas, relaciones, cómo guardar el orden)
  - [ ] 0.2 Repaso de JS cliente: qué problema resuelve React frente al DOM manual, destructuring, filter, repaso de map/spread
  - [ ] 0.3 Estructura de carpetas frontend/backend
- [ ] Bloque 1 `feature/setup`: backend Express+TS, Postgres, Drizzle (conexión, esquema, primera migración), Vitest+supertest funcionando
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
(ninguno todavía)

## Dudas que costaron y cómo se destrabaron
(ninguna todavía)

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
- Pendiente: JWT en header `Authorization: Bearer` vs cookie httpOnly (se decide en Bloque 2).
