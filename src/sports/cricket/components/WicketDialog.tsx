import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { PlayerSlot } from '@/sports/cricket/lib/lineup';

export interface WicketResult {
    wicketType: 'bowled' | 'caught' | 'lbw' | 'run_out' | 'stumped' | 'hit_wicket' | 'retired_hurt';
    dismissedPlayerId: string;
    fielderId?: string;
    runs: number;
}

interface Props {
    strikerId: string;
    nonStrikerId: string;
    nameOf: (id: string) => string;
    fieldingXI: PlayerSlot[];
    onConfirm: (r: WicketResult) => void;
    onCancel: () => void;
}

const TYPES: Array<{ value: WicketResult['wicketType']; label: string }> = [
    { value: 'bowled',        label: 'Bowled'       },
    { value: 'caught',        label: 'Caught'       },
    { value: 'lbw',           label: 'LBW'          },
    { value: 'run_out',       label: 'Run Out'      },
    { value: 'stumped',       label: 'Stumped'      },
    { value: 'hit_wicket',    label: 'Hit Wicket'   },
    { value: 'retired_hurt',  label: 'Retired Hurt' },
];

const NEEDS_FIELDER = new Set<WicketResult['wicketType']>(['caught', 'run_out', 'stumped']);

export default function WicketDialog({ strikerId, nonStrikerId, nameOf, fieldingXI, onConfirm, onCancel }: Props) {
    const [wicketType,         setWicketType]         = useState<WicketResult['wicketType']>('bowled');
    const [dismissedPlayerId,  setDismissedPlayerId]  = useState(strikerId);
    const [fielderId,          setFielderId]          = useState('');
    const [runs,               setRuns]               = useState(0);

    const needsFielder = NEEDS_FIELDER.has(wicketType);
    const canConfirm   = !needsFielder || fielderId !== '';

    return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div
                className="w-full max-w-md flex flex-col gap-4 rounded-2xl overflow-hidden font-montserrat"
                style={{ background: '#0c1526', border: '1px solid rgba(255,255,255,.09)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/8"
                    style={{ background: 'rgba(220,38,38,.08)' }}>
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <h3 className="text-base font-bold text-white">Wicket</h3>
                    </div>
                    <button onClick={onCancel} className="text-gray-500 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="px-5 pb-5 flex flex-col gap-4">

                    {/* How out */}
                    <div>
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">How out?</div>
                        <div className="grid grid-cols-4 gap-1.5">
                            {TYPES.map(t => (
                                <button
                                    key={t.value}
                                    onClick={() => { setWicketType(t.value); setFielderId(''); }}
                                    className="py-2 rounded-xl text-xs font-semibold transition-all"
                                    style={{
                                        background: wicketType === t.value ? '#dc2626' : 'rgba(255,255,255,.05)',
                                        color:      wicketType === t.value ? '#fff'    : '#9ca3af',
                                        border:     `1.5px solid ${wicketType === t.value ? '#dc2626' : 'rgba(255,255,255,.07)'}`,
                                    }}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Batsman out */}
                    <div>
                        <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">Batsman out</div>
                        <div className="grid grid-cols-2 gap-2">
                            {[strikerId, nonStrikerId].map(id => (
                                <button
                                    key={id}
                                    onClick={() => setDismissedPlayerId(id)}
                                    className="px-3 py-3 rounded-xl text-sm font-semibold text-left transition-all"
                                    style={{
                                        background: dismissedPlayerId === id ? 'rgba(249,115,22,.15)' : 'rgba(255,255,255,.04)',
                                        border:     `1.5px solid ${dismissedPlayerId === id ? 'rgba(249,115,22,.4)' : 'rgba(255,255,255,.07)'}`,
                                        color:      dismissedPlayerId === id ? '#F97316' : '#d1d5db',
                                    }}
                                >
                                    {nameOf(id)}
                                    {id === strikerId && <span className="text-[10px] text-gray-500 block font-normal">On strike ★</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fielder (for caught / run_out / stumped) */}
                    {needsFielder && (
                        <div>
                            <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">Fielder</div>
                            <select
                                value={fielderId}
                                onChange={e => setFielderId(e.target.value)}
                                className="w-full h-10 rounded-xl px-3 text-sm text-white"
                                style={{ background: '#111d33', border: '1.5px solid rgba(255,255,255,.09)', outline: 'none' }}
                            >
                                <option value="">— select fielder —</option>
                                {fieldingXI.map(p => (
                                    <option key={p.registrationId} value={p.registrationId}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Run-out runs */}
                    {wicketType === 'run_out' && (
                        <div>
                            <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">
                                Runs completed before run-out
                            </div>
                            <div className="flex gap-2">
                                {[0, 1, 2, 3].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => setRuns(r)}
                                        className="w-12 h-10 rounded-xl text-sm font-bold transition-all"
                                        style={{
                                            background: runs === r ? 'rgba(249,115,22,.15)' : 'rgba(255,255,255,.05)',
                                            border:     `1.5px solid ${runs === r ? 'rgba(249,115,22,.4)' : 'rgba(255,255,255,.07)'}`,
                                            color:      runs === r ? '#F97316' : '#9ca3af',
                                        }}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Confirm */}
                    <button
                        disabled={!canConfirm}
                        onClick={() => onConfirm({ wicketType, dismissedPlayerId, fielderId: fielderId || undefined, runs })}
                        className="w-full py-3.5 rounded-xl font-oswald font-bold text-base tracking-wider transition-all disabled:opacity-40"
                        style={{ background: canConfirm ? '#dc2626' : '#7f1d1d', color: '#fff', border: 'none', cursor: canConfirm ? 'pointer' : 'not-allowed' }}
                    >
                        Confirm Wicket
                    </button>
                </div>
            </div>
        </div>
    );
}
