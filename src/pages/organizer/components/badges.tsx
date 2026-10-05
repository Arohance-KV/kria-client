import { useId } from 'react';

// The award-badge catalogue, organizer side. Keys must match the server's
// BADGE_KEYS (server/src/models/player.model.ts); mobile renders the same keys
// from src/lib/badges.ts. Art: Kria Award Badges.dc.html.
type Tier = 'legendary' | 'elite' | 'gold' | 'rare' | 'steel';
type Emblem =
    | 'star' | 'trophy' | 'stumps' | 'shield' | 'gavel' | 'bat'
    | 'bracket' | 'racket' | 'shuttle' | 'flag' | 'medal' | 'target';
export interface BadgeDef { key: string; name: string; tier: Tier; emblem: Emblem }

export const BADGES: BadgeDef[] = [
    { key: 'player-of-the-match', name: 'Player of the Match', tier: 'legendary', emblem: 'star' },
    { key: 'season-mvp', name: 'Season MVP', tier: 'legendary', emblem: 'trophy' },
    { key: 'hat-trick', name: 'Hat-Trick', tier: 'elite', emblem: 'stumps' },
    { key: 'undefeated-run', name: 'Undefeated Run', tier: 'elite', emblem: 'shield' },
    { key: 'auction-steal', name: 'Auction Steal', tier: 'elite', emblem: 'gavel' },
    { key: 'centurion', name: 'Centurion', tier: 'gold', emblem: 'bat' },
    { key: 'clean-sweep', name: 'Clean Sweep', tier: 'gold', emblem: 'bracket' },
    { key: 'rally-king', name: 'Rally King', tier: 'gold', emblem: 'racket' },
    { key: 'ace-serve', name: 'Ace Serve', tier: 'rare', emblem: 'shuttle' },
    { key: 'fair-play', name: 'Fair Play', tier: 'rare', emblem: 'flag' },
    { key: 'iron-player', name: 'Iron Player', tier: 'steel', emblem: 'medal' },
    { key: 'first-cap', name: 'First Cap', tier: 'steel', emblem: 'target' },
];

type StopDef = [offset: number, color: string, opacity?: number];

const TIER_STROKE: Record<Tier, StopDef[]> = {
    legendary: [[0, '#FFD37A'], [0.38, '#F97316'], [0.72, '#FA4C93'], [1, '#7A1E3C']],
    elite: [[0, '#FF8FC0'], [0.5, '#FA4C93'], [1, '#5E1533']],
    gold: [[0, '#FFD37A'], [0.48, '#F97316'], [1, '#6B2C07']],
    rare: [[0, '#7BF2B4'], [0.5, '#16C46A'], [1, '#0A4428']],
    steel: [[0, '#EDEDED'], [0.5, '#9A9A9A'], [1, '#3A3A3A']],
};

const TIER_HALO: Partial<Record<Tier, StopDef[]>> = {
    legendary: [[0, '#F97316', 0.95], [0.6, '#FA4C93', 0.35], [1, '#FA4C93', 0]],
    elite: [[0, '#FA4C93', 0.9], [1, '#FA4C93', 0]],
    gold: [[0, '#F97316', 0.9], [1, '#F97316', 0]],
};

// 24×24 emblem strokes. A string strokes in the tier gradient; a tuple keeps
// the design's fixed accent colour.
type Stroke = string | [d: string, color: string];
const EMBLEM: Record<Emblem, Stroke[]> = {
    star: ['M12 3l2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6z', 'M12 8.5l1.2 2.3 2.3 1.2-2.3 1.2L12 15.5l-1.2-2.3L8.5 12l2.3-1.2z'],
    trophy: ['M6 4h12v4l-6 7-6-7z', 'M6 5.5H3v3l3 2M18 5.5h3v3l-3 2M12 15v4M8 20.5h8'],
    stumps: ['M7 8v13M12 8v13M17 8v13', ['M5.8 6.6h6.4M11.8 6.6h6.4', '#FF8FC0']],
    shield: ['M12 3l8 3v7l-8 8-8-8V6z', 'M9 12l2.5 2.5L16 10'],
    gavel: ['M12.5 2.5l9 9-3 3-9-9z', 'M10.5 8.5 3 16l2.5 2.5L13 11M13 21h8'],
    bat: ['M10 2.5h4v4h-4z', 'M8.5 6.5h7l-.5 10-3 5-3-5z', ['M12 8v12', '#FFD37A']],
    bracket: ['M3 6h4M3 11h4M7 6v5M7 8.5h5M3 15h4M3 20h4M7 15v5M7 17.5h5M12 8.5v9M12 13h9'],
    racket: ['M12 3l6 5-6 5-6-5z', 'M9 5.5h6M8.6 8.2h6.8M12 3v18M10 21h4'],
    shuttle: ['M9.5 3h5l1 4h-7z', 'M7.5 7 4 19l8 2 8-2L16.5 7z', 'M10 7 8.4 19M14 7l1.6 12M12 7v14'],
    flag: [['M6 3v18', '#7BF2B4'], 'M6 4h12l-2.5 4L18 12H6z'],
    medal: ['M8 3l2 5.5M16 3l-2 5.5', 'M8 9h8v8H8zM11 12h2v2h-2z'],
    target: ['M4 4h16v16H4zM8.5 8.5h7v7h-7zM11.3 11.3h1.4v1.4h-1.4z'],
};

const OUTER = 'M120 6 214 60v120l-94 54-94-54V60z';
const INNER = 'M120 22 200 68v104l-80 46-80-46V68z';

const stops = (s: StopDef[]) =>
    s.map(([offset, color, opacity = 1]) => (
        <stop key={offset} offset={offset} stopColor={color} stopOpacity={opacity} />
    ));

/** Static thumbnail — the picker needs recognition, not motion. */
export function BadgeArt({ badge, size = 40 }: { badge: BadgeDef; size?: number }) {
    // Gradient ids are document-global on the web, so twelve thumbnails need
    // their own. React 18's useId contains colons, which break url(#…).
    const id = useId().replace(/:/g, '');
    const halo = TIER_HALO[badge.tier];
    return (
        <svg viewBox="0 0 240 240" width={size} height={size} aria-hidden="true">
            <defs>
                <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="1">{stops(TIER_STROKE[badge.tier])}</linearGradient>
                <linearGradient id={`${id}p`} x1="0" y1="0" x2="0.6" y2="1">
                    <stop offset="0" stopColor="#1E1E1E" />
                    <stop offset="1" stopColor="#0B0B0B" />
                </linearGradient>
                {halo && <radialGradient id={`${id}h`}>{stops(halo)}</radialGradient>}
            </defs>
            {halo && <circle cx="120" cy="120" r="98" fill={`url(#${id}h)`} opacity={0.6} />}
            <path d={OUTER} fill={`url(#${id}p)`} stroke={`url(#${id}s)`} strokeWidth={5} />
            <path d={INNER} fill={`url(#${id}p)`} fillOpacity={0.65} stroke={`url(#${id}s)`} strokeWidth={1.5} strokeOpacity={0.5} />
            <g transform="translate(79.2 77.2) scale(3.4)" fill="none" strokeWidth={1.7} strokeLinecap="square" strokeLinejoin="miter">
                {EMBLEM[badge.emblem].map((s, i) =>
                    typeof s === 'string'
                        ? <path key={i} d={s} stroke={`url(#${id}s)`} />
                        : <path key={i} d={s[0]} stroke={s[1]} />
                )}
            </g>
        </svg>
    );
}
