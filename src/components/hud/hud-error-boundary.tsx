/**
 * src/components/hud/hud-error-boundary.tsx
 * --------------------------------------------------------------------------
 * One broken overlay must not take the game with it.
 *
 * A missing import in the weapon HUD (`t is not defined`) threw during render and the
 * whole React tree unmounted - the canvas kept running behind a completely black page.
 * A HUD bug should cost you that HUD, not the screen.
 *
 * React only catches render-time errors with a class component, so this is one.
 */

import React, { type ReactNode } from 'react';

interface HudErrorBoundaryProps {
    /** Shown in the console tag so the failing overlay is identifiable. */
    name: string;
    children: ReactNode;
}

interface HudErrorBoundaryState {
    failed: boolean;
}

export class HudErrorBoundary extends React.Component<HudErrorBoundaryProps, HudErrorBoundaryState> {
    state: HudErrorBoundaryState = { failed: false };

    static getDerivedStateFromError(): HudErrorBoundaryState {
        return { failed: true };
    }

    componentDidCatch(error: unknown): void {
        // Deliberately loud: a silent HUD means nobody ever fixes it.
        console.error(`[hud:${this.props.name}] crashed and was unmounted`, error);
    }

    render(): ReactNode {
        return this.state.failed ? null : this.props.children;
    }
}