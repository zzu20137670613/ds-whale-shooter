/**
 * tests/data-integrity.test.ts
 * --------------------------------------------------------------------------
 * Cross-module guard over the shipped YAML under `public/data`.
 *
 * The game is 100% YAML-driven, so a typo in a data file is not a build
 * error — it is a scene that throws (or an entity that silently never
 * appears) at runtime. This test turns that whole class of mistake into a
 * red `pnpm test`:
 *
 *   1. every spec file parses against its module's real Zod schema;
 *   2. every id listed in a module `index.yaml` has a backing spec file,
 *      and no spec file is left unregistered;
 *   3. every audio manifest id has a spec file, and every `sfx` id a weapon
 *      references resolves to one.
 *
 * It reads the real data directory rather than fixtures on purpose —
 * fixtures cannot catch the shipped data drifting out of sync.
 *
 * Deliberately not mirroring a single `src/` module: it spans all of them.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseAudioIndex, parseAudioYaml } from '@/lib/audios/parser';
import { parseCharacterIndex, parseCharacterYaml } from '@/lib/characters/parser';
import { parseDropIndex, parseDropYaml } from '@/lib/drops/parser';
import { parseLevelIndex, parseLevelYaml } from '@/lib/levels/parser';
import { parseMonsterIndex, parseMonsterYaml } from '@/lib/monsters/parser';
import { parseWeaponIndex, parseWeaponYaml } from '@/lib/weapons/parser';

const DATA = join(process.cwd(), 'public', 'data');

const read = (path: string): string => readFileSync(path, 'utf8');

/** Spec ids (filename without `.yaml`) in a module directory, sorted. */
const specIds = (dir: string): string[] =>
    readdirSync(dir)
        .filter((f) => f.endsWith('.yaml') && f !== 'index.yaml')
        .map((f) => f.replace(/\.yaml$/, ''))
        .sort();

const sorted = (ids: ReadonlyArray<string>): string[] => [...ids].sort();

describe('public/data integrity', () => {
    it('characters: schema-valid and index-backed', () => {
        const dir = join(DATA, 'characters');
        const index = parseCharacterIndex(read(join(dir, 'index.yaml')));

        expect(specIds(dir)).toEqual(sorted(index.characters));
        for (const id of index.characters) {
            expect(() => parseCharacterYaml(read(join(dir, `${id}.yaml`)), id)).not.toThrow();
        }
    });

    it('weapons: schema-valid and index-backed', () => {
        const dir = join(DATA, 'weapons');
        const index = parseWeaponIndex(read(join(dir, 'index.yaml')));

        expect(specIds(dir)).toEqual(sorted(index.weapons));
        for (const id of index.weapons) {
            expect(() => parseWeaponYaml(read(join(dir, `${id}.yaml`)), id)).not.toThrow();
        }
    });

    it('monsters: schema-valid and index-backed', () => {
        const dir = join(DATA, 'monsters');
        const index = parseMonsterIndex(read(join(dir, 'index.yaml')));

        expect(specIds(dir)).toEqual(sorted(index.monsters));
        for (const id of index.monsters) {
            expect(() => parseMonsterYaml(read(join(dir, `${id}.yaml`)), id)).not.toThrow();
        }
    });

    it('drops: schema-valid and index-backed', () => {
        const dir = join(DATA, 'drops');
        const index = parseDropIndex(read(join(dir, 'index.yaml')));

        expect(specIds(dir)).toEqual(sorted(index.drops));
        for (const id of index.drops) {
            expect(() => parseDropYaml(read(join(dir, `${id}.yaml`)), id)).not.toThrow();
        }
    });

    it('levels: schema-valid and index-backed', () => {
        const dir = join(DATA, 'levels');
        const index = parseLevelIndex(read(join(dir, 'index.yaml')));

        expect(specIds(dir)).toEqual(sorted(index.levels));
        for (const id of index.levels) {
            expect(() => parseLevelYaml(read(join(dir, `${id}.yaml`)), id)).not.toThrow();
        }
    });

    it('audios: every manifest id has a schema-valid spec file', () => {
        const dir = join(DATA, 'audios');
        const index = parseAudioIndex(read(join(dir, 'index.yaml')));

        for (const kind of ['sfx', 'music'] as const) {
            const listed = sorted(index[kind]);
            expect(specIds(join(dir, kind))).toEqual(listed);
            for (const id of listed) {
                expect(() => parseAudioYaml(read(join(dir, kind, `${id}.yaml`)))).not.toThrow();
            }
        }
    });

    it('every user-facing entity carries a Chinese variant', () => {
        // "Full Chinese translation" is a property of the DATA, so assert it
        // against the data: an entity added without a `*Zh` field silently
        // shows English in the Chinese build, which is the regression this
        // guards against.
        const chars = parseCharacterIndex(read(join(DATA, 'characters', 'index.yaml')));
        for (const id of chars.characters) {
            const spec = parseCharacterYaml(read(join(DATA, 'characters', `${id}.yaml`)), id);
            expect(spec.nameZh, `characters/${id}: nameZh`).toBeTruthy();
            expect(spec.descriptionZh, `characters/${id}: descriptionZh`).toBeTruthy();
        }

        const weapons = parseWeaponIndex(read(join(DATA, 'weapons', 'index.yaml')));
        for (const id of weapons.weapons) {
            const spec = parseWeaponYaml(read(join(DATA, 'weapons', `${id}.yaml`)), id);
            expect(spec.nameZh, `weapons/${id}: nameZh`).toBeTruthy();
        }

        const monsters = parseMonsterIndex(read(join(DATA, 'monsters', 'index.yaml')));
        for (const id of monsters.monsters) {
            const spec = parseMonsterYaml(read(join(DATA, 'monsters', `${id}.yaml`)), id);
            expect(spec.nameZh, `monsters/${id}: nameZh`).toBeTruthy();
        }

        const levels = parseLevelIndex(read(join(DATA, 'levels', 'index.yaml')));
        for (const id of levels.levels) {
            const spec = parseLevelYaml(read(join(DATA, 'levels', `${id}.yaml`)), id);
            expect(spec.titleZh, `levels/${id}: titleZh`).toBeTruthy();
        }
    });

    it('weapons: every referenced sfx id resolves to an audio spec', () => {
        const dir = join(DATA, 'weapons');
        const known = new Set(specIds(join(DATA, 'audios', 'sfx')));
        const index = parseWeaponIndex(read(join(dir, 'index.yaml')));

        for (const id of index.weapons) {
            const spec = parseWeaponYaml(read(join(dir, `${id}.yaml`)), id);
            const refs = Object.values(spec.sfx ?? {}).filter(
                (v): v is string => typeof v === 'string',
            );
            for (const ref of refs) {
                expect(known.has(ref), `${id}.yaml references unknown sfx "${ref}"`).toBe(true);
            }
        }
    });

    it('every cross-module id resolves', () => {
        // Schema validation looks at one file at a time. These are the
        // references BETWEEN modules, where a stale id is silent: retiring the
        // four upstream characters left the tavern's npcSpawns naming them, the
        // schema was satisfied, and the seats simply had nobody in them.
        const chars = parseCharacterIndex(read(join(DATA, 'characters', 'index.yaml')));
        const weapons = parseWeaponIndex(read(join(DATA, 'weapons', 'index.yaml')));
        const characterIds = new Set(chars.characters);
        const weaponIds = new Set(weapons.weapons);

        const badNpc: string[] = [];
        const badWeapon: string[] = [];

        for (const id of parseLevelIndex(read(join(DATA, 'levels', 'index.yaml'))).levels) {
            const level = parseLevelYaml(read(join(DATA, 'levels', `${id}.yaml`)), id);
            for (const npc of level.npcSpawns ?? []) {
                if (!characterIds.has(npc.characterId)) {
                    badNpc.push(`levels/${id}: npcSpawn ${npc.characterId}`);
                }
            }
            for (const drop of level.dropSpawns ?? []) {
                if (drop.weaponId && !weaponIds.has(drop.weaponId)) {
                    badWeapon.push(`levels/${id}: dropSpawn ${drop.weaponId}`);
                }
            }
        }
        for (const id of chars.characters) {
            const spec = parseCharacterYaml(read(join(DATA, 'characters', `${id}.yaml`)), id);
            for (const weapon of spec.hotbar ?? []) {
                if (!weaponIds.has(weapon)) {
                    badWeapon.push(`characters/${id}: hotbar ${weapon}`);
                }
            }
        }
        for (const id of parseMonsterIndex(read(join(DATA, 'monsters', 'index.yaml'))).monsters) {
            const spec = parseMonsterYaml(read(join(DATA, 'monsters', `${id}.yaml`)), id);
            if (spec.weaponId && !weaponIds.has(spec.weaponId)) {
                badWeapon.push(`monsters/${id}: weaponId ${spec.weaponId}`);
            }
        }

        expect(badNpc, `npcSpawn characterIds with no character YAML:\n${badNpc.join('\n')}`).toEqual([]);
        expect(
            badWeapon,
            `weapon ids with no weapon YAML:\n${badWeapon.join('\n')}`,
        ).toEqual([]);
    });
});
