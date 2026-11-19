/**
 * tests/lib/story/cut-scenes.test.ts
 * --------------------------------------------------------------------------
 * The two clips, end to end, at the data layer.
 *
 * A video path that does not exist on disk is the quietest failure in the game: the ending
 * simply plays a black rectangle. So both paths are checked here - the throne trigger's
 * `video:` field, and the ending's hard-coded clip - against the files under `public/`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const THRONE_CLIP = 'assets/video/night-of-dragons.mp4';
const ENDING_CLIP = 'assets/video/holding-hands.mp4';

describe('the clips exist where the game looks for them', () => {
    it('has 一夜鱼龙舞 on disk', () => {
        expect(existsSync(join(ROOT, 'public', THRONE_CLIP))).toBe(true);
    });

    it('has 牵手 on disk', () => {
        expect(existsSync(join(ROOT, 'public', ENDING_CLIP))).toBe(true);
    });
});

describe('the throne trigger carries the clip', () => {
    const yaml = read('public', 'data', 'levels', 'gpt-sky-city-4-throne-hall.yaml');

    it('hangs 一夜鱼龙舞 on the White Dragon Fangs trigger', () => {
        expect(yaml).toContain('dragon-throne-fangs');
        expect(yaml).toContain(THRONE_CLIP);
    });

    it('keeps the clip on the same trigger as the fang, not a neighbouring one', () => {
        // The two lines must be inside the same list item: `video:` appears after the trigger
        // id and before its `spawn:` block.
        const idAt = yaml.indexOf('dragon-throne-fangs');
        const videoAt = yaml.indexOf(THRONE_CLIP);
        const spawnAt = yaml.indexOf('spawn:', idAt);
        expect(videoAt).toBeGreaterThan(idAt);
        expect(videoAt).toBeLessThan(spawnAt);
    });
});

describe('the ending plays 牵手 between the walk-out plate and the support dialog', () => {
    const overlay = read('src', 'components', 'hud', 'settlement-overlay.tsx');

    it('asks for the clip at the walk-out boundary', () => {
        expect(overlay).toContain(ENDING_CLIP);
        expect(overlay).toContain('settlementPlateEnd(1');
    });

    it('waits for the clip before the ledger keeps running', () => {
        expect(overlay).toContain('frozen.current = true');
        expect(overlay).toContain('STORY_VIDEO_DONE_EVENT');
    });
});

describe('the trigger controller plays whatever the trigger declares', () => {
    const source = read('src', 'game', 'scenes', 'trigger.ts');

    it('reads the video off the trigger data', () => {
        expect(source).toContain('(trigger as { video?: string }).video');
        expect(source).toContain('PLAY_STORY_VIDEO_EVENT');
    });
});