/**
 * src/components/hud/nickname-dialog.tsx
 * --------------------------------------------------------------------------
 * "请输入昵称", shown right after the player holds F to pick a character.
 *
 * The typed name replaces the five characters' own names for the rest of the run, so the
 * player is playing as themselves rather than as Gemini or Claude.
 *
 * The dice comes from the galgame (第七世's `rollRandomName`), including its refusal to
 * avoid repeats.
 *
 * One input is special: the galgame's seal key. Typing it does NOT become the nickname -
 * it unlocks the hidden map and asks for a name again
 * (`提示用户隐藏地图入口已开启，请重新输入昵称进行游玩`).
 */

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { EventBus } from '@/lib/events/bus';
import { normaliseNickname, resolveNicknameSubmission, rollRandomName } from '@/lib/nickname/pool';
import { t } from '@/locales';
import { useGameStore } from '@/store/game-store';

/** How long the "已开启" line stays up after the key is accepted. */
export const UNLOCKED_NOTICE_MS = 4000;

export function NicknameDialog() {
    const open = useGameStore((s) => s.nicknamePromptOpen);
    const setNickname = useGameStore((s) => s.setPlayerNickname);
    const unlock = useGameStore((s) => s.unlockHiddenMap);
    const close = useGameStore((s) => s.closeNicknamePrompt);

    const [value, setValue] = useState('');
    const [notice, setNotice] = useState<string | null>(null);
    const [unlocked, setUnlocked] = useState(false);

    // Phaser listens on window and swallows the keys it binds (W/A/S/D/F...), so a letter
    // never reached the input (`键盘打不上去字`). Disable its keyboard while we are open.
    useEffect(() => {
        if (!open) return;
        EventBus.emit('ui-typing', true);
        return () => void EventBus.emit('ui-typing', false);
    }, [open]);

    if (!open) return null;

    function submit() {
        const outcome = resolveNicknameSubmission(value);
        if (outcome.kind === 'unlocked') {
            unlock();
            // The portal is drawn from this moment on, no reload needed.
            EventBus.emit('hidden-map-unlocked');
            setUnlocked(true);
            setNotice(t('nickname.unlocked'));
            // Cleared on purpose: the key is not a name, so she has to type one.
            setValue('');
            return;
        }
        if (outcome.kind === 'rejected') {
            setNotice(t('nickname.empty'));
            return;
        }
        setNickname(outcome.nickname);
        setNotice(null);
    }

    return (
        <div
            data-testid="nickname-dialog"
            className="pointer-events-auto absolute inset-0 z-[10004] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
            <div className="flex w-[30rem] max-w-[92vw] flex-col gap-3 border border-stone-700 bg-stone-950/95 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
                <div className="border-b border-stone-800 pb-2 font-mono text-[16px] font-bold tracking-[0.2em] text-amber-300">
                    {t('nickname.title')}
                </div>

                <p className="font-mono text-[12px] leading-relaxed text-stone-400">
                    {t('nickname.hint')}
                </p>

                <div className="flex gap-2">
                    <input
                        data-testid="nickname-input"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') submit();
                        }}
                        placeholder={t('nickname.placeholder')}
                        autoFocus
                        maxLength={24}
                        className="flex-1 border border-stone-700 bg-stone-900 px-2 py-1.5 font-mono text-[14px] text-stone-100 outline-none focus:border-amber-600"
                    />
                    {/* The dice: one click, one name from the pool. */}
                    <button
                        type="button"
                        data-testid="nickname-roll"
                        aria-label={t('nickname.roll')}
                        onClick={() => {
                            setValue(rollRandomName());
                            setNotice(null);
                        }}
                        className="w-12 border border-stone-700 bg-stone-900 text-[18px] leading-none text-amber-200 hover:border-amber-600"
                    >
                        🎲
                    </button>
                </div>

                <div className="min-h-[1.25rem] font-mono text-[12px] leading-5 text-amber-300">
                    {notice}
                </div>

                <div className="flex gap-2">
                    <Button
                        data-testid="nickname-confirm"
                        onClick={submit}
                        disabled={!normaliseNickname(value)}
                        className="h-10 flex-1 rounded-none bg-amber-500 text-[14px] font-bold tracking-wider text-white hover:bg-amber-400"
                    >
                        {t('nickname.confirm')}
                    </Button>
                    {unlocked && (
                        <Button
                            data-testid="nickname-skip"
                            onClick={close}
                            variant="outline"
                            className="h-10 rounded-none border-stone-700 bg-stone-900/80 text-[13px] font-semibold tracking-wider text-stone-300 hover:bg-stone-800 hover:text-amber-300"
                        >
                            {t('nickname.skip')}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}