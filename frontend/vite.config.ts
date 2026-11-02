import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        // Puerto fijo: el backend solo acepta pedidos de este origen (CORS_ORIGIN).
        // Con strictPort, si está ocupado Vite falla en vez de elegir otro puerto en silencio.
        port: 5173,
        strictPort: true,
    },
})
