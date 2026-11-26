import { useEffect, ReactNode } from 'react';
import Lenis from 'lenis';

let appLenis: Lenis | null = null;

export function getAppLenis(): Lenis | null {
    return appLenis;
}

export function LenisProvider({ children }: { children: ReactNode }) {
    useEffect(() => {
        const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
        if (isTouchDevice) return;

        const lenis = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            orientation: 'vertical',
            gestureOrientation: 'vertical',
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 1,
            // Lenis runs its own frame loop and cancels it in destroy(); a hand-rolled loop outlived unmount.
            autoRaf: true,
        });

        appLenis = lenis;

        return () => {
            lenis.destroy();
            appLenis = null;
        };
    }, []);

    return <>{children}</>;
}
