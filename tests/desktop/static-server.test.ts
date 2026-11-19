// @vitest-environment node
/**
 * tests/desktop/static-server.test.ts
 * --------------------------------------------------------------------------
 * The desktop build's file server.
 *
 * The packaged app cannot use `file://` - the game fetches `/data/levels/tavern.yaml` and
 * `/assets/...` with absolute paths, which under `file://` point at the filesystem root and
 * boot to a blank screen. So the shell serves `dist/` over loopback HTTP, and this test
 * proves that server answers the paths the game actually asks for.
 */

import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const require_ = createRequire(import.meta.url);
const { createStaticServer, MIME } = require_('../../electron/static-server.cjs') as {
    createStaticServer: (distDir: string) => import('node:http').Server;
    MIME: Record<string, string>;
};

let server: import('node:http').Server;
let base = '';
let distDir = '';

beforeAll(async () => {
    distDir = mkdtempSync(join(tmpdir(), 'desktop-dist-'));
    mkdirSync(join(distDir, 'data', 'levels'), { recursive: true });
    mkdirSync(join(distDir, 'assets', 'image'), { recursive: true });
    writeFileSync(join(distDir, 'index.html'), '<!doctype html><title>game</title>');
    writeFileSync(join(distDir, 'data', 'levels', 'tavern.yaml'), 'title: Tavern\n');
    writeFileSync(join(distDir, 'assets', 'image', 'logo.png'), 'png');

    server = createStaticServer(distDir);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('serving the build', () => {
    it('answers the root with index.html', async () => {
        const response = await fetch(`${base}/`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');
        expect(await response.text()).toContain('game');
    });

    it('serves the level YAML the game fetches', async () => {
        const response = await fetch(`${base}/data/levels/tavern.yaml`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('yaml');
        expect(await response.text()).toContain('Tavern');
    });

    it('serves images with an image content type', async () => {
        const response = await fetch(`${base}/assets/image/logo.png`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toBe('image/png');
    });

    it('falls back to index.html for an unknown route, so the SPA can route', async () => {
        const response = await fetch(`${base}/some/deep/route`);
        expect(response.status).toBe(200);
        expect(await response.text()).toContain('game');
    });

    it('refuses to walk out of the build directory', async () => {
        const response = await fetch(`${base}/../../package.json`);
        // Either a 403 or the SPA fallback - never the file itself.
        const body = await response.text();
        expect(body).not.toContain('"name": "ds-whale-shooter-pc"');
    });
});

describe('the mime table', () => {
    it('knows the types this game actually loads', () => {
        for (const ext of ['.html', '.js', '.css', '.yaml', '.png', '.jpg', '.webp', '.mp3']) {
            expect(MIME[ext]).toBeTruthy();
        }
    });
});