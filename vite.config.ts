import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Bakes GOOGLE_CLIENT_ID into the client bundle as __GOOGLE_CLIENT_ID__ —
  // the same one variable the server verifies tokens against (see
  // server/auth.js), so it only ever needs setting once, in one place
  // (Render's dashboard, or a local .env). loadEnv's third arg ('') means
  // "load every var, not just VITE_-prefixed ones" — process.env is
  // checked too, since Render sets real env vars rather than a .env file.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') }

  return {
    plugins: [react()],
    server: { port: 5173, open: false },
    define: {
      __GOOGLE_CLIENT_ID__: JSON.stringify(env.GOOGLE_CLIENT_ID || ''),
    },
  }
})
