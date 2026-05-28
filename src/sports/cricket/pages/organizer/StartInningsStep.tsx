import React, { useState } from 'react';
import type { PlayerSlot } from '@/sports/cricket/lib/lineup';

interface Props {
    inningsNumber: number;
    battingXI: PlayerSlot[];
    bowlingXI: PlayerSlot[];
    onReady: (openers: { strikerId: string; nonStrikerId: string; bowlerId: string }) => void;
}

export default function StartInningsStep({ inningsNumber, battingXI, bowlingXI, onReady }: Props) {
    const [strikerId, setStrikerId] = useState('');
    const [nonStrikerId, setNonStrikerId] = useState('');
    const [bowlerId, setBowlerId] = useState('');

    const valid = strikerId && nonStrikerId && bowlerId && strikerId !== nonStrikerId;

    const picker = (label: string, value: string, set: (v: string) => void, opts: PlayerSlot[], exclude?: string) => (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-gray-400">{label}</span>
            <select value={value} onChange={e => set(e.target.value)} className="h-10 rounded-md border border-white/10 bg-black/50 px-3 text-sm text-white">
                <option value="">— select —</option>
                {opts.filter(p => p.registrationId !== exclude).map(p => <option key={p.registrationId} value={p.registrationId}>{p.name}</option>)}
            </select>
        </div>
    );

    return (
        <div className="max-w-md mx-auto bg-black/30 border border-white/10 rounded-2xl p-6 flex flex-col gap-4">
            <h3 className="text-lg font-bold text-white">Start Innings {inningsNumber}</h3>
            {picker('Striker', strikerId, setStrikerId, battingXI, nonStrikerId)}
            {picker('Non-striker', nonStrikerId, setNonStrikerId, battingXI, strikerId)}
            {picker('Opening bowler', bowlerId, setBowlerId, bowlingXI)}
            <button onClick={() => valid && onReady({ strikerId, nonStrikerId, bowlerId })} disabled={!valid} className="px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold disabled:opacity-40">
                Start scoring
            </button>
        </div>
    );
}
