import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// IAM-14: the API is a pure JSON backend (no HTML ever comes from it), so the
// Content-Security-Policy that actually matters — the one guarding against the app
// rendering unescaped user content (announcements, document names, leave reasons) — has to
// live on this app's own document. A <meta> tag works on a static build with no dependency on
// whatever hosts the built files. connect-src is derived from VITE_API_URL rather than
// hardcoded, so it stays correct wherever the API actually lives. fonts.googleapis.com/
// gstatic.com are allowlisted for src/styles/tokens.css's Google Fonts @import.
// Build-only: `vite dev`'s React Fast Refresh preamble is an inline <script>, which a strict
// script-src blocks outright (confirmed by hand — it silently breaks the entire app, not just
// a cosmetic warning) and frame-ancestors is a no-op via <meta> in any case (needs a real HTTP
// header — left for whatever hosts the build later), so this only ever fires on `vite build`.
function cspPlugin(apiOrigin: string): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data:",
    "font-src 'self' https://fonts.gstatic.com",
    `connect-src 'self' ${apiOrigin}`,
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  return {
    name: 'inject-csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}">`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL ?? 'https://localhost:5443/api'
  const apiOrigin = new URL(apiUrl).origin

  return {
    plugins: [react(), cspPlugin(apiOrigin)],
  }
})
