/**
 * src/components/hud/dev-cabin-panel.tsx
 * --------------------------------------------------------------------------
 * The developer cabin's computer, when you click it.
 *
 * It opens straight onto the compose window. It used to open on a fake login screen
 * (an email address and a password nobody could fail) and only then let you write - two
 * dialogs where one belongs, with a form that asked for nothing. The joke only works if
 * it is honest: this is the developer's desktop, and what you write ends up where he
 * actually reads.
 *
 * Delivery is `sendLetter`'s problem (relay first, GitHub issue page second);
 * this file only collects the text and shows what happened.
 */

import { useEffect, useState } from 'react';

import { DEV_CABIN_GUESTBOOK, DEV_CABIN_RELAY, DEV_CABIN_REPO } from '@/lib/dev-cabin/config';
import { type Letter, emptyLetter, sendLetter, validateLetter } from '@/lib/dev-cabin/mail';
import { useGameStore } from '@/store/game-store';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; text: string };

export function DevCabinPanel() {
    const open = useGameStore((s) => s.devCabinOpen);
    const close = useGameStore((s) => s.closeDevCabin);

    const [letter, setLetter] = useState<Letter>(emptyLetter);
    const [touched, setTouched] = useState(false);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });

    // Every opening starts with an empty desk.
    useEffect(() => {
        if (!open) return;
        setLetter(emptyLetter());
        setTouched(false);
        setStatus({ kind: 'idle' });
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, close]);

    if (!open) return null;

    const errors = validateLetter(letter);
    const canSend = Object.keys(errors).length === 0 && status.kind !== 'sending';

    const send = async () => {
        setTouched(true);
        if (!canSend) return;
        setStatus({ kind: 'sending' });
        const result = await sendLetter(letter, {
            relay: DEV_CABIN_RELAY,
            repo: DEV_CABIN_REPO,
            fetcher: (input, init) => fetch(input, init),
            open: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
        });
        if (result.via === 'relay') {
            setStatus({ kind: 'done', text: '寄出去了。这封信已经在他的收件箱里。' });
        } else if (result.via === 'issue') {
            setStatus({
                kind: 'done',
                text: '信已经装进 GitHub 了。新标签页里点最下面那个绿色按钮，他就收到了。',
            });
        } else {
            setStatus({ kind: 'done', text: '寄不出去。你可以直接去留言板说。' });
        }
    };

    return (
        <div
            data-testid="dev-cabin-panel"
            className="absolute inset-0 z-[10002] flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
            onClick={close}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-[440px] max-w-[92vw] border border-white/25 bg-[#1b1f27] shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
            >
                {/* Title bar: an OS window that belongs to someone else. */}
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                    <span className="font-mono text-[10px] tracking-[0.25em] text-white/65">
                        给开发者留言
                    </span>
                    <button
                        type="button"
                        onClick={close}
                        className="font-mono text-[11px] text-white/55 transition-colors hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-col gap-3 p-5">
                    <p className="font-mono text-[11px] leading-relaxed text-white/55">
                        这台电脑不是你的，不过既然进来了，给开发者留个言吧。
                    </p>

                    <input
                        value={letter.handle}
                        onChange={(e) => setLetter({ ...letter, handle: e.target.value })}
                        placeholder="署名（可以不填）"
                        className="border border-white/12 bg-white/8 px-2 py-1.5 font-mono text-[12px] text-white/90 outline-none focus:border-white/35"
                    />
                    <div>
                        <input
                            value={letter.reply}
                            onChange={(e) => setLetter({ ...letter, reply: e.target.value })}
                            placeholder="回信地址（可以不填）"
                            className="w-full border border-white/12 bg-white/8 px-2 py-1.5 font-mono text-[12px] text-white/90 outline-none focus:border-white/35"
                        />
                        {touched && errors.reply && (
                            <p className="mt-1 font-mono text-[10px] text-amber-300/70">
                                {errors.reply}
                            </p>
                        )}
                    </div>

                    <div>
                        <textarea
                            value={letter.message}
                            onChange={(e) => setLetter({ ...letter, message: e.target.value })}
                            placeholder="想说什么都行。"
                            rows={7}
                            className="w-full resize-none border border-white/12 bg-white/8 px-2 py-1.5 font-mono text-[12px] leading-relaxed text-white/90 outline-none focus:border-white/35"
                        />
                        <div className="mt-1 flex items-center justify-between">
                            {touched && errors.message ? (
                                <p className="font-mono text-[10px] text-amber-300/70">
                                    {errors.message}
                                </p>
                            ) : (
                                <span />
                            )}
                            <span className="font-mono text-[10px] text-white/20">
                                {letter.message.length}
                            </span>
                        </div>
                    </div>

                    {status.kind === 'done' && (
                        <p className="border border-white/10 bg-white/[0.03] px-2 py-1.5 font-mono text-[11px] leading-relaxed text-white/55">
                            {status.text}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={() => void send()}
                        disabled={status.kind === 'sending'}
                        className="border border-white/20 py-1.5 font-mono text-[11px] tracking-[0.25em] text-white/70 transition-colors hover:border-white/50 hover:text-white disabled:opacity-40"
                    >
                        {status.kind === 'sending' ? '寄 出 中…' : '确 定'}
                    </button>

                    <a
                        href={DEV_CABIN_GUESTBOOK}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-end font-mono text-[10px] text-white/25 underline-offset-2 transition-colors hover:text-white/60 hover:underline"
                    >
                        看看别人说了什么
                    </a>
                </div>
            </div>
        </div>
    );
}
