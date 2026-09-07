import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Hi5Central is deployed at the site root. Using an absolute base keeps
// JS/CSS/assets loading from /assets/... when a user opens a deep SPA URL
// directly (for example /incidents/INC-20661).
export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    // Keep the production bundle compatible with mobile Safari/WebKit rather
    // than relying on Vite's moving default baseline. This is intentionally a
    // little more conservative because Hi5Central is an operational tool that
    // must still open reliably on managed phones and tablets.
    target: ['es2020', 'safari15'],
  },
})
