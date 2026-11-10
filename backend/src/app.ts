import express from 'express';
import cors from 'cors';
import type { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from './db/client.js';
import { corsOrigin } from './config.js';
import { z } from 'zod';
import helmet from 'helmet';
import authRoutes from './modules/auth/auth.routes.js';
import boardsRoutes from './modules/boards/boards.routes.js';
import columnsRoutes from './modules/columns/columns.routes.js';
import cardsRoutes from './modules/cards/cards.routes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

// Mensajes de validación de Zod en español para toda la API. Es el respaldo:
// los mensajes escritos a mano en cada schema tienen prioridad sobre estos.
z.config(z.locales.es());

const app = express();

app.use(helmet());
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Responde 200 solo si la API puede hablar con la base.
app.get('/health', async (_req: Request, res: Response) => {
    await db.execute(sql`select 1`);
    res.json({ status: 'ok' });
});

// Rutas auth
app.use('/auth', authRoutes);

// Rutas boards
app.use('/boards', boardsRoutes);

// Rutas columns
app.use(columnsRoutes);

// Rutas cards
app.use(cardsRoutes);

// Manejador de rutas no encontradas y errores: primero el 404, después el manejador de errores.
app.use(notFound);
app.use(errorHandler);

export default app;
