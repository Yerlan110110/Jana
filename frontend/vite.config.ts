import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

export default defineConfig({
  plugins: [react(), tailwindcss(), {
    name: 'janamen-notices',
    generateBundle() {
      const notices = new URL('./components/pace/notices/', import.meta.url);
      for (const fileName of readdirSync(notices)) {
        this.emitFile({ type: 'asset', fileName: `licenses/pace/${fileName}`, source: readFileSync(new URL(fileName, notices), 'utf8') });
      }
      for (const [sourcePath, fileName] of [
        ['./LICENSE', 'licenses/JanaMen-AGPL.txt'],
        ['./NOTICE.md', 'licenses/NOTICE.md'],
        ['./src/components/upstream/shadcn-LICENSE.md', 'licenses/shadcn-LICENSE.md'],
      ]) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(new URL(sourcePath, import.meta.url), 'utf8') });
      }
    },
  }],
  build: { license: { fileName: 'licenses/dependencies.md' } },
  resolve: { alias: {
    '@/components/pace': fileURLToPath(new URL('./components/pace', import.meta.url)),
    '@': fileURLToPath(new URL('./src', import.meta.url)),
  } },
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': { target: process.env.JANAMEN_API ?? 'http://127.0.0.1:8000', changeOrigin: true } },
  },
  preview: { port: 4173, strictPort: true },
});
