# Progreso: Kanban con equipos

## Dónde estamos y qué sigue
**Estado (2026-10-09):** Bloques 0 y 1 completos y mergeados (`main`, tag `hito-setup`). Bloque 2 `feature/auth` en curso, rama activa `feature/auth`: registro (`POST /auth/register`) terminado y con tests; `npm test` en `backend/` pasa 7/7. Último commit: `9b42c test(auth): agregar tests de integración de POST /auth/register`. Sin commitear (se commitean juntos): `PROGRESO.md` (decisión de logs + traspaso) y `CLAUDE.md` (nueva regla permanente de traspaso).

**Próximo paso: 2.3b, corregir el log de errores en `backend/src/app.ts` (lo escribe Juan, es seguridad).** Decisión tomada: opción A. Problema verificado: el manejador de errores hace `console.error(err)` y el mensaje de un `DrizzleQueryError` incluye los parámetros de la consulta (nombre, email, `password_hash`). Qué hacer: en el manejador, si `err instanceof DrizzleQueryError` y tiene `err.cause`, loguear SOLO campos elegidos de la causa original de `pg` (`message`, `code`, `constraint`), nunca la causa entera ni `detail` (trae valores, ej. `Key (email)=(...)`); para cualquier otro error, loguear completo como hoy. Idealmente en una función auxiliar. Después: un test o una prueba manual que confirme que el log no contiene el hash (p. ej. forzar un error de consulta con un hash de prueba y revisar la salida). Luego 2.4 (login).

**Para quien retome (otra sesión de Claude):** leer `CLAUDE.md` primero. Reglas clave: Juan escribe lo importante (lógica, seguridad, Drizzle es nivel 1); verificar siempre leyendo el archivo y corriendo `tsc`/tests/curl; trade-offs como opciones con recomendación; un paso chico por vez y UNA pregunta al cerrar; los comandos que cambian el repo (`add`, `commit`, `checkout`, `merge`, `tag`...) los corre Juan (hubo un permiso puntual el 2026-10-06, ya usado); sugerir el commit con mensaje redactado al cerrar cada paso verificado. Detalles de estilo de Juan: indentación de 4 espacios, mensajes de error sin tildes en el código, y renombra cosas (tipos `RegisterInput`/`LoginInput`, función `esEmailDuplicado`): siempre leer el archivo real antes de asumir nombres. Juan aprende mejor con ejemplos que corren, analogías y pruebas con salida real; le gusta entender el porqué antes de tipear.

## Plan
- [x] Bloque 0: Fundamentos (sin código de app)
  - [x] 0.1 Modelo de datos en papel (tablas, relaciones, cómo guardar el orden)
  - [x] 0.2 Repaso de JS cliente: React vs DOM manual, filter, map/spread, referencias, destructuring
  - [x] 0.3 Estructura de carpetas frontend/backend
- [x] Bloque 1 `feature/setup` (mergeado a `main` con squash `59524`, tag `hito-setup`; el squash se rehízo una vez para incluir `.env.example`): backend Express+TS, Postgres, Drizzle (conexión, esquema, primera migración), Vitest+supertest funcionando
  - [x] 1.1 Postgres local con rol propio `kanban_app` (sin superusuario) y bases `kanban_app` / `kanban_app_test`
  - [x] 1.2 Proyecto `backend/`: package.json, dependencias, tsconfig (typecheck y build)
  - [x] 1.3a `.env` / `.env.example` (ambas URLs verificadas: conectan como `kanban_app` a su base)
  - [x] 1.3b Cliente de Drizzle (`src/db/client.ts`): verificado en dev, con NODE_ENV=test (va a kanban_app_test) y sin variables (falla con mensaje claro)
  - [x] 1.4a Esquema de Drizzle (`src/db/schema.ts`, 5 tablas, `snakeCase.table`, `pgEnum`, PK compuesta): compila y los tipos inferidos coinciden con el diseño
  - [x] 1.4b `drizzle.config.ts`, migración `esquema_inicial` generada, revisada y aplicada a `kanban_app` y `kanban_app_test`; verificado en `psql` (cascade, enum, UNIQUE, PK compuesta, identity ALWAYS)
  - [x] 1.4c DESCARTADO a propósito: `drizzle.config.ts` exige la URL aunque `db:generate` no se conecte. En el tipo de drizzle-kit `dbCredentials` es obligatorio para PostgreSQL y quien clone el repo necesita el `.env` igual (migrate/dev/tests); el error claro es preferible a uno de conexión confuso
  - [x] 1.5a `src/app.ts` y `src/server.ts` (JSON, `GET /health` con chequeo de base, 404 y errores en JSON): verificado con curl (200, 404, 400 con JSON roto, 500 con base caída sin filtrar detalles)
  - [x] 1.5b `vitest.config.ts` + `test/setup.ts` (guard `*_test`, TRUNCATE por test, `pool.end()`) y primer test de integración de `/health` y 404 (`test/app.test.ts`, lo escribió Juan): `npm test` pasa 2/2
- [ ] Bloque 2 `feature/auth`: registro y login, JWT, middleware, tests
  - [x] 2.1 Dependencias (zod, bcrypt, jsonwebtoken) y `JWT_SECRET` en el `.env` (verificado: 64 hex, distinto al de ventas-app)
  - [x] 2.2 Esquemas de Zod de registro y login (`src/modules/auth/auth.schemas.ts`, Juan): email trim+lowercase+pipe(z.email()), password min 8 y máx 72 BYTES (bcrypt trunca en silencio), login solo exige no vacío
  - [x] 2.3a `auth.service.ts` (`registerUser`, `EmailAlreadyRegisteredError`, detección de 23505 vía `DrizzleQueryError.cause`): verificado (no devuelve hash, guarda bcrypt, duplicado lanza el error propio sin crear fila)
  - [x] 2.3c Controller `register`, `auth.routes.ts` y `app.use('/auth', ...)` antes del 404: verificado con curl (201, 409 incluso con otra capitalización, 400 por campo, 400 sin body y con JSON roto, campos extra `id`/`passwordHash` ignorados, GET -> 404)
  - [x] 2.3d Tests de integración de `POST /auth/register` en `test/auth.test.ts` (5 tests: 201 sin hash, email normalizado, 409 con otra capitalización, 400 por campo sin crear usuario, contraseña de más de 72 bytes). `npm test`: 7/7
  - [ ] 2.3b (DECIDIDO: opción A, loguear solo campos seguros de la causa de pg) PENDIENTE DE SEGURIDAD: el manejador de errores de `app.ts` hace `console.error(err)`; el mensaje de `DrizzleQueryError` incluye los parámetros de la consulta (verificado: nombre, email y `password_hash`). Corregir para que el log no vuelque datos sensibles (p. ej. loguear `err.cause` / redactar params) antes de cerrar el Bloque 2
  - [ ] 2.4 `POST /auth/login` que devuelve el token (Juan) + tests
  - [ ] 2.5 Middleware `requireAuth` (header Bearer) y `GET /auth/me` (Juan) + tests: sin token, token inválido, token vencido
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
- Qué es `users` de Drizzle: un objeto `PgTable` que describe la tabla (plano); no abre conexiones ni trae filas; sirve para armar SQL (`.toSQL()` lo muestra antes de ejecutar), traducir nombres camelCase -> snake_case y deducir tipos. La consulta viaja al hacer `await`.
- Estructura de un test: preparar, actuar, comprobar; verificar respuesta Y efecto en la base; `.not`, `toHaveProperty`, `toHaveLength`, `toMatch`.
- `return` tras responder: `res.json`/`res.render` no detienen la función; sin `return` en una salida temprana el código sigue y falla con `ERR_HTTP_HEADERS_SENT`. Orden de `app.use`: el router de `/auth` va antes del 404. Los ids de identity pueden tener huecos (un INSERT fallido consume un valor de la secuencia).
- Zod 4: orden de transformaciones (`trim`/`toLowerCase` antes de `z.email()` con `.pipe`), `.refine`, claves de más descartadas, `z.infer<typeof schema>` (tipo deducido del esquema, una sola fuente de verdad).
- bcrypt: usa solo los primeros 72 BYTES de la contraseña (límite del algoritmo, no bug de la librería); contraseñas distintas con el mismo prefijo de 72 bytes comparan como iguales; se rechaza lo que pase de 72 bytes. Argon2id sería la alternativa moderna sin ese límite.
- Tests de integración: estructura `describe`/`it`/`expect`, supertest, `response.status` / `response.body` (supertest parsea el JSON), `toBe` (referencia/primitivos) vs `toEqual` (contenido). Un error de sintaxis (coma faltante) produce una avalancha de errores: se lee el primero.
- HTTP: request (línea de petición, headers, línea en blanco, body) y response (línea de estado, headers, body); texto sobre TCP.
- Express como API JSON: `express.json()` (parsea el body), `res.json`, 404 y manejador de errores en JSON (4 parámetros), Express 5 reenvía solo los errores de handlers `async` al manejador, errores 4xx (JSON roto = 400) vs 500, y no filtrar detalles internos al cliente (se loguean en el servidor).
- Migraciones con Drizzle: `db:generate` (escribe SQL + snapshot, no toca la base), `db:migrate` (aplica y registra en `drizzle.__drizzle_migrations`), una migración por cambio de esquema; el SQL generado se revisa antes de aplicar. Columnas de PK son NOT NULL implícito.
- Drizzle: `db` vs `pool`, tablas como código (`snakeCase.table`), columnas encadenadas, `.notNull()` -> tipo `T` vs `T | null`, FK con `.references` y `onDelete: 'cascade'`, PK compuesta, `pgEnum`, `$onUpdate` (lo hace Drizzle, no la base).
- Modelo de datos relacional del tablero: uno-a-muchos en cadena (boards -> columns -> cards) y muchos-a-muchos con tabla puente y rol (`board_members`).
- Orden persistido con posición fraccionaria (una fila por movimiento) y `ORDER BY` obligatorio.
- React vs DOM manual: pantalla = función(estado); `render()` único en vez de actualizar la pantalla por partes.
- Inmutabilidad: spread de arrays y objetos, `filter` (borrar), `map` (editar), `forEach`.
- Destructuring de objetos y arrays, renombrar, valores por defecto, en parámetros de función (forma típica de un componente de React); `useState` devuelve un array que se desarma. Juan lo dio por entendido sin ejercicios: se verifica en uso real (Bloque 5).
- Referencias: `===` compara identidad, no contenido; spread es copia superficial (los objetos de adentro se comparten); por eso se edita con `{ ...card, campo }`.

## Dudas que costaron y cómo se destrabaron
- `.env.example` desaparecido: al crear el `.env` se renombró la plantilla (`mv`) en vez de copiarla (`cp`), y nunca se commiteó. Se detectó en el cierre del Bloque 1 mirando la lista de archivos del squash. Lección: revisar que los archivos esperados estén en el commit, no solo que "no sobre nada".
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
- 2026-10-06: Juan dio permiso puntual ("por esta vez") para que Claude ejecutara `checkout`, `reset --hard`, `tag` y `merge --squash` y rehacer el squash de `main`. La regla de CLAUDE.md sigue vigente: Juan corre los comandos que cambian el repo. Los commits hechos por Claude llevan el trailer Co-Authored-By.
- 2026-10-06: JWT viaja en el header `Authorization: Bearer <token>` (no cookie): un solo contrato para web y móvil, sin CSRF, CORS simple. Riesgo asumido: XSS en la web (token legible por JS); mitigación: React escapa por defecto, sin `dangerouslySetInnerHTML`, token de vida corta. Endurecer a híbrido (cookie en web) queda como evolución posible. Dónde guardar el token en el cliente se decide en el Bloque 5.
- 2026-10-08: registro responde 409 con mensaje claro si el email ya existe (opción A). Riesgo conocido: enumeración de usuarios; se mitiga más adelante con rate limiting. El login ya usa el mismo mensaje/status para "no existe" y "contraseña incorrecta". El duplicado se detecta insertando y atrapando el error (atómico), no con SELECT previo.
- 2026-10-08: en Drizzle 1.0 los errores de Postgres llegan envueltos: `DrizzleQueryError` con el `DatabaseError` de `pg` en `.cause` (código `23505`, constraint `users_email_key`); `error.code` directo ya no existe como en ventas-app.
- 2026-10-09: log de errores = opción A: para `DrizzleQueryError` se loguean solo `message`, `code` y `constraint` de la causa original de `pg` (no `detail`, que trae valores). Descartadas: librería de logs con redacción (pino) por ahora, y no loguear errores de base.
