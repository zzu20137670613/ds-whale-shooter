/**
 * src/components/hud/letter-dialog.tsx
 * --------------------------------------------------------------------------
 * The compose window: a letter form that goes to the developer.
 *
 * Extracted from the dev cabin's computer so the support panel can reuse the same window
 * with different words (`复用开发者小屋点屏幕的弹框…注意，复用时不要影响开发者小屋原本的那个弹框`).
 * The cabin keeps its original copy; the sponsor variant changes only the prompt, the first
 * field's placeholder, and drops the guestbook link.
 *
 * Delivery is `sendLetter`'s problem (relay first, Gitee issue page second); this file only
 * collects the text and shows what happened.
 */

import { useState } from 'react';

import { STORE_BUILD } from '@/lib/build/store-build';
import { DEV_CABIN_GUESTBOOK, DEV_CABIN_RELAY, DEV_CABIN_REPO } from '@/lib/dev-cabin/config';
import { type Letter, emptyLetter, sendLetter, validateLetter } from '@/lib/dev-cabin/mail';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; text: string };

/** Who is asking. Only the words differ. */
export type LetterVariant = 'cabin' | 'sponsor';

const COPY: Record<LetterVariant, { prompt: string; handle: string; showGuestbook: boolean }> = {
    cabin: {
        prompt: '这台电脑不是你的，不过既然进来了，给开发者留个言吧。',
        handle: '署名（可以不填）',
        showGuestbook: true,
    },
    sponsor: {
        prompt: '感谢金主大佬支持，请填写以下信息，作者会第一时间联系您',
        handle: '联系方式，必填（推荐填写手机号、QQ号或者微信号）',
        showGuestbook: false,
    },
};

export interface LetterDialogProps {
    variant: LetterVariant;
    onClose: () => void;
    testId?: string;
}

export function LetterDialog({ variant, onClose, testId }: LetterDialogProps) {
    const copy = COPY[variant];

    // A store build must contain no way to reach the network: the form posts to the relay, and
    // the guestbook link leaves the device. Neither is compiled out of a normal build, so the
    // check lives here, before any of the state above is even created.
    if (STORE_BUILD) {
        return (
            <div
                data-testid={testId ?? 'letter-dialog'}
                className="absolute inset-0 z-[10003] flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
                onClick={onClose}
            >
                <div
                    onClick={(e) => e.stopPropagation()}
                    className="w-[420px] max-w-[92vw] border border-white/25 bg-[#1b1f27] shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
                >
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                        <span className="font-mono text-[10px] tracking-[0.25em] text-white/65">
                            给开发者留言
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="font-mono text-[11px] text-white/55 transition-colors hover:text-white"
                        >
                            ✕
                        </button>
                    </div>
                    <p className="px-5 py-8 text-center font-mono text-[12px] leading-relaxed text-white/55">
                        本版本为单机版，未开放留言功能。
                    </p>
                </div>
            </div>
        );
    }

    const [letter, setLetter] = useState<Letter>(emptyLetter);
    const [touched, setTouched] = useState(false);
    const [status, setStatus] = useState<Status>({ kind: 'idle' });

    // The sponsor form asks for a way to be contacted and says so; the cabin's does not.
    const errors = validateLetter(letter, {
        requireHandle: variant === 'sponsor',
        handleLabel: '联系方式',
    });
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
                text: '信已经装进 Gitee 了。新标签页里点最下面那个按钮，他就收到了。',
            });
        } else {
            setStatus({ kind: 'done', text: '寄不出去。你可以直接去留言板说。' });
        }
    };

    return (
        <div
            data-testid={testId ?? 'letter-dialog'}
            className="absolute inset-0 z-[10003] flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
            onClick={onClose}
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
                        onClick={onClose}
                        className="font-mono text-[11px] text-white/55 transition-colors hover:text-white"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex flex-col gap-3 p-5">
                    <p className="font-mono text-[11px] leading-relaxed text-white/55">
                        {copy.prompt}
                    </p>

                    <input
                        value={letter.handle}
                        onChange={(e) => setLetter({ ...letter, handle: e.target.value })}
                        placeholder={copy.handle}
                        className="border border-white/12 bg-white/8 px-2 py-1.5 font-mono text-[12px] text-white/90 outline-none focus:border-white/35"
                    />
                    {touched && errors.handle && (
                        <p className="mt-1 font-mono text-[10px] text-amber-300/70">
                            {errors.handle}
                        </p>
                    )}
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

                    {copy.showGuestbook && (
                        <a
                            href={DEV_CABIN_GUESTBOOK}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="self-end font-mono text-[10px] text-white/25 underline-offset-2 transition-colors hover:text-white/60 hover:underline"
                        >
                            看看别人说了什么
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
