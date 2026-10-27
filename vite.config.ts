import { existsSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Figma Make exports use `figma:asset/<hash>.png`; serve matching files from `src/assets/`. */
function resolveFigmaAssets(): Plugin {
  const assetsDir = path.resolve(__dirname, 'src/assets')
  const placeholder = path.resolve(assetsDir, 'figma-placeholder.png')
  return {
    name: 'resolve-figma-assets',
    enforce: 'pre',
    resolveId(id) {
      if (!id.startsWith('figma:asset/')) return
      const file = path.basename(id.slice('figma:asset/'.length))
      const resolved = path.resolve(assetsDir, file)
      if (existsSync(resolved)) return resolved
      return placeholder
    },
  }
}

export default defineConfig({
  // Expose Vercel Supabase integration public keys (NEXT_PUBLIC_*) to the client.
  // Do NOT add bare "SUPABASE_" — that would leak SERVICE_ROLE_KEY into the browser.
  envPrefix: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_GOOGLE_CLIENT_ID', 'VITE_DEV_SUPERADMIN_PREVIEW', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks(id) {
      if (!id.includes('node_modules')) return;
      if (['react','react-dom','react-router','react-router-dom','scheduler'].some(name=>id.includes('/node_modules/'+name+'/'))) return 'react-vendor';
      if (id.includes('/@supabase/')) return 'supabase-vendor';
      if (id.includes('/recharts/') || id.includes('/node_modules/d3-')) return 'charts-vendor';
      if (['jspdf','svg2pdf.js','canvg','html2canvas'].some(name=>id.includes('/node_modules/'+name+'/'))) return 'pdf-vendor';
    } } },
  },
  // Avoid browsers serving a stale localhost HTML/JS shell from another project on the same port.
  server: {
    headers: {
      'Cache-Control': 'no-store',
    },
  },
  plugins: [
    resolveFigmaAssets(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
