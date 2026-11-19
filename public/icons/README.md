# Icons

One avatar, five sizes, two roles. Nothing here is generated at build time — these files
are committed, so the tab, the taskbar, the tray and the installer all show the same art.

| File | Size | Used by |
| --- | --- | --- |
| `favicon.ico` | multi-size ICO | browser tab, Electron window/taskbar/tray (`electron/main.cjs`) |
| `favicon-16x16.png` | 16x16 | browser tab, small |
| `favicon-32x32.png` | 32x32 | browser tab, standard |
| `favicon-64x64.png` | 64x64 | browser tab, high-DPI |
| `apple-touch-icon.png` | 180x180 | iOS home screen / Safari pin |
| `icon-192.png` | 192x192 | Android home screen, PWA install (Electron tray fallback) |
| `icon-512.png` | 512x512 | store listing, PWA splash |

Everything in this folder is served at `/icons/...`; the links live in `index.html`.

The packaging copy is separate and deliberately so: `build/icons/icon.ico` is stamped into
the .exe's PE resource by `scripts/pack-win.mjs` and handed to makensis by
`scripts/pack-installer.mjs`. That one must stay a real ICO container — a renamed PNG
fails the resource writer.

To change the avatar: replace `build/icons/icon.ico` first (it is the source of truth), then
re-derive the PNG sizes from it. `tests/desktop/icon.test.ts` pins both the ICO header
bytes and the presence of every size, so a missing file fails the suite instead of shipping.
