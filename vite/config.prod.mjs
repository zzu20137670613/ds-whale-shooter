import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { legacyCssPlugin } from './plugins/legacy-css.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const phasermsg = () => {
    return {
        name: 'phasermsg',
        buildStart() {
            process.stdout.write(`Building for production...\n`);
        },
        buildEnd() {
            const line = '---------------------------------------------------------';
            const msg = `❤️❤️❤️ Tell us about your game! - games@phaser.io ❤️❤️❤️`;
            process.stdout.write(`${line}\n${msg}\n${line}\n`);

            process.stdout.write(`✨ Done ✨\n`);
        },
    };
};

// The store flag is baked in as a plain literal, not read from `import.meta.env` at runtime:
// only a literal lets the bundler fold `STORE_BUILD ? ... : 'https://...'` and drop the URL
// strings (and the letter form) out of a TapTap build entirely.
const STORE_BUILD = process.env.VITE_STORE_BUILD === '1';

export default defineConfig({
    define: {
        __STORE_BUILD__: JSON.stringify(STORE_BUILD),
    },
    base: './',
    // `DSH_LEGACY_CSS=1` is set by the mobile build: it flattens Tailwind's `@layer` wrappers so
    // the stylesheet applies on the Chromium 91 inside 雷电模拟器. Desktop leaves it unset.
    plugins: [react(), tailwindcss(), legacyCssPlugin(), phasermsg()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '../src'),
        },
    },
    logLevel: 'warning',
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    phaser: ['phaser'],
                },
            },
        },
        minify: 'terser',
        terserOptions: {
            compress: {
                passes: 2,
            },
            mangle: true,
            format: {
                comments: false,
            },
        },
    },
});
