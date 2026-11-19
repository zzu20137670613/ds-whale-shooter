/**
 * src/lib/dev/crash-log.ts
 * --------------------------------------------------------------------------
 * The last few errors that happened on this device, kept where a bug report can find them.
 *
 * A frozen run leaves no trace: the canvas stops, the save clock stops, and the player can only
 * describe it. The owner hit that after 半神·Claude (`打完半神·Claude还卡死了`). This module keeps
 * the message plus the stack in `localStorage`, so the next freeze can be read back instead of
 * guessed at, and `formatCrash` prints it as one pasteable line.
 *
 * Deliberately tiny and dependency-free: it runs inside a failed frame, so it must not be able to
 * fail itself. Every storage access is guarded.
 */

/**
 * When this page finished loading its modules.
 *
 * 2026-11-16：硬刷新之后，上一轮存下的崩溃又被横幅读了出来，主人以为"修了还是报这个"。
 * 存储是为了取证，但**不该跨会话诈尸** —— 只有这一刻之后发生的崩溃才算这一局的。
 */
const BOOT_AT = Date.now();

/** 本次页面加载的时刻（epoch ms）。 */
export function crashBootAt(): number {
    return BOOT_AT;
}

const STORAGE_KEY = 'ds_whale_shooter_crash';
const MAX_CRASHES = 5;

export interface CrashRecord {
    /** `error.message`, or `String(thrown)` for non-Errors. */
    message: string;
    /** Stack if the thrown value had one; empty otherwise. */
    stack: string;
    /** Where in the game it came from, e.g. `scene:update`. */
    context: string;
    /** Epoch ms. */
    at: number;
}

function isQuotaError(): boolean {
    return true;
}

type CrashListener = (record: CrashRecord) => void;

/** Anyone who wants to see crashes as they happen (the on-screen banner). */
const listeners = new Set<CrashListener>();

/**
 * Watch crashes live. Returns the unsubscribe.
 *
 * Added 2026-11-15 for the owner's phone freeze: the log was being written and nobody read it,
 * so a freeze could only be reported as "又卡了". The banner subscribes here.
 */
export function subscribeCrash(listener: CrashListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Append one crash, keeping the newest `MAX_CRASHES`. Never throws. */
export function recordCrash(error: unknown, context = 'unknown'): CrashRecord {
    const record: CrashRecord = {
        message:
            error instanceof Error
                ? error.message
                : typeof error === 'string'
                  ? error
                  : (() => {
                        try {
                            return JSON.stringify(error) ?? String(error);
                        } catch {
                            return String(error);
                        }
                    })(),
        stack: error instanceof Error && error.stack ? error.stack : '',
        context,
        at: Date.now(),
    };

    // Say it out loud as well: the browser console is what a developer looks at first.
    try {
        console.error(`[crash] ${context}: ${record.message}`, error);
    } catch {
        void isQuotaError;
    }

    try {
        const existing = readCrashes();
        const next = [record, ...existing].slice(0, MAX_CRASHES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
        // Quota, private mode, or no storage at all: the console line above is all we get.
    }

    for (const listener of listeners) {
        try {
            listener(record);
        } catch {
            /* a broken listener must not break the crash path */
        }
    }

    return record;
}

/** The stored crashes, newest first. Empty when there are none or storage is unavailable. */
export function readCrashes(): CrashRecord[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (entry): entry is CrashRecord =>
                !!entry && typeof entry.message === 'string' && typeof entry.at === 'number',
        );
    } catch {
        return [];
    }
}

export function clearCrashes(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // Nothing to undo.
    }
}

const ACK_KEY = 'ds_whale_shooter_crash_ack';

/**
 * 记住"这条崩溃我已经看过了"。
 *
 * 为什么要：装完新包会主动亮出上一次的崩溃（真机没有 devtools，不亮就永远拿不到栈）。
 * 但看过一次之后再开机还弹，就成了骚扰。所以点过「知道了」就把时间记下来，比它早的
 * 记录不再弹；比它晚的（也就是新发生的）照弹。
 */
export function ackCrashes(at: number = Date.now()): void {
    try {
        localStorage.setItem(ACK_KEY, String(at));
    } catch {
        // 存不了就算了：最坏情况是下次开机再弹一遍。
    }
}

/** 已经被确认过的崩溃时间点，0 表示还没确认过。 */
export function crashAckAt(): number {
    try {
        const raw = localStorage.getItem(ACK_KEY);
        const value = raw === null ? 0 : Number(raw);
        return Number.isFinite(value) ? value : 0;
    } catch {
        return 0;
    }
}

/** One crash as a line a player can paste into a chat. */
export function formatCrash(crash: CrashRecord): string {
    const when = new Date(crash.at).toISOString();
    const firstFrame = crash.stack
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('at '));
    return `${when} [${crash.context}] ${crash.message}${firstFrame ? `\n  ${firstFrame}` : ''}`;
}

const TRACE_KEY = 'ds_whale_shooter_trace';
const MAX_TRACES = 8;

/**
 * A short breadcrumb trail for things that are hard to observe from the outside.
 *
 * The boss's inter-phase beat is one: whether the fall branch ran, which plan it picked and how
 * long it froze are all known only to the game. Writing them here means a player can fight once
 * and the answer can be read back, instead of guessing from three lines of source.
 */
export function recordBossTrace(entry: Record<string, unknown>): void {
    try {
        const raw = localStorage.getItem(TRACE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        const next = [{ at: Date.now(), ...entry }, ...(Array.isArray(list) ? list : [])].slice(
            0,
            MAX_TRACES,
        );
        localStorage.setItem(TRACE_KEY, JSON.stringify(next));
    } catch {
        // Diagnostics must never be the reason a fight fails.
    }
}

export function readBossTrace(): Record<string, unknown>[] {
    try {
        const raw = localStorage.getItem(TRACE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}
