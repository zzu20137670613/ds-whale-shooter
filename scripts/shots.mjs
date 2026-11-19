/**
 * scripts/shots.mjs
 * --------------------------------------------------------------------------
 * Captures the README screenshots from the running dev server, unattended.
 *
 * The four images `screenshots/*.png` referenced by README.md / README-CN.md never existed,
 * so every Gitee page showed a broken placeholder. This drives a real browser over the
 * DevTools protocol instead of asking the owner to take them by hand:
 *
 *   pnpm shots            # writes screenshots/{loading,tavern,combat,editor}-v1.png
 *
 * It talks to the dev server the owner already runs on :8080 (never starts another) and uses
 * the locally installed Edge/Chrome headless build.
 *
 * Three things this has to get right, each learned by producing a wrong image first:
 *   - The splash stays up for ~15s per scene (the background preloader warms every map), so
 *     every shot waits for it to LEAVE THE DOM instead of sleeping a fixed time.
 *   - `?scene=` does NOT decide the first scene: the game boots the tavern unless the saved
 *     run says otherwise. A scene shot therefore rewrites the saved run BEFORE the app
 *     scripts run (`evaluateOnNewDocument`).
 *   - Those rewrite handlers stack across navigations, and the tavern handler wins the next
 *     time. Each shot gets its own page, so one shot's patch can never leak into another.
 */

import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import puppeteer from 'puppeteer-core';

const ROOT = process.cwd();
const OUT = join(ROOT, 'screenshots');
const BASE = process.env.SHOTS_BASE ?? 'http://localhost:8080';

/** Viewport the game is designed for; 16:9 keeps the README rows even. */
const VIEWPORT = { width: 1600, height: 900 };

const BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findBrowser() {
    const found = BROWSERS.find((path) => existsSync(path));
    if (!found) throw new Error('找不到 Edge / Chrome，请先安装其中一个');
    return found;
}

/**
 * Rewrite the saved run before the app boots.
 *
 * `levelId: null` means "stay in the tavern". Snapshots are dropped because a stale one puts
 * the player wherever the last run ended.
 */
function patchSave(levelId, characterId) {
    try {
        const raw = window.localStorage.getItem('ds_whale_shooter_save_v2');
        const parsed = raw ? JSON.parse(raw) : { state: {} };
        const state = parsed.state ?? {};
        parsed.state = {
            ...state,
            tavernCleared: Boolean(levelId),
            currentLevelId: levelId ?? 'tavern',
            selectedCharacterId: characterId,
            playerSnapshot: undefined,
            activeMonstersSnapshot: undefined,
        };
        window.localStorage.setItem('ds_whale_shooter_save_v2', JSON.stringify(parsed));
    } catch {
        // First ever load: nothing to patch, the game boots the tavern by itself.
    }
}

/** The splash overlay is a div whose class mentions boot/splash; gone = the game is up. */
function splashVisible() {
    return [...document.querySelectorAll('div')].some((node) =>
        /boot|splash/i.test(String(node.className ?? '')),
    );
}

async function waitForSplashGone(page, timeoutMs = 60000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (!(await page.evaluate(splashVisible))) return true;
        await sleep(250);
    }
    return false;
}

async function shot(page, name) {
    const file = join(OUT, `${name}.png`);
    await page.screenshot({ path: file, type: 'png' });
    process.stdout.write(`• ${name}.png (${Math.round(statSync(file).size / 1024)} KB)\n`);
}

async function main() {
    mkdirSync(OUT, { recursive: true });

    const browser = await puppeteer.launch({
        executablePath: findBrowser(),
        headless: 'new',
        args: [
            `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
            '--hide-scrollbars',
            '--mute-audio', // irrelevant to a still image, and one less thing to flake
        ],
        defaultViewport: VIEWPORT,
    });

    const newPage = async (levelId, characterId) => {
        const page = await browser.newPage();
        page.on('pageerror', (error) => process.stdout.write(`  [pageerror] ${error.message}\n`));
        await page.evaluateOnNewDocument(patchSave, levelId, characterId);
        await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
        return page;
    };

    // 1. Loading: caught while the splash is still up.
    {
        const page = await newPage(null, 'deepseek');
        await sleep(1500);
        await shot(page, 'loading-v1');
        await page.close();
    }

    // 2. Tavern: the seaside pavilion, five seats, one girl highlighted.
    {
        const page = await newPage(null, 'deepseek');
        await waitForSplashGone(page);
        await sleep(2500);
        await shot(page, 'tavern-v1');
        await page.close();
    }

    // 3. Combat: the starry library, mid-slash, monsters closing in, bars honest.
    {
        const page = await newPage('starry-library-1-entrance', 'gemini');
        await waitForSplashGone(page);
        // Monsters spawn ~1.5s in; give them a moment to reach the frame, then swing.
        await sleep(1600);
        await page.mouse.move(VIEWPORT.width * 0.4, VIEWPORT.height * 0.35);
        await page.keyboard.down('KeyJ');
        await sleep(1400);
        await shot(page, 'combat-v1');
        await page.keyboard.up('KeyJ');
        await page.close();
    }

    // 4. Editor: the in-browser level editor. Dev-only, which is why this uses :8080.
    {
        const page = await newPage(null, 'deepseek');
        await waitForSplashGone(page);
        await sleep(1500);
        const opened = await page.evaluate(() => {
            const target = [...document.querySelectorAll('button')].find((button) =>
                /\bEditor\b/.test(button.textContent ?? ''),
            );
            if (!target) return false;
            target.click();
            return true;
        });
        await sleep(3000);
        await shot(page, 'editor-v1');
        if (!opened) process.stdout.write('  [warn] 没找到 Editor 按钮，editor-v1 可能是普通界面\n');
        await page.close();
    }

    await browser.close();
    process.stdout.write(`\n完成，写入 ${OUT}\n`);
}

main().catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`);
    process.exit(1);
});