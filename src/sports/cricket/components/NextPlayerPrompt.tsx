import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import type { PlayerSlot } from '@/sports/cricket/lib/lineup';

interface Props {
    title: string;
    candidates: PlayerSlot[];
    onSelect: (registrationId: string) => void;
}

export default function NextPlayerPrompt({ title, candidates, onSelect }: Props) {
    const [selected, setSelected] = useState('');

    return (
        <div className="sc-card overflow-hidden sc-fadein">
            {/* Header */}
            <div
                className="flex items-center gap-2.5 px-5 py-4 border-b border-white/8"
                style={{ background: 'rgba(245,158,11,.07)' }}
            >
                <UserPlus className="h-4 w-4 text-[#fbbf24] shrink-0" />
                <div>
                    <div className="text-[9px] uppercase tracking-widest text-[#fbbf24]/60 font-bold">Action required</div>
                    <div className="text-sm font-bold text-[#fbbf24]">{title}</div>
                </div>
            </div>

            <div className="p-4 flex flex-col gap-3">
                {candidates.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">No eligible players available.</p>
                ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
                        {candidates.map((p, i) => (
                            <button
                                key={p.registrationId}
                                onClick={() => setSelected(p.registrationId)}
                                className="px-3 py-3 rounded-xl text-sm text-left transition-all"
                                style={{
                                    background: selected === p.registrationId ? 'rgba(249,115,22,.15)' : 'rgba(255,255,255,.04)',
                                    border:     `1.5px solid ${selected === p.registrationId ? 'rgba(249,115,22,.4)' : 'rgba(255,255,255,.07)'}`,
                                    color:      selected === p.registrationId ? '#F97316' : '#d1d5db',
                                    animationDelay: `${i * 0.03}s`,
                                }}
                            >
                                <span className="text-[10px] text-gray-600 font-bold mr-1.5">{i + 1}</span>
                                {p.name}
                            </button>
                        ))}
                    </div>
                )}

                <button
                    onClick={() => selected && onSelect(selected)}
                    disabled={!selected}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                    style={{
                        background: selected ? '#F97316' : 'rgba(249,115,22,.1)',
                        color:      selected ? '#fff'    : '#6b7280',
                        border:     'none',
                        cursor:     selected ? 'pointer' : 'not-allowed',
                        opacity:    selected ? 1         : 0.5,
                    }}
                >
                    Confirm Selection
                </button>
            </div>
        </div>
    );
}
