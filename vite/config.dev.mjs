import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { editorApiPlugin } from './plugins/editor-api.mjs';
import { phaserFullReloadPlugin } from './plugins/phaser-full-reload.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [react(), tailwindcss(), editorApiPlugin(), phaserFullReloadPlugin()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '../src'),
        },
    },
    server: {
        port: 8080,
        watch: {
            // Prettier (via the pre-commit hook) and vitest write atomic temp files next to the
            // file they replace: `.<name>.<pid>.<uuid>.tmpdir/<name>.tmp`. Vite's watcher tried to
            // watch those, hit `EBUSY: resource busy or locked` on Windows, and the watcher's
            // unhandled `error` event took the whole dev server down with it. Nothing under a
            // `.tmpdir` is ever worth reloading, so ignore them outright — with and without the
            // trailing `/**`, so the directory itself is skipped as well as its contents.
            ignored: ['**/.*.tmpdir', '**/.*.tmpdir/**'],
        },
    },
});
