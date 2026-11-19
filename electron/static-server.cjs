/**
 * electron/static-server.cjs
 * --------------------------------------------------------------------------
 * The loopback file server the desktop build loads from.
 *
 * Kept apart from `main.cjs` so it can be tested without Electron: a plain Node server
 * that serves a built `dist/` directory, which is all the renderer needs.
 *
 * Why a server instead of `loadFile`: the game fetches its data with absolute paths
 * (`/data/levels/tavern.yaml`, `/assets/...`). Under `file://` those resolve to the
 * filesystem root, so the packaged app boots to a blank screen. An HTTP origin keeps every
 * path the web build already uses valid.
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.yaml': 'text/yaml; charset=utf-8',
    '.yml': 'text/yaml; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.mp4': 'video/mp4',
};

/**
 * @param {string} distDir absolute path to the built site
 * @returns {import('node:http').Server}
 */
function createStaticServer(distDir) {
    const root = path.resolve(distDir);

    return http.createServer((req, res) => {
        let urlPath;
        try {
            urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
        } catch {
            // A malformed escape sequence must not take the server down.
            res.writeHead(400).end('bad request');
            return;
        }
        if (urlPath === '/') urlPath = '/index.html';

        // Never escape the build: `../../secret` clamps back inside `root`.
        const resolved = path.join(root, path.normalize(urlPath));
        if (resolved !== root && !resolved.startsWith(root + path.sep)) {
            res.writeHead(403).end('forbidden');
            return;
        }

        fs.readFile(resolved, (error, data) => {
            if (error) {
                // Unknown route: hand back index.html and let the SPA route.
                fs.readFile(path.join(root, 'index.html'), (fallbackError, html) => {
                    if (fallbackError) {
                        res.writeHead(404).end('not found');
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': MIME['.html'] }).end(html);
                });
                return;
            }
            const type = MIME[path.extname(resolved).toLowerCase()] ?? 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': type }).end(data);
        });
    });
}

module.exports = { createStaticServer, MIME };