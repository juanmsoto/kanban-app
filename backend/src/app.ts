import express from 'express';
import type { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from './db/client.js';
import authRoutes from './modules/auth/auth.routes.js';
import boardsRoutes from './modules/boards/boards.routes.js';
import { notFound, errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(express.json());

// Responde 200 solo si la API puede hablar con la base.
app.get('/health', async (_req: Request, res: Response) => {
  await db.execute(sql`select 1`);
  res.json({ status: 'ok' });
});

// Rutas auth
app.use('/auth', authRoutes);

// Rutas boards
app.use('/boards', boardsRoutes)

// Manejador de rutas no encontradas y errores: primero el 404, después el manejador de errores.
app.use(notFound);
app.use(errorHandler);

export default app;
