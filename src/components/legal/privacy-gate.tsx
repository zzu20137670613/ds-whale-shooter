/**
 * src/components/legal/privacy-gate.tsx
 * --------------------------------------------------------------------------
 * The first-launch privacy notice.
 *
 * TapTap (and every domestic store) opens the app once before approving it and expects a notice
 * that must be accepted before the game starts. 第七世's checklist: `首启要有隐私弹窗，同意才进游戏`.
 *
 * Store review finding 164017 sent the first version back, and it was right twice over:
 *
 *   「APP隐私政策弹窗应提供『同意』及『不同意』的选项，不能只提供『好的』『我知道了』『OK』」
 *   「用户选择『不同意』之后，可以合理挽留，但是不可以出现死循环弹窗」
 *
 * So the gate has two explicit choices, and a refusal goes to its own screen — not back to the
 * same dialog. The refusal screen explains the consequence once, offers an honest exit and a way
 * to reconsider, and never re-opens itself.
 *
 * The wording is deliberately about what THIS game does — no account, no server-side save, nothing
 * collected — because the reviewer compares the page against the app's real behaviour. The
 * 目的 / 方式 / 范围 triad is spelled out because that is the language the finding uses.
 */

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { requestExit } from '@/lib/legal/app-exit';
import { PRIVACY_POLICY_URL } from '@/lib/legal/consent';

export interface PrivacyGateProps {
    onAccept: () => void;
    /**
     * Injected in tests. Defaults to the real cross-platform exit so the declined screen can
     * actually close the app on Android (Capacitor) and Windows (Electron).
     */
    onExit?: () => string;
}

/** `asking` is the notice; `declined` is the one-shot consequence screen. Never loops back. */
type Stage = 'asking' | 'declined';

export function PrivacyGate({ onAccept, onExit }: PrivacyGateProps) {
    const [stage, setStage] = useState<Stage>('asking');
    const [exitNote, setExitNote] = useState<string | null>(null);

    if (stage === 'declined') {
        return (
            <div
                data-testid="privacy-declined"
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
            >
                <div className="w-full max-w-[520px] rounded border-2 border-stone-700/60 bg-[#141110] p-6 text-stone-200 shadow-2xl">
                    <h2 className="mb-4 text-center text-lg font-bold tracking-wide text-stone-300">
                        未同意，游戏不会启动
                    </h2>

                    <div className="space-y-3 text-sm leading-relaxed text-stone-400">
                        <p>
                            你选择了不同意。本游戏需要先阅读并同意上面的说明才能开始，所以
                            <strong className="text-stone-200">现在不会进入游戏</strong>。
                        </p>
                        <p>
                            再说一次我们的实际情况：本游戏
                            <strong className="text-stone-200">不采集任何个人信息</strong>
                            ，没有账号也没有登录，进度只存在你自己的机器上。你完全可以在不联网的
                            情况下从头玩到通关。
                        </p>
                        <p>想改变主意的话，点「重新阅读」回到说明页即可。</p>
                    </div>

                    {exitNote && (
                        <p
                            data-testid="privacy-exit-note"
                            className="mt-4 text-center text-xs leading-relaxed text-amber-300/80"
                        >
                            {exitNote}
                        </p>
                    )}

                    <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                        <Button
                            data-testid="privacy-exit"
                            onClick={() => {
                                const route = (onExit ?? requestExit)();
                                // Nothing to close (a plain browser tab): say so instead of
                                // pretending the click worked.
                                if (route === 'none') {
                                    setExitNote(
                                        '当前环境无法由游戏自己关闭，请手动关闭这个窗口或返回桌面。',
                                    );
                                }
                            }}
                            className="flex-1 bg-stone-700 py-3 text-base font-bold text-stone-100 hover:bg-stone-600"
                        >
                            退出游戏
                        </Button>
                        <Button
                            data-testid="privacy-reconsider"
                            onClick={() => {
                                setExitNote(null);
                                setStage('asking');
                            }}
                            className="flex-1 border border-amber-700/60 bg-transparent py-3 text-base font-bold text-amber-300 hover:bg-amber-900/30"
                        >
                            重新阅读
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            data-testid="privacy-gate"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
        >
            <div className="w-full max-w-[520px] rounded border-2 border-amber-700/60 bg-[#141110] p-6 text-stone-200 shadow-2xl">
                <h2 className="mb-4 text-center text-lg font-bold tracking-wide text-amber-300">
                    隐私与数据说明
                </h2>

                <div className="space-y-3 text-sm leading-relaxed text-stone-300">
                    <p>
                        <strong className="text-stone-100">收集范围：无。</strong>
                        本游戏不采集任何个人信息，没有账号，也没有登录。
                    </p>
                    <p>
                        <strong className="text-stone-100">存储方式：只写本机。</strong>
                        你的游戏进度、设置与昵称保存在本机的浏览器本地存储里，不会上传到任何
                        服务器；卸载应用或清空数据即一并删除。
                    </p>
                    <p>
                        <strong className="text-stone-100">唯一离开本机的数据：</strong>
                        只有你主动使用「留言」功能时，把留言发送给开发者——目的：接收玩家反馈；
                        方式：通过 HTTPS 传输；范围：留言正文与你自填的署名（可以不填）。
                        你不发留言，就没有任何数据离开这台设备。
                    </p>
                    <p className="text-stone-400">
                        请阅读
                        <a
                            data-testid="privacy-policy-link"
                            href={PRIVACY_POLICY_URL}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="mx-1 text-sky-300 underline decoration-dotted"
                        >
                            隐私政策
                        </a>
                        全文后选择是否同意。
                    </p>
                </div>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <Button
                        data-testid="privacy-accept"
                        onClick={onAccept}
                        className="flex-1 bg-amber-600 py-3 text-base font-bold text-stone-950 hover:bg-amber-500"
                    >
                        同意并继续
                    </Button>
                    <Button
                        data-testid="privacy-decline"
                        onClick={() => setStage('declined')}
                        className="flex-1 border border-stone-600 bg-transparent py-3 text-base font-bold text-stone-300 hover:bg-stone-800"
                    >
                        不同意
                    </Button>
                </div>
            </div>
        </div>
    );
}
