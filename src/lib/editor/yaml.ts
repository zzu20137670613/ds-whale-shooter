/**
 * src/lib/editor/yaml.ts
 * --------------------------------------------------------------------------
 * Serialize a Level back to YAML. Symmetric counterpart of
 * src/lib/levels/parser.ts — what you save should round-trip through parse.
 *
 * Pure / sync, no I/O. Used by the Vite editor middleware to write
 * public/data/levels/<id>.yaml.
 */

import { dump as stringifyYaml } from 'js-yaml';

import { formatImageSize, type Level } from '@/lib/levels/types';

export function serializeLevelYaml(level: Level): string {
    // Dump every Level field — the editor only edits airWalls, but
    // character / characterSpawn / monsters / dropSpawns must survive
    // a save. Skipping them here used to silently wipe them on save.
    //
    // Each field is mapped explicitly to its YAML shape:
    //   - imageSize       → "WxH" string
    //   - characterSpawn  → { x, y, facing }
    //   - monsters        → [{ type, x, y }, ...]
    //   - dropSpawns      → [{ type, x, y }, ...]
    //
    // Undefined optional fields are dropped so the YAML stays minimal.
    const payload: Record<string, unknown> = {
        title: level.title,
        background: level.background,
        imageSize: formatImageSize(level.imageSize),
        prompt: level.prompt,
        airWalls: level.airWalls,
    };
    // A level whose ground is not one painted image has to keep the field that
    // says so: dropping these would leave the merged library drawing only its
    // first block over an 11008x6144 world — art missing, no error anywhere.
    if (level.tilemap !== undefined) payload.tilemap = level.tilemap;
    if (level.backgroundBlocks !== undefined) {
        payload.backgroundBlocks = level.backgroundBlocks;
    }
    if (level.character !== undefined) payload.character = level.character;
    // Localized title: carry it through, or an editor save would silently
    // drop the Chinese title the same way the fields below used to be.
    if (level.titleZh !== undefined) payload.titleZh = level.titleZh;
    if (level.music !== undefined) payload.music = level.music;
    // `pixelLighting: false` is how a bright scene opts out of the ambient
    // twilight tint (scene.ts). Dropping it on save would re-darken the
    // pavilion and the beach the first time anyone moved a wall.
    if (level.pixelLighting !== undefined) payload.pixelLighting = level.pixelLighting;
    if (level.tavern !== undefined) payload.tavern = level.tavern;
    if (level.npcSpawns !== undefined) payload.npcSpawns = level.npcSpawns;
    if (level.characterSpawn !== undefined) {
        payload.characterSpawn = {
            x: level.characterSpawn.x,
            y: level.characterSpawn.y,
            facing: level.characterSpawn.facing,
        };
    }
    if (level.monsters !== undefined) {
        // `waveId` + `trigger` are what make a spawn wait for the previous
        // wave to clear. Dropping them (as this used to) turns every staged
        // wave into "all at once" the first time the level is saved from the
        // editor — a silent difficulty rewrite, not a cosmetic loss.
        payload.monsters = level.monsters.map((m) => ({
            type: m.type,
            x: m.x,
            y: m.y,
            ...(m.waveId !== undefined ? { waveId: m.waveId } : {}),
            ...(m.trigger !== undefined ? { trigger: m.trigger } : {}),
        }));
    }
    if (level.dropSpawns !== undefined) {
        // `weaponId` is how a weapon drop names which weapon it is.
        payload.dropSpawns = level.dropSpawns.map((d) => ({
            type: d.type,
            x: d.x,
            y: d.y,
            ...(d.weaponId !== undefined ? { weaponId: d.weaponId } : {}),
        }));
    }
    if (level.materials !== undefined) {
        payload.materials = level.materials;
    }
    if (level.teleporters !== undefined) {
        payload.teleporters = level.teleporters;
    }
    // One-shot region triggers (the beach lounger's juice). Dropping them here
    // would silently delete the easter egg the first time anyone saves a wall.
    if (level.triggers !== undefined) {
        payload.triggers = level.triggers;
    }
    return stringifyYaml(payload, {
        lineWidth: -1,
        sortKeys: false,
        noRefs: true,
    });
}
