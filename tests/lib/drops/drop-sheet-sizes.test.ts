/**
 * tests/lib/drops/drop-sheet-sizes.test.ts
 * --------------------------------------------------------------------------
 * Every drop sprite has to be a 64x64 sheet.
 *
 * `loadDropAssets` registers every drop texture as a spritesheet with
 * `frameWidth: 64, frameHeight: 64`. A texture of any other size still *loads*, so
 * nothing throws - it just gets sliced into whatever fits, and the drop renders as a
 * sliver of itself. That is exactly what happened to the Token Shield: 88x84 art
 * became one cropped 64x64 frame, which on the ground read as a brown speck. The owner
 * reported it as `没有掉落词元盾` while the light pillar was actually standing there.
 *
 * Node can read a PNG's size from the IHDR chunk, so this test needs no image library.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseDropYaml } from '@/lib/drops/parser';

const ROOT = process.cwd();
const DROPS = join(ROOT, 'public', 'data', 'drops');
const PUBLIC = join(ROOT, 'public');

/** Width and height from the PNG IHDR chunk (bytes 16..24). */
function pngSize(path: string): { width: number; height: number } {
    const buffer = readFileSync(path);
    // PNG signature: 0x89504E47 then 0x0D0A1A0A.
    if (buffer.readUInt32BE(0) !== 0x89504e47 || buffer.readUInt32BE(4) !== 0x0d0a1a0a) {
        throw new Error(`${path} is not a PNG`);
    }
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const specs = readdirSync(DROPS)
    .filter((name) => name.endsWith('.yaml') && name !== 'index.yaml')
    .map((name) => ({
        file: name,
        spec: parseDropYaml(readFileSync(join(DROPS, name), 'utf8'), name.replace('.yaml', '')),
    }))
    .filter((entry) => entry.spec.sprite);

describe('drop sprites are 64x64 sheets', () => {
    it('has drops with sprites to check', () => {
        expect(specs.length).toBeGreaterThan(0);
    });

    it.each(specs.map((entry) => [entry.file, entry.spec.sprite!.texture]))(
        '%s sprite (%s) divides into whole 64px frames',
        (file, texture) => {
            const { width, height } = pngSize(join(PUBLIC, texture));
            expect(width % 64, `${file}: ${width}px wide`).toBe(0);
            expect(height % 64, `${file}: ${height}px tall`).toBe(0);
        },
    );
});