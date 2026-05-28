import React, { useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CategoryCommonFields, { CommonFieldsValue } from '@/components/CategoryCommonFields';
import { cricketCategoryApi } from '@/sports/cricket/api/cricketCategory';
import type { CategoryFormProps } from '@/sports/_contracts/SportPlugin';

interface CricketFormState extends CommonFieldsValue {
    bracketType: string;
    hybridConfig: { leagueSize: number; topN: number };
    cricketConfig: {
        overs: number;
        maxOversPerBowler: number;
        playersPerTeam: number;
        reservesAllowed: number;
        powerplayOvers: number;
        tieBreaker: string;
    };
}

const initialState: CricketFormState = {
    name: '', description: '', gender: 'male',
    ageGroup: { label: '', min: '', max: '' },
    maxRegistrations: '', isPaidRegistration: false, registrationFee: '',
    bracketType: 'knockout',
    hybridConfig: { leagueSize: 4, topN: 2 },
    cricketConfig: { overs: 20, maxOversPerBowler: 4, playersPerTeam: 11, reservesAllowed: 2, powerplayOvers: 6, tieBreaker: 'super_over' },
};

function fromCategory(c: any): CricketFormState {
    return {
        name: c.name, description: c.description || '', gender: c.gender || 'male',
        ageGroup: { label: c.ageGroup?.label || '', min: c.ageGroup?.min ?? '', max: c.ageGroup?.max ?? '' },
        maxRegistrations: c.maxRegistrations ?? '', isPaidRegistration: c.isPaidRegistration || false,
        registrationFee: c.registrationFee || '',
        bracketType: c.bracketType || 'knockout',
        hybridConfig: { leagueSize: c.hybridConfig?.leagueSize || 4, topN: c.hybridConfig?.topN || 2 },
        cricketConfig: {
            overs: c.cricketConfig?.overs ?? 20,
            maxOversPerBowler: c.cricketConfig?.maxOversPerBowler ?? 4,
            playersPerTeam: c.cricketConfig?.playersPerTeam ?? 11,
            reservesAllowed: c.cricketConfig?.reservesAllowed ?? 2,
            powerplayOvers: c.cricketConfig?.powerplayOvers ?? 6,
            tieBreaker: c.cricketConfig?.tieBreaker || 'super_over',
        },
    };
}

export default function CricketCategoryForm({ tournamentId, category, onSuccess, onCancel }: CategoryFormProps) {
    const isEdit = !!category;
    const [formData, setFormData] = useState<CricketFormState>(category ? fromCategory(category) : initialState);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setField = (patch: Partial<CricketFormState>) => setFormData(prev => ({ ...prev, ...patch }));
    const setCricket = (patch: Partial<CricketFormState['cricketConfig']>) =>
        setFormData(prev => ({ ...prev, cricketConfig: { ...prev.cricketConfig, ...patch } }));
    const numInt = (raw: string, fallback: number) => (raw === '' ? fallback : Number(raw));

    const buildPayload = () => {
        const p: any = JSON.parse(JSON.stringify(formData));
        p.tournamentId = tournamentId;
        if (p.ageGroup.min === '') delete p.ageGroup.min;
        if (p.ageGroup.max === '') delete p.ageGroup.max;
        if (p.bracketType !== 'hybrid') delete p.hybridConfig;
        if (!p.isPaidRegistration) p.registrationFee = 0;
        else if (p.registrationFee === '') delete p.registrationFee;
        if (p.maxRegistrations === '' || p.maxRegistrations === null) delete p.maxRegistrations;
        return p;
    };

    const handleSubmit = async () => {
        if (!formData.name || !formData.ageGroup.label) return;
        setSaving(true);
        setError(null);
        try {
            const payload = buildPayload();
            if (isEdit) await cricketCategoryApi.update((category as any)._id, payload);
            else await cricketCategoryApi.create(payload);
            onSuccess();
        } catch (e: any) {
            setError(e.response?.data?.message || e.message || 'Failed to save category.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-4 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">{isEdit ? 'Edit Category' : 'Create New Category'}</h3>
                <button onClick={onCancel} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>

            {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                <CategoryCommonFields value={formData} onChange={(patch) => setField(patch as Partial<CricketFormState>)} />

                {/* Match Settings (cricket) */}
                <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Match Settings</h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-400">Overs</Label>
                            <Input type="number" min="1" value={formData.cricketConfig.overs} onChange={(e) => setCricket({ overs: numInt(e.target.value, 20) })} className="bg-black/50 border-white/10 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Max Overs / Bowler</Label>
                            <Input type="number" min="1" value={formData.cricketConfig.maxOversPerBowler} onChange={(e) => setCricket({ maxOversPerBowler: numInt(e.target.value, 4) })} className="bg-black/50 border-white/10 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Players / Team</Label>
                            <Input type="number" min="2" value={formData.cricketConfig.playersPerTeam} onChange={(e) => setCricket({ playersPerTeam: numInt(e.target.value, 11) })} className="bg-black/50 border-white/10 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Reserves Allowed</Label>
                            <Input type="number" min="0" value={formData.cricketConfig.reservesAllowed} onChange={(e) => setCricket({ reservesAllowed: numInt(e.target.value, 0) })} className="bg-black/50 border-white/10 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Powerplay Overs</Label>
                            <Input type="number" min="0" value={formData.cricketConfig.powerplayOvers} onChange={(e) => setCricket({ powerplayOvers: numInt(e.target.value, 6) })} className="bg-black/50 border-white/10 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Tie Breaker</Label>
                            <select value={formData.cricketConfig.tieBreaker} onChange={(e) => setCricket({ tieBreaker: e.target.value })} className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
                                <option value="super_over">Super Over</option>
                                <option value="bowl_out">Bowl Out</option>
                                <option value="shared">Shared</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Bracket Settings (cricket: no team_league) */}
                <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                    <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Bracket Settings</h4>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-gray-400">Bracket Type *</Label>
                            <select value={formData.bracketType} onChange={(e) => setField({ bracketType: e.target.value })} className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
                                <option value="knockout">Knockout</option>
                                <option value="league">League</option>
                                <option value="hybrid">Hybrid (Group + Knockout)</option>
                            </select>
                        </div>
                        {formData.bracketType === 'hybrid' && (
                            <div className="grid grid-cols-2 gap-4 animate-in fade-in">
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Group Size</Label>
                                    <Input type="number" min="2" value={formData.hybridConfig.leagueSize} onChange={(e) => setField({ hybridConfig: { ...formData.hybridConfig, leagueSize: numInt(e.target.value, 4) } })} className="bg-black/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Qualifiers / Group</Label>
                                    <Input type="number" min="1" value={formData.hybridConfig.topN} onChange={(e) => setField({ hybridConfig: { ...formData.hybridConfig, topN: numInt(e.target.value, 2) } })} className="bg-black/50 border-white/10 text-white" />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-end mt-6 gap-3 pt-4 border-t border-white/10">
                <button onClick={onCancel} className="px-5 py-2 rounded-full border border-white/10 text-white font-medium hover:bg-white/5 transition-colors">Cancel</button>
                <button onClick={handleSubmit} disabled={saving || !formData.name || !formData.ageGroup.label} className="flex items-center gap-2 px-6 py-2 rounded-full bg-primary hover:bg-primary/90 text-white font-medium disabled:opacity-50">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    {isEdit ? 'Save Changes' : 'Create Category'}
                </button>
            </div>
        </div>
    );
}
