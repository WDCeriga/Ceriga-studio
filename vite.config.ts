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
  build: {
    chunkSizeWarningLimit: 900,
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
