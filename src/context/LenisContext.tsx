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
        });

        appLenis = lenis;

        function raf(time: number) {
            lenis.raf(time);
            requestAnimationFrame(raf);
        }

        requestAnimationFrame(raf);

        return () => {
            lenis.destroy();
            appLenis = null;
        };
    }, []);

    return <>{children}</>;
}
