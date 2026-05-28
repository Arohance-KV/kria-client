import React, { useState } from 'react';
import { Loader2, Save, X, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { createCategory, updateCategory } from '@/store/slices/categorySlice';
import CategoryCommonFields, { CommonFieldsValue } from '@/components/CategoryCommonFields';
import type { CategoryFormProps } from '@/sports/_contracts/SportPlugin';

interface BadmintonFormState extends CommonFieldsValue {
    matchType: string;
    matchFormat: { bestOf: number; pointsPerGame: number; tieBreakPoints: number | '' };
    bracketType: string;
    hybridConfig: { leagueSize: number; topN: number };
    teamLeagueConfig: {
        subTeamSlots: { slotNumber: number; matchType: string; label: string }[];
        numberOfGroups: number;
        topNPerGroup: number;
        pointsForWin: number;
        pointsForLoss: number;
        pointsForDraw: number;
    };
}

const initialState: BadmintonFormState = {
    name: '', description: '', gender: 'male',
    ageGroup: { label: '', min: '', max: '' },
    maxRegistrations: '', isPaidRegistration: false, registrationFee: '',
    matchType: 'singles',
    matchFormat: { bestOf: 3, pointsPerGame: 21, tieBreakPoints: '' },
    bracketType: 'knockout',
    hybridConfig: { leagueSize: 4, topN: 2 },
    teamLeagueConfig: {
        subTeamSlots: [{ slotNumber: 1, matchType: 'singles', label: 'Singles 1' }],
        numberOfGroups: 2, topNPerGroup: 1, pointsForWin: 2, pointsForLoss: 0, pointsForDraw: 1,
    },
};

function fromCategory(c: any): BadmintonFormState {
    return {
        name: c.name, description: c.description || '', gender: c.gender || 'male',
        ageGroup: { label: c.ageGroup?.label || '', min: c.ageGroup?.min ?? '', max: c.ageGroup?.max ?? '' },
        maxRegistrations: c.maxRegistrations ?? '', isPaidRegistration: c.isPaidRegistration || false,
        registrationFee: c.registrationFee || '',
        matchType: c.matchType || 'singles',
        matchFormat: { bestOf: c.matchFormat?.bestOf || 3, pointsPerGame: c.matchFormat?.pointsPerGame || 21, tieBreakPoints: c.matchFormat?.tieBreakPoints ?? '' },
        bracketType: c.bracketType || 'knockout',
        hybridConfig: { leagueSize: c.hybridConfig?.leagueSize || 4, topN: c.hybridConfig?.topN || 2 },
        teamLeagueConfig: {
            subTeamSlots: c.teamLeagueConfig?.subTeamSlots || [{ slotNumber: 1, matchType: 'singles', label: 'Singles 1' }],
            numberOfGroups: c.teamLeagueConfig?.numberOfGroups || 2,
            topNPerGroup: c.teamLeagueConfig?.topNPerGroup || 1,
            pointsForWin: c.teamLeagueConfig?.pointsForWin ?? 2,
            pointsForLoss: c.teamLeagueConfig?.pointsForLoss ?? 0,
            pointsForDraw: c.teamLeagueConfig?.pointsForDraw ?? 1,
        },
    };
}

export default function BadmintonCategoryForm({ tournamentId, category, onSuccess, onCancel }: CategoryFormProps) {
    const dispatch = useAppDispatch();
    const { isLoading } = useAppSelector(state => state.category);
    const isEdit = !!category;
    const [formData, setFormData] = useState<BadmintonFormState>(category ? fromCategory(category) : initialState);

    const setField = (patch: Partial<BadmintonFormState>) => setFormData(prev => ({ ...prev, ...patch }));

    const buildPayload = () => {
        const p: any = JSON.parse(JSON.stringify(formData));
        if (p.ageGroup.min === '') delete p.ageGroup.min;
        if (p.ageGroup.max === '') delete p.ageGroup.max;
        if (p.matchFormat.tieBreakPoints === '') delete p.matchFormat.tieBreakPoints;
        if (p.bracketType !== 'hybrid') delete p.hybridConfig;
        if (p.bracketType !== 'team_league') delete p.teamLeagueConfig;
        if (!p.isPaidRegistration) p.registrationFee = 0;
        else if (p.registrationFee === '') delete p.registrationFee;
        if (p.maxRegistrations === '' || p.maxRegistrations === null) delete p.maxRegistrations;
        return p;
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.ageGroup.label) return;
        const payload = buildPayload();
        const result = isEdit
            ? await dispatch(updateCategory({ id: (category as any)._id, data: payload }))
            : await dispatch(createCategory({ tournamentId, data: payload }));
        const ok = isEdit ? updateCategory.fulfilled.match(result) : createCategory.fulfilled.match(result);
        if (ok) onSuccess();
    };

    return (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{isEdit ? 'Edit Category' : 'Create New Category'}</h3>
                <button onClick={onCancel} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                <CategoryCommonFields
                    value={formData}
                    onChange={(patch) => setField(patch as Partial<BadmintonFormState>)}
                />

                {/* Match Settings */}
                <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">
                        {formData.bracketType === 'team_league' ? 'Sub-Match Settings' : 'Match Settings'}
                    </h4>
                    {formData.bracketType === 'team_league' && (
                        <p className="text-xs text-gray-500 -mt-1">Applies to every sub-match within a tie (each slot uses its own match type defined below).</p>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        {formData.bracketType !== 'team_league' && (
                        <div className="space-y-2 col-span-2">
                            <Label className="text-gray-400">Match Type *</Label>
                            <select value={formData.matchType} onChange={(e) => setField({ matchType: e.target.value })} className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
                                <option value="singles">Singles</option>
                                <option value="doubles">Doubles</option>
                            </select>
                        </div>
                        )}
                        <div className="space-y-2">
                            <Label className="text-gray-400">Best Of</Label>
                            <select value={formData.matchFormat.bestOf} onChange={(e) => setField({ matchFormat: { ...formData.matchFormat, bestOf: Number(e.target.value) } })} className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
                                <option value={1}>1</option>
                                <option value={3}>3</option>
                                <option value={5}>5</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Points Per Game</Label>
                            <Input type="number" min="1" value={formData.matchFormat.pointsPerGame} onChange={(e) => setField({ matchFormat: { ...formData.matchFormat, pointsPerGame: e.target.value === '' ? ('' as any) : Number(e.target.value) } })} className="bg-black/50 border-white/10 text-white" />
                        </div>
                    </div>
                </div>

                {/* Bracket Settings */}
                <div className="space-y-4 md:col-span-2 p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Bracket Settings</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-400">Bracket Type *</Label>
                            <select value={formData.bracketType} onChange={(e) => setField({ bracketType: e.target.value })} className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
                                <option value="knockout">Knockout</option>
                                <option value="league">League</option>
                                <option value="hybrid">Hybrid (Group + Knockout)</option>
                                <option value="team_league">Team League</option>
                            </select>
                        </div>

                        {formData.bracketType === 'hybrid' && (
                            <>
                                <div className="space-y-2 animate-in fade-in">
                                    <Label className="text-gray-400">Group Size</Label>
                                    <Input type="number" min="2" value={formData.hybridConfig.leagueSize} onChange={(e) => setField({ hybridConfig: { ...formData.hybridConfig, leagueSize: e.target.value === '' ? ('' as any) : Number(e.target.value) } })} className="bg-black/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2 animate-in fade-in">
                                    <Label className="text-gray-400">Qualifiers Per Group (Top N)</Label>
                                    <Input type="number" min="1" value={formData.hybridConfig.topN} onChange={(e) => setField({ hybridConfig: { ...formData.hybridConfig, topN: e.target.value === '' ? ('' as any) : Number(e.target.value) } })} className="bg-black/50 border-white/10 text-white" />
                                </div>
                            </>
                        )}
                    </div>

                    {formData.bracketType === 'team_league' && (
                        <div className="mt-4 space-y-4 animate-in fade-in">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Number of Groups</Label>
                                    <Input type="number" min="1" value={formData.teamLeagueConfig.numberOfGroups} onChange={(e) => setField({ teamLeagueConfig: { ...formData.teamLeagueConfig, numberOfGroups: e.target.value === '' ? ('' as any) : Number(e.target.value) } })} className="bg-black/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Top N Per Group</Label>
                                    <Input type="number" min="1" value={formData.teamLeagueConfig.topNPerGroup} onChange={(e) => setField({ teamLeagueConfig: { ...formData.teamLeagueConfig, topNPerGroup: e.target.value === '' ? ('' as any) : Number(e.target.value) } })} className="bg-black/50 border-white/10 text-white" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Points for Win</Label>
                                    <Input type="number" min="0" value={formData.teamLeagueConfig.pointsForWin} onChange={(e) => setField({ teamLeagueConfig: { ...formData.teamLeagueConfig, pointsForWin: e.target.value === '' ? ('' as any) : Number(e.target.value) } })} className="bg-black/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Points for Loss</Label>
                                    <Input type="number" min="0" value={formData.teamLeagueConfig.pointsForLoss} onChange={(e) => setField({ teamLeagueConfig: { ...formData.teamLeagueConfig, pointsForLoss: e.target.value === '' ? ('' as any) : Number(e.target.value) } })} className="bg-black/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Points for Draw</Label>
                                    <Input type="number" min="0" value={formData.teamLeagueConfig.pointsForDraw} onChange={(e) => setField({ teamLeagueConfig: { ...formData.teamLeagueConfig, pointsForDraw: e.target.value === '' ? ('' as any) : Number(e.target.value) } })} className="bg-black/50 border-white/10 text-white" />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-gray-400">Sub-Team Slots (Match Template)</Label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const slots = [...formData.teamLeagueConfig.subTeamSlots];
                                            slots.push({ slotNumber: slots.length + 1, matchType: 'singles', label: `Singles ${slots.length + 1}` });
                                            setFormData(prev => ({ ...prev, teamLeagueConfig: { ...prev.teamLeagueConfig, subTeamSlots: slots } }));
                                        }}
                                        className="flex items-center gap-1 px-3 py-1 text-xs bg-primary/20 text-primary hover:bg-primary/30 rounded-full"
                                    >
                                        <Plus className="h-3 w-3" /> Add Slot
                                    </button>
                                </div>
                                {formData.teamLeagueConfig.subTeamSlots.map((slot: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 p-3 bg-black/30 rounded-lg border border-white/5">
                                        <span className="text-xs text-gray-500 font-mono w-6">#{slot.slotNumber}</span>
                                        <select
                                            value={slot.matchType}
                                            onChange={(e) => {
                                                const slots = [...formData.teamLeagueConfig.subTeamSlots];
                                                const mt = e.target.value;
                                                const defaultLabel = mt === 'singles' ? `Singles ${idx + 1}` : mt === 'doubles' ? `Doubles ${idx + 1}` : `Mixed Doubles ${idx + 1}`;
                                                slots[idx] = { ...slots[idx], matchType: mt, label: defaultLabel };
                                                setFormData(prev => ({ ...prev, teamLeagueConfig: { ...prev.teamLeagueConfig, subTeamSlots: slots } }));
                                            }}
                                            className="flex h-9 rounded-md border border-white/10 bg-black/50 px-2 py-1 text-sm text-white flex-1"
                                        >
                                            <option value="singles">Singles</option>
                                            <option value="doubles">Doubles</option>
                                            <option value="mixed_doubles">Mixed Doubles</option>
                                        </select>
                                        <Input
                                            value={slot.label}
                                            onChange={(e) => {
                                                const slots = [...formData.teamLeagueConfig.subTeamSlots];
                                                slots[idx] = { ...slots[idx], label: e.target.value };
                                                setFormData(prev => ({ ...prev, teamLeagueConfig: { ...prev.teamLeagueConfig, subTeamSlots: slots } }));
                                            }}
                                            placeholder="Label"
                                            className="bg-black/50 border-white/10 text-white flex-1 h-9"
                                        />
                                        {formData.teamLeagueConfig.subTeamSlots.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const slots = formData.teamLeagueConfig.subTeamSlots.filter((_: any, i: number) => i !== idx).map((s: any, i: number) => ({ ...s, slotNumber: i + 1 }));
                                                    setFormData(prev => ({ ...prev, teamLeagueConfig: { ...prev.teamLeagueConfig, subTeamSlots: slots } }));
                                                }}
                                                className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end mt-6 gap-3 pt-4 border-t border-white/10">
                <button onClick={onCancel} className="px-5 py-2 rounded-full border border-white/10 text-white font-medium hover:bg-white/5 transition-colors">Cancel</button>
                <button
                    onClick={handleSubmit}
                    disabled={isLoading || !formData.name || !formData.ageGroup.label}
                    className="flex items-center gap-2 px-6 py-2 rounded-full bg-primary hover:bg-primary/90 text-white font-medium disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Save Changes' : 'Create Category'}
                </button>
            </div>
        </div>
    );
}
