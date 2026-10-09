import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { sql } from 'drizzle-orm';
import { db } from './db/client.js';
import authRoutes from './modules/auth/auth.routes.js';

const app = express();

app.use(express.json());

// Responde 200 solo si la API puede hablar con la base.
app.get('/health', async (_req: Request, res: Response) => {
  await db.execute(sql`select 1`);
  res.json({ status: 'ok' });
});

// Rutas auth
app.use('/auth', authRoutes);

// Ninguna ruta anterior respondió: 404 en JSON (nada de vistas ni redirects).
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'No encontrado' });
});

// Manejador de errores: Express lo reconoce por tener 4 parámetros.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status =
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof err.status === 'number' &&
    err.status >= 400 &&
    err.status < 500
      ? err.status
      : 500;

  if (status === 500) {
    console.error(err);
  }

  res.status(status).json({
    error: status === 500 ? 'Error interno del servidor' : 'Solicitud inválida',
  });
});

export default app;
