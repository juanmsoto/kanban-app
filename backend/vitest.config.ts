import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    // Todos los tests comparten una sola base y se vacía entre test y test:
    // si dos archivos corrieran a la vez, uno borraría los datos del otro.
    fileParallelism: false,
  },
});
