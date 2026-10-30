import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'

// Emits /sw.js at build time with every bundle and public file precached,
// so the installed app works fully offline.
function serviceWorker() {
  return {
    name: 'quickqr-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const publicFiles = readdirSync('public', { recursive: true })
        .filter(f => !f.split('/').some(part => part.startsWith('.')) && statSync(`public/${f}`).isFile())
      const bundleFiles = Object.keys(bundle).filter(f => f !== 'index.html')
      const files = ['/', ...publicFiles, ...bundleFiles].map(f => (f.startsWith('/') ? f : `/${f}`))

      const hash = createHash('sha256')
      hash.update(bundle['index.html']?.source ?? '')
      for (const file of bundleFiles) {
        const chunk = bundle[file]
        hash.update(chunk.type === 'chunk' ? chunk.code : chunk.source)
      }
      for (const file of publicFiles) hash.update(readFileSync(`public/${file}`))

      const template = readFileSync('src/sw.js', 'utf8')
      hash.update(template)

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__VERSION__', hash.digest('hex').slice(0, 12))
          .replace('[/* __PRECACHE__ */]', JSON.stringify(files)),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorker()],
})
