/**
 * src/lib/pet/bridge.ts
 * --------------------------------------------------------------------------
 * Talking to 第七世's desktop pet.
 *
 * The pet is a separate Electron app on the player's machine that already runs
 * a small local HTTP server. It is the only reason this game can offer the
 * "鲸鲸娘本人游玩" buff: the pet's own progression decides how strong it is.
 *
 * Two rules shape everything here:
 *
 *   1. **The pet is optional.** Every failure - not installed, not running,
 *      old build, wrong protocol, slow to answer - has to look the same to the
 *      rest of the game: "no bonus from the pet", never an exception on boot.
 *      So every call is time-boxed and every error is swallowed into a value.
 *   2. **The bridge is read-only from here.** We read `ping` and `level`; the
 *      pet decides what those mean. `protocol` gates compatibility, and a
 *      mismatch degrades exactly like a missing pet.
 *
 * Tiers are hers (2026-10-26, pet 0.13.10):
 *
 *   Lv.1-4  +10%   Lv.5-6  +20%   Lv.7-8  +30%   Lv.9-10  +40%   MAX  +50%
 */

/** Where the pet listens. Fixed by her; not configurable on our side. */
export const PET_BRIDGE_ORIGIN = 'http://127.0.0.1:38930';

/** Required query parameter on every route - her server rejects requests without it. */
export const PET_BRIDGE_APP = 'ds-pet-bridge';

/** The only protocol this build understands. */
export const PET_PROTOCOL = 1;

/**
 * Bonus used when the pet cannot be reached at all (not installed, asleep, or
 * an older build without `/level`).
 *
 * The owner set this at 20%, deliberately below every real tier (10/20/30/40/50):
 * it is the floor for "I cannot verify your pet", not a substitute for MAX. An
 * old build keeps half of a maxed pet's value instead of all of it, so upgrading
 * the pet is still worth doing, while nobody's panel collapses on the day they
 * update the game.
 */
export const PET_FALLBACK_BONUS_PERCENT = 20;

/**
 * How long her window keeps talking after we hide her, in ms.
 *
 * 第七世 (2026-10-26): `suspend` starts a 1.4s line - "我去游戏里了，打完记得叫我。"
 * - and only then does her window `hide()`. Sending `resume` inside that window cuts her
 * off mid-sentence and pops the window back up in front of the player.
 */
export const PET_SUSPEND_GRACE_MS = 1400;

/**
 * How long the game may look "gone" before she is actually hidden, in ms.
 *
 * A level change used to reload the page, so the pet saw the game vanish and then come
 * back - she popped up and disappeared on every map (`每次换图桌宠都会出现一下再消失`). Map
 * changes no longer reload, which removes the cause; this window is the belt to that
 * brace: three seconds of silence before she hides, long enough for any in-game transition
 * to finish without her ever reacting.
 */
export const PET_RELINK_GRACE_MS = 3000;

/** How long any single bridge call may take before it is treated as absent. */
export const PET_TIMEOUT_MS = 900;

export interface PetLevel {
    level: number;
    max: boolean;
    label: string;
    affinity: number;
    bonusPercent: number;
}

export type PetProbe =
    /** The pet answered and speaks our protocol. */
    | { ok: true; version: string; state: string; level: PetLevel }
    /** Something was there, but it cannot tell us a level (older build). */
    | { ok: false; reason: 'no-level' }
    /** Nothing usable on the port. */
    | { ok: false; reason: 'absent' };

export interface PetDeps {
    fetcher: (input: string, init?: RequestInit) => Promise<Response>;
    /** Overridable for tests; defaults to the real fixed origin. */
    origin?: string;
}

const url = (origin: string, route: string): string =>
    `${origin}/__pet/${route}?app=${PET_BRIDGE_APP}`;

/** `fetch` with a deadline, built on AbortController. */
async function getJson(deps: PetDeps, route: string): Promise<Record<string, unknown> | null> {
    const origin = deps.origin ?? PET_BRIDGE_ORIGIN;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PET_TIMEOUT_MS);
    try {
        const res = await deps.fetcher(url(origin, route), {
            method: 'GET',
            signal: controller.signal,
        });
        if (!res.ok) return null;
        return (await res.json()) as Record<string, unknown>;
    } catch {
        // Offline, CORS refused, aborted, malformed JSON - all the same thing
        // to a caller: no answer.
        return null;
    } finally {
        clearTimeout(timer);
    }
}

/** Numbers from the wire, clamped to something a stat multiplier can use. */
export function readBonusPercent(raw: unknown): number | null {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
    if (raw < 0 || raw > 100) return null;
    return raw;
}

/**
 * Ask the pet who it is and how far along it is.
 *
 * `protocol` is checked before anything else: a pet that speaks a different
 * protocol may still answer, but its numbers mean something else.
 */
export async function probePet(deps: PetDeps): Promise<PetProbe> {
    const ping = await getJson(deps, 'ping');
    if (!ping || ping.ok !== true) return { ok: false, reason: 'absent' };
    if (ping.protocol !== PET_PROTOCOL) return { ok: false, reason: 'absent' };

    const version = typeof ping.version === 'string' ? ping.version : 'unknown';
    const state = typeof ping.state === 'string' ? ping.state : 'unknown';

    const levelRaw = await getJson(deps, 'level');
    if (!levelRaw || levelRaw.ok !== true) return { ok: false, reason: 'no-level' };
    if (levelRaw.protocol !== PET_PROTOCOL) return { ok: false, reason: 'no-level' };

    const bonusPercent = readBonusPercent(levelRaw.bonusPercent);
    const level = typeof levelRaw.level === 'number' ? levelRaw.level : NaN;
    if (bonusPercent === null || !Number.isFinite(level)) {
        return { ok: false, reason: 'no-level' };
    }

    return {
        ok: true,
        version,
        state,
        level: {
            level,
            max: levelRaw.max === true,
            label: typeof levelRaw.label === 'string' ? levelRaw.label : `Lv.${level}`,
            affinity: typeof levelRaw.affinity === 'number' ? levelRaw.affinity : 0,
            bonusPercent,
        },
    };
}

/** The multiplier to hang on the whale girl's whole panel. */
export function bonusMultiplier(percent: number): number {
    return 1 + percent / 100;
}

/**
 * What the game should actually apply. One call, one number: the pet's tier if
 * it answered, the fallback otherwise.
 */
export async function resolvePetBonus(deps: PetDeps): Promise<{
    percent: number;
    source: 'pet' | 'fallback';
    label: string;
}> {
    const probe = await probePet(deps);
    if (probe.ok) {
        return { percent: probe.level.bonusPercent, source: 'pet', label: probe.level.label };
    }
    return {
        percent: PET_FALLBACK_BONUS_PERCENT,
        source: 'fallback',
        label: probe.reason === 'no-level' ? '桌宠（旧版本）' : '桌宠',
    };
}

/**
 * POST to a bridge route. Mutations are POST-only on her server (a GET returns
 * 405, which is how the routes were located - `/__shell/*` never existed).
 */
async function post(deps: PetDeps, route: string): Promise<boolean> {
    const origin = deps.origin ?? PET_BRIDGE_ORIGIN;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PET_TIMEOUT_MS);
    try {
        const res = await deps.fetcher(url(origin, route), {
            method: 'POST',
            signal: controller.signal,
        });
        if (!res.ok) return false;
        const body = (await res.json()) as Record<string, unknown>;
        return body.ok !== false;
    } catch {
        return false;
    } finally {
        clearTimeout(timer);
    }
}

/**
 * Ask the pet to hide itself and stop its effects - "被吸进电脑里了".
 *
 * She deliberately does NOT kill the process: a crashed game or a force quit
 * would leave the pet unrecoverable, whereas hiding it looks identical to the
 * player and can always be undone. Her side also auto-resumes after ten
 * minutes, and the tray/hotkey can pull her back, so a lost game cannot strand
 * her.
 */
export function suspendPet(deps: PetDeps): Promise<boolean> {
    return post(deps, 'suspend');
}

/** Ask the pet to come back out. Safe to call when she was never suspended. */
export function resumePet(deps: PetDeps): Promise<boolean> {
    return post(deps, 'resume');
}
