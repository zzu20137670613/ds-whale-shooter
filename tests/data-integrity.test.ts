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
 *      references resolves to one;
 *   4. the roster's kit rules — one melee + one ranged per character, melee
 *      weapons carry no ammo, a starting hotbar fits the character's slots.
 *
 * It reads the real data directory rather than fixtures on purpose —
 * fixtures cannot catch the shipped data drifting out of sync.
 *
 * Deliberately not mirroring a single `src/` module: it spans all of them.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseAudioIndex, parseAudioYaml } from '@/lib/audios/parser';
import { parseCharacterIndex, parseCharacterYaml } from '@/lib/characters/parser';
import { TAVERN_ACTOR_SCALE } from '@/lib/constants';
import { parseDropIndex, parseDropYaml } from '@/lib/drops/parser';
import { parseLevelIndex, parseLevelYaml } from '@/lib/levels/parser';
import { parseMonsterIndex, parseMonsterYaml } from '@/lib/monsters/parser';
import { isMeleeWeapon } from '@/lib/weapons/logic';
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

        expect(
            badNpc,
            `npcSpawn characterIds with no character YAML:\n${badNpc.join('\n')}`,
        ).toEqual([]);
        expect(badWeapon, `weapon ids with no weapon YAML:\n${badWeapon.join('\n')}`).toEqual([]);
    });

    it('teleporter pairs name each other', () => {
        // A 1-to-1 pair is only a pair if both sides agree. A one-sided link
        // reads as working while quietly sending the player to the target
        // level's spawn point instead of the partner portal, and nothing else
        // in the suite looks at teleporters at all.
        const levels = new Map(
            parseLevelIndex(read(join(DATA, 'levels', 'index.yaml'))).levels.map((id) => [
                id,
                parseLevelYaml(read(join(DATA, 'levels', `${id}.yaml`)), id),
            ]),
        );
        const bad: string[] = [];

        for (const [id, level] of levels) {
            for (const tp of level.teleporters ?? []) {
                if (!tp.targetPortalId) continue;
                const partner = tp.targetScene
                    ? levels
                          .get(tp.targetScene)
                          ?.teleporters?.find((t) => t.id === tp.targetPortalId)
                    : undefined;
                if (!partner) {
                    bad.push(
                        `levels/${id}: ${tp.id} -> ${tp.targetScene ?? '(next in index)'}.${tp.targetPortalId} names no portal`,
                    );
                    continue;
                }
                if (partner.targetPortalId !== tp.id) {
                    bad.push(
                        `levels/${id}: ${tp.id} -> ${tp.targetPortalId}, but ${partner.id} points at ${partner.targetPortalId ?? '(nothing)'}`,
                    );
                }
                if (partner.targetScene !== id) {
                    bad.push(
                        `levels/${id}: ${tp.id} <-> ${partner.id} disagree on scenes (${partner.targetScene} vs ${id})`,
                    );
                }
            }
        }

        expect(bad, `one-sided teleporter pairs:\n${bad.join('\n')}`).toEqual([]);
    });

    it('levels: no spawn or prop sits inside an air wall', () => {
        // An entity authored inside a wall is silent: the schema is happy, the
        // scene loads, and the thing is either unreachable (a drink behind the
        // railing) or stuck (a monster welded into a rock). Walls are traced
        // against the art by hand, so this is the check that keeps the two in
        // sync — it is why the tavern's five seats can be declared safe.
        const inside = (
            px: number,
            py: number,
            poly: ReadonlyArray<readonly [number, number]>,
        ): boolean => {
            let hit = false;
            for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                const [xi, yi] = poly[i];
                const [xj, yj] = poly[j];
                if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
                    hit = !hit;
                }
            }
            return hit;
        };

        const bad: string[] = [];
        for (const id of parseLevelIndex(read(join(DATA, 'levels', 'index.yaml'))).levels) {
            const level = parseLevelYaml(read(join(DATA, 'levels', `${id}.yaml`)), id);

            const entities: Array<{ label: string; x: number; y: number }> = [];
            if (level.characterSpawn) {
                entities.push({ label: 'characterSpawn', ...level.characterSpawn });
            }
            for (const [key, list] of [
                ['monsters', level.monsters ?? []],
                ['dropSpawns', level.dropSpawns ?? []],
                ['npcSpawns', level.npcSpawns ?? []],
                ['teleporters', level.teleporters ?? []],
                ['materials', level.materials ?? []],
            ] as const) {
                list.forEach((entry, i) => {
                    entities.push({ label: `${key}[${i}]`, x: entry.x, y: entry.y });
                });
            }

            for (const entity of entities) {
                for (const wall of level.airWalls) {
                    if (inside(entity.x, entity.y, wall.points)) {
                        bad.push(
                            `${id}: ${entity.label} at (${entity.x},${entity.y}) is inside ${wall.id}`,
                        );
                    }
                }
            }
        }

        expect(bad, `entities authored inside a wall:\n${bad.join('\n')}`).toEqual([]);
    });

    it('tavern: the five seats do not overlap at the tavern actor scale', () => {
        // The tavern draws its actors at TAVERN_ACTOR_SCALE (the pavilion art
        // implies a human several times taller than the sheets), so a seat row
        // spaced for 1:1 silently produces five characters standing inside each
        // other. Arithmetic, not taste: adjacent seats must be at least half of
        // each actor's drawn width apart.
        const SHEET_CELL = 128; // 512px sheet / 4 columns, every roster sheet
        const tavern = parseLevelYaml(read(join(DATA, 'levels', 'tavern.yaml')), 'tavern');
        const seats = tavern.npcSpawns ?? [];
        expect(seats.length).toBeGreaterThan(1);

        const widthOf = (characterId: string): number => {
            const spec = parseCharacterYaml(
                read(join(DATA, 'characters', `${characterId}.yaml`)),
                characterId,
            );
            return SHEET_CELL * (spec.sprite?.scale ?? 1) * TAVERN_ACTOR_SCALE;
        };

        const clashes: string[] = [];
        for (let i = 1; i < seats.length; i++) {
            const prev = seats[i - 1];
            const cur = seats[i];
            const minGap = (widthOf(prev.characterId) + widthOf(cur.characterId)) / 2;
            const gap = Math.abs(cur.x - prev.x);
            if (gap < minGap) {
                clashes.push(
                    `tavern: ${prev.characterId} (x ${prev.x}) and ${cur.characterId} ` +
                        `(x ${cur.x}) are ${Math.round(gap)}px apart, need ${Math.round(minGap)}px`,
                );
            }
        }

        expect(clashes, `overlapping tavern seats:\n${clashes.join('\n')}`).toEqual([]);
    });

    it('characters: start every run with one melee and one ranged weapon', () => {
        // The roster's kit rule: each of the five carries exactly two weapons
        // and they must cover both ranges, so nobody is left with two guns
        // (no close game) or two sticks (cannot answer a sniper). Melee vs
        // ranged is the schema's own split — see `isMeleeWeapon`.
        const chars = parseCharacterIndex(read(join(DATA, 'characters', 'index.yaml')));
        const bad: string[] = [];

        for (const id of chars.characters) {
            const spec = parseCharacterYaml(read(join(DATA, 'characters', `${id}.yaml`)), id);
            const hotbar = spec.hotbar ?? [];
            const weapons = hotbar.map((wid) =>
                parseWeaponYaml(read(join(DATA, 'weapons', `${wid}.yaml`)), wid),
            );
            const melee = weapons.filter(isMeleeWeapon).length;
            const ranged = weapons.length - melee;
            if (melee !== 1 || ranged !== 1) {
                bad.push(
                    `characters/${id}: ${melee} melee + ${ranged} ranged (${hotbar.join(', ')})`,
                );
            } else if (!isMeleeWeapon(weapons[0])) {
                // Slot 1 is the melee by roster decision: a run starts in close
                // quarters, and the ranged weapon is the deliberate second pick.
                bad.push(`characters/${id}: slot 1 is the ranged weapon (${hotbar.join(', ')})`);
            }
        }

        expect(bad, `hotbars that are not one melee + one ranged:\n${bad.join('\n')}`).toEqual([]);
    });

    it('weapons: a melee weapon carries no ammo fields', () => {
        // "Melee has no bullet count" is a gameplay rule and the engine
        // already agrees: a melee slot reports ammo 1 and never reloads. A
        // `clipSize` on a melee spec is therefore dead data — it reads like a
        // feature and survives review, which is exactly why it is checked.
        const dir = join(DATA, 'weapons');
        const index = parseWeaponIndex(read(join(dir, 'index.yaml')));
        const bad: string[] = [];

        for (const id of index.weapons) {
            const spec = parseWeaponYaml(read(join(dir, `${id}.yaml`)), id);
            if (!isMeleeWeapon(spec)) continue;
            for (const field of ['clipSize', 'reloadTimeMs', 'bulletsPerShot'] as const) {
                if (spec[field] !== undefined) {
                    bad.push(`weapons/${id}: ${field}`);
                }
            }
        }

        expect(bad, `melee weapons carrying ammo fields:\n${bad.join('\n')}`).toEqual([]);
    });

    it('characters: a starting hotbar fits the character weapon slots', () => {
        // `weaponMax` is the hotbar cap the HUD draws and the pickup path
        // enforces. A hotbar longer than the cap means slots the character
        // owns but the player cannot see: the runtime drops the overflow.
        const chars = parseCharacterIndex(read(join(DATA, 'characters', 'index.yaml')));
        const bad: string[] = [];

        for (const id of chars.characters) {
            const spec = parseCharacterYaml(read(join(DATA, 'characters', `${id}.yaml`)), id);
            const cap = spec.weaponMax ?? 3; // the runtime's own fallback
            const held = (spec.hotbar ?? []).length;
            if (held > cap) {
                bad.push(`characters/${id}: hotbar ${held} > weaponMax ${cap}`);
            }
        }

        expect(bad, `hotbars longer than their slot cap:\n${bad.join('\n')}`).toEqual([]);
    });

    it('every asset path a spec names resolves under public/', () => {
        // An asset path is a plain string the schema happily accepts, so a typo
        // is silent: no sprite in the hand, no error in the console, nothing in
        // any log. Walk what each module actually parsed and require every
        // path-shaped string to exist on disk.
        const root = join(process.cwd(), 'public');
        const ASSET = /\.(png|jpe?g|webp|gif|ogg|mp3|wav|json|xml)$/i;

        const pathsIn = (node: unknown, out: string[] = []): string[] => {
            if (typeof node === 'string') {
                if (ASSET.test(node)) out.push(node);
            } else if (Array.isArray(node)) {
                for (const item of node) pathsIn(item, out);
            } else if (node !== null && typeof node === 'object') {
                for (const value of Object.values(node)) pathsIn(value, out);
            }
            return out;
        };

        const missing: string[] = [];
        const check = (label: string, spec: unknown): void => {
            for (const ref of pathsIn(spec)) {
                if (!existsSync(join(root, ref))) missing.push(`${label}: ${ref}`);
            }
        };

        for (const id of parseWeaponIndex(read(join(DATA, 'weapons', 'index.yaml'))).weapons) {
            check(`weapons/${id}`, parseWeaponYaml(read(join(DATA, 'weapons', `${id}.yaml`)), id));
        }
        for (const id of parseCharacterIndex(read(join(DATA, 'characters', 'index.yaml')))
            .characters) {
            check(
                `characters/${id}`,
                parseCharacterYaml(read(join(DATA, 'characters', `${id}.yaml`)), id),
            );
        }
        for (const id of parseMonsterIndex(read(join(DATA, 'monsters', 'index.yaml'))).monsters) {
            check(
                `monsters/${id}`,
                parseMonsterYaml(read(join(DATA, 'monsters', `${id}.yaml`)), id),
            );
        }
        for (const id of parseDropIndex(read(join(DATA, 'drops', 'index.yaml'))).drops) {
            check(`drops/${id}`, parseDropYaml(read(join(DATA, 'drops', `${id}.yaml`)), id));
        }
        for (const id of parseLevelIndex(read(join(DATA, 'levels', 'index.yaml'))).levels) {
            check(`levels/${id}`, parseLevelYaml(read(join(DATA, 'levels', `${id}.yaml`)), id));
        }
        for (const kind of ['sfx', 'music'] as const) {
            for (const id of parseAudioIndex(read(join(DATA, 'audios', 'index.yaml')))[kind]) {
                check(
                    `audios/${kind}/${id}`,
                    parseAudioYaml(read(join(DATA, 'audios', kind, `${id}.yaml`))),
                );
            }
        }

        expect(missing, `asset paths with no file under public/:\n${missing.join('\n')}`).toEqual(
            [],
        );
    });
});
