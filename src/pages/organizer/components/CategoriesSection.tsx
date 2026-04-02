import React, { useEffect, useState } from 'react';
import { Layers, Plus, Trash2, Edit2, Loader2, Save, X, DoorOpen, Lock, Gavel, Play, CheckCircle, Trophy, IndianRupee } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
    fetchTournamentCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    openCategoryRegistration,
    startCategoryAuction,
    startCategory,
    completeCategory,
} from '../../../store/slices/categorySlice';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CategoryAnalyticsModal from './CategoryAnalyticsModal';

const statusColors: Record<string, { bg: string; text: string; border: string; label: string }> = {
    setup: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30', label: 'Setup' },
    registration: { bg: 'bg-green-500/10', text: 'text-green-500', border: 'border-green-500/30', label: 'Registration Open' },
    auction: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/30', label: 'Auctioning' },
    groups_configured: { bg: 'bg-teal-500/10', text: 'text-teal-500', border: 'border-teal-500/30', label: 'Groups Configured' },
    bracket_configured: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/30', label: 'Bracket Generated' },
    ongoing: { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30', label: 'Ongoing' },
    completed: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/30', label: 'Completed' },
};

export default function CategoriesSection({ tournamentId }: { tournamentId: string }) {
    const dispatch = useAppDispatch();
    const { categories, isLoading } = useAppSelector(state => state.category);

    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Analytics state
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
    const [analyticsCategory, setAnalyticsCategory] = useState<any>(null);

    const initialFormState = {
        name: '', description: '', gender: 'male',
        ageGroup: { label: '', min: '', max: '' },
        matchType: 'singles',
        matchFormat: { bestOf: 3, pointsPerGame: 21, tieBreakPoints: '' },
        bracketType: 'knockout',
        hybridConfig: { leagueSize: 4, topN: 2 },
        teamLeagueConfig: {
            subTeamSlots: [{ slotNumber: 1, matchType: 'singles', label: 'Singles 1' }],
            numberOfGroups: 2,
            topNPerGroup: 1,
            pointsForWin: 2,
            pointsForLoss: 0,
            pointsForDraw: 1,
        },
        isPaidRegistration: false,
        registrationFee: '',
        maxRegistrations: '',
    };

    const [formData, setFormData] = useState(initialFormState);

    useEffect(() => {
        if (tournamentId) {
            dispatch(fetchTournamentCategories(tournamentId));
        }
    }, [tournamentId, dispatch]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let parsed: any = value;
        if (type === 'number') {
            parsed = value === '' ? '' : Number(value);
        }

        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...(prev as any)[parent],
                    [child]: parsed
                }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: parsed }));
        }
    };

    const resetForm = () => {
        setFormData(initialFormState);
        setIsCreating(false);
        setEditingId(null);
    };

    const buildPayload = () => {
        const payload: any = JSON.parse(JSON.stringify(formData));

        // Clean up ageGroup
        if (payload.ageGroup.min === '') delete payload.ageGroup.min;
        if (payload.ageGroup.max === '') delete payload.ageGroup.max;

        // Clean up matchFormat
        if (payload.matchFormat.tieBreakPoints === '') delete payload.matchFormat.tieBreakPoints;

        // Clean up hybrid config
        if (payload.bracketType !== 'hybrid') {
            delete payload.hybridConfig;
        }

        // Clean up team league config
        if (payload.bracketType !== 'team_league') {
            delete payload.teamLeagueConfig;
        }

        // Clean up registration fee
        if (!payload.isPaidRegistration) {
            payload.registrationFee = 0;
        } else if (payload.registrationFee === '') {
            delete payload.registrationFee;
        }

        // Clean up maxRegistrations
        if (payload.maxRegistrations === '' || payload.maxRegistrations === null) {
            delete payload.maxRegistrations;
        }

        return payload;
    };

    const handleCreate = async () => {
        if (!formData.name || !formData.ageGroup.label) return;

        const payload = buildPayload();

        const result = await dispatch(createCategory({ tournamentId, data: payload }));
        if (createCategory.fulfilled.match(result)) {
            resetForm();
        }
    };

    const handleUpdate = async (id: string) => {
        if (!formData.name || !formData.ageGroup.label) return;

        const payload = buildPayload();

        const result = await dispatch(updateCategory({ id, data: payload }));
        if (updateCategory.fulfilled.match(result)) {
            resetForm();
        }
    };

    const openEdit = (category: any) => {
        setFormData({
            name: category.name,
            description: category.description || '',
            gender: category.gender || 'male',
            ageGroup: {
                label: category.ageGroup?.label || '',
                min: category.ageGroup?.min ?? '',
                max: category.ageGroup?.max ?? ''
            },
            matchType: category.matchType || 'singles',
            matchFormat: {
                bestOf: category.matchFormat?.bestOf || 3,
                pointsPerGame: category.matchFormat?.pointsPerGame || 21,
                tieBreakPoints: category.matchFormat?.tieBreakPoints ?? ''
            },
            bracketType: category.bracketType || 'knockout',
            hybridConfig: {
                leagueSize: category.hybridConfig?.leagueSize || 4,
                topN: category.hybridConfig?.topN || 2
            },
            teamLeagueConfig: {
                subTeamSlots: category.teamLeagueConfig?.subTeamSlots || [{ slotNumber: 1, matchType: 'singles', label: 'Singles 1' }],
                numberOfGroups: category.teamLeagueConfig?.numberOfGroups || 2,
                topNPerGroup: category.teamLeagueConfig?.topNPerGroup || 1,
                pointsForWin: category.teamLeagueConfig?.pointsForWin ?? 2,
                pointsForLoss: category.teamLeagueConfig?.pointsForLoss ?? 0,
                pointsForDraw: category.teamLeagueConfig?.pointsForDraw ?? 1,
            },
            isPaidRegistration: category.isPaidRegistration || false,
            registrationFee: category.registrationFee || '',
            maxRegistrations: category.maxRegistrations ?? '',
        });
        setEditingId(category._id);
        setIsCreating(false);
    };

    const openAnalytics = (category: any) => {
        setAnalyticsCategory(category);
        setIsAnalyticsOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this category?')) {
            await dispatch(deleteCategory(id));
        }
    };

    const handleStatusAction = async (id: string, action: any, extra?: any) => {
        await dispatch(action(extra ?? id));
    };

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Layers className="h-5 w-5" />
                    </div>
                    <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Categories</h2>
                </div>
                {!isCreating && !editingId && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-full font-medium text-sm transition-colors w-fit"
                    >
                        <Plus className="h-4 w-4" /> Add Category
                    </button>
                )}
            </div>

            {/* Form for Create/Edit */}
            {(isCreating || editingId) && (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-6 mb-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">{isCreating ? 'Create New Category' : 'Edit Category'}</h3>
                        <button onClick={resetForm} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                        {/* Basic Info */}
                        <div className="space-y-4 md:col-span-2 p-4 bg-white/5 border border-white/10 rounded-xl">
                            <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Basic Info</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Category Name *</Label>
                                    <Input name="name" value={formData.name} onChange={handleInputChange} placeholder="e.g. Men's Singles Open" className="bg-black/50 border-white/10 text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Gender *</Label>
                                    <select name="gender" value={formData.gender} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="mixed">Mixed</option>
                                    </select>
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <Label className="text-gray-400">Description</Label>
                                    <textarea name="description" value={formData.description} onChange={handleInputChange} className="flex min-h-[60px] w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Age Group */}
                        <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                            <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Age Group</h4>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Age Group Label *</Label>
                                    <Input name="ageGroup.label" value={formData.ageGroup.label} onChange={handleInputChange} placeholder="e.g. Under 19, Seniors" className="bg-black/50 border-white/10 text-white" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-gray-400">Min Age</Label>
                                        <Input name="ageGroup.min" type="number" min="0" placeholder="Optional" value={formData.ageGroup.min} onChange={handleInputChange} className="bg-black/50 border-white/10 text-white" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-gray-400">Max Age</Label>
                                        <Input name="ageGroup.max" type="number" min="0" placeholder="Optional" value={formData.ageGroup.max} onChange={handleInputChange} className="bg-black/50 border-white/10 text-white" />
                                    </div>
                                </div>
                            </div>
                        </div>

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
                                    <select name="matchType" value={formData.matchType} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
                                        <option value="singles">Singles</option>
                                        <option value="doubles">Doubles</option>
                                    </select>
                                </div>
                                )}
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Best Of</Label>
                                    <select name="matchFormat.bestOf" value={formData.matchFormat.bestOf} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
                                        <option value={1}>1</option>
                                        <option value={3}>3</option>
                                        <option value={5}>5</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Points Per Game</Label>
                                    <Input name="matchFormat.pointsPerGame" type="number" min="1" value={formData.matchFormat.pointsPerGame} onChange={handleInputChange} className="bg-black/50 border-white/10 text-white" />
                                </div>
                            </div>
                        </div>

                        {/* Bracket Settings */}
                        <div className="space-y-4 md:col-span-2 p-4 bg-white/5 border border-white/10 rounded-xl">
                            <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Bracket Settings</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-400">Bracket Type *</Label>
                                    <select name="bracketType" value={formData.bracketType} onChange={handleInputChange} className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
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
                                            <Input name="hybridConfig.leagueSize" type="number" min="2" value={formData.hybridConfig.leagueSize} onChange={handleInputChange} className="bg-black/50 border-white/10 text-white" />
                                        </div>
                                        <div className="space-y-2 animate-in fade-in">
                                            <Label className="text-gray-400">Qualifiers Per Group (Top N)</Label>
                                            <Input name="hybridConfig.topN" type="number" min="1" value={formData.hybridConfig.topN} onChange={handleInputChange} className="bg-black/50 border-white/10 text-white" />
                                        </div>
                                    </>
                                )}
                            </div>

                            {formData.bracketType === 'team_league' && (
                                <div className="mt-4 space-y-4 animate-in fade-in">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-gray-400">Number of Groups</Label>
                                            <Input name="teamLeagueConfig.numberOfGroups" type="number" min="1" value={formData.teamLeagueConfig.numberOfGroups} onChange={handleInputChange} className="bg-black/50 border-white/10 text-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-400">Top N Per Group</Label>
                                            <Input name="teamLeagueConfig.topNPerGroup" type="number" min="1" value={formData.teamLeagueConfig.topNPerGroup} onChange={handleInputChange} className="bg-black/50 border-white/10 text-white" />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-gray-400">Points for Win</Label>
                                            <Input name="teamLeagueConfig.pointsForWin" type="number" min="0" value={formData.teamLeagueConfig.pointsForWin} onChange={handleInputChange} className="bg-black/50 border-white/10 text-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-400">Points for Loss</Label>
                                            <Input name="teamLeagueConfig.pointsForLoss" type="number" min="0" value={formData.teamLeagueConfig.pointsForLoss} onChange={handleInputChange} className="bg-black/50 border-white/10 text-white" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-gray-400">Points for Draw</Label>
                                            <Input name="teamLeagueConfig.pointsForDraw" type="number" min="0" value={formData.teamLeagueConfig.pointsForDraw} onChange={handleInputChange} className="bg-black/50 border-white/10 text-white" />
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

                        {/* Registration Limits */}
                        <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                            <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Registration Limit</h4>
                            <div className="space-y-2">
                                <Label className="text-gray-400">Max Registrations (optional)</Label>
                                <Input
                                    name="maxRegistrations"
                                    type="number"
                                    min="1"
                                    placeholder="Unlimited"
                                    value={formData.maxRegistrations}
                                    onChange={handleInputChange}
                                    className="bg-black/50 border-white/10 text-white"
                                />
                                <p className="text-xs text-gray-500">Leave empty for unlimited registrations.</p>
                            </div>
                        </div>

                        {/* Registration Fee */}
                        <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                            <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Registration Fee</h4>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-3 cursor-pointer select-none">
                                    <div
                                        onClick={() => setFormData(prev => ({ ...prev, isPaidRegistration: !prev.isPaidRegistration, registrationFee: !prev.isPaidRegistration ? prev.registrationFee : '' }))}
                                        className={`relative w-11 h-6 rounded-full transition-colors ${formData.isPaidRegistration ? 'bg-primary' : 'bg-white/20'}`}
                                    >
                                        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${formData.isPaidRegistration ? 'translate-x-5' : ''}`} />
                                    </div>
                                    <span className="text-gray-300 text-sm font-medium">
                                        {formData.isPaidRegistration ? 'Paid Registration' : 'Free Registration'}
                                    </span>
                                </label>
                            </div>
                            {formData.isPaidRegistration && (
                                <div className="space-y-2 max-w-xs animate-in fade-in">
                                    <Label className="text-gray-400">Fee Amount (₹) *</Label>
                                    <div className="relative">
                                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                        <Input
                                            name="registrationFee"
                                            type="number"
                                            min="1"
                                            placeholder="e.g. 500"
                                            value={formData.registrationFee}
                                            onChange={handleInputChange}
                                            className="bg-black/50 border-white/10 text-white pl-9"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex justify-end mt-6 gap-3 pt-4 border-t border-white/10">
                        <button onClick={resetForm} className="px-5 py-2 rounded-full border border-white/10 text-white font-medium hover:bg-white/5 transition-colors">Cancel</button>
                        <button
                            onClick={isCreating ? handleCreate : () => handleUpdate(editingId!)}
                            disabled={isLoading || !formData.name || !formData.ageGroup.label}
                            className="flex items-center gap-2 px-6 py-2 rounded-full bg-primary hover:bg-primary/90 text-white font-medium disabled:opacity-50"
                        >
                            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isCreating ? 'Create Category' : 'Save Changes'}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {isLoading && categories.length === 0 ? (
                <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : categories.length === 0 ? (
                <div className="text-center p-8 border border-white/5 rounded-xl bg-black/20">
                    <Layers className="h-10 w-10 text-gray-500 mx-auto mb-3 opacity-50" />
                    <p className="text-gray-400 font-medium">No categories added yet.</p>
                    <p className="text-sm text-gray-500 mt-1">Create categories to allow players to register.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories.map((category: any) => {
                        const status = statusColors[category.status] || statusColors.setup;
                        return (
                            <div key={category._id} className="bg-black/40 border border-white/10 rounded-xl p-5 hover:border-primary/50 transition-colors flex flex-col h-full">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-white leading-tight flex items-center gap-2">
                                            {category.name}
                                        </h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                            <span className="capitalize">{category.gender}</span>
                                            <span>•</span>
                                            <span className="capitalize">{category.matchType}</span>
                                            <span>•</span>
                                            <span className="capitalize">{category.bracketType === 'team_league' ? 'Team League' : category.bracketType}</span>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded border ${status.bg} ${status.text} ${status.border} whitespace-nowrap ml-2`}>
                                        {status.label}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-y-3 text-sm text-gray-400 mb-5 p-3 bg-white/5 rounded-lg flex-grow">
                                    <div>
                                        <span className="block text-xs uppercase opacity-70 mb-1">Age Group</span>
                                        <span className="text-white font-medium">{category.ageGroup?.label}</span>
                                        {(category.ageGroup?.min || category.ageGroup?.max) && (
                                            <span className="text-xs ml-1 text-gray-400">
                                                ({category.ageGroup.min || '0'} - {category.ageGroup.max || '∞'})
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <span className="block text-xs uppercase opacity-70 mb-1">Match Format</span>
                                        <span className="text-white font-medium">BO{category.matchFormat?.bestOf}, {category.matchFormat?.pointsPerGame} pts</span>
                                    </div>
                                    <div>
                                        <span className="block text-xs uppercase opacity-70 mb-1">Reg. Fee</span>
                                        <span className={`font-medium ${category.isPaidRegistration ? 'text-primary' : 'text-emerald-400'}`}>
                                            {category.isPaidRegistration ? `₹${category.registrationFee}` : 'Free'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-xs uppercase opacity-70 mb-1">Max Slots</span>
                                        <span className="text-white font-medium">
                                            {category.maxRegistrations ? category.maxRegistrations : 'Unlimited'}
                                        </span>
                                    </div>
                                </div>

                                {/* Status actions and management */}
                                <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2 justify-between items-center mt-auto">
                                    <div className="flex gap-2">
                                        {category.status === 'setup' && <button onClick={() => handleStatusAction(category._id, openCategoryRegistration)} className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded tooltip-trigger" title="Open Reg"><DoorOpen className="h-4 w-4" /></button>}
                                        {/* Simplified transition actions for UI purposes */}
                                        {category.status === 'registration' && <button onClick={() => handleStatusAction(category._id, startCategoryAuction, { id: category._id, tournamentId })} className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded" title="Start Auction"><Gavel className="h-4 w-4" /></button>}
                                        {category.status === 'auction' && <button onClick={() => handleStatusAction(category._id, startCategory)} className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded" title="Start Playing"><Play className="h-4 w-4" /></button>}
                                        {category.status === 'ongoing' && <button onClick={() => handleStatusAction(category._id, completeCategory)} className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded" title="Complete"><CheckCircle className="h-4 w-4" /></button>}
                                        {category.status === 'groups_configured' && category.bracketType === 'team_league' && <button onClick={() => handleStatusAction(category._id, completeCategory)} className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded" title="Complete"><CheckCircle className="h-4 w-4" /></button>}
                                        {(category.status === 'completed' || (category.status === 'groups_configured' && category.bracketType === 'team_league')) && <button onClick={() => openAnalytics(category)} className="p-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 rounded tooltip-trigger flex items-center gap-1.5" title="Analytics & Awards"><Trophy className="h-4 w-4" /> <span className="text-xs font-semibold uppercase pr-1">Awards</span></button>}
                                    </div>

                                    <div className="flex gap-2">
                                        <button onClick={() => openEdit(category)} className="p-2 text-primary hover:text-white hover:bg-primary/20 rounded transition-colors"><Edit2 className="h-4 w-4" /></button>
                                        <button onClick={() => handleDelete(category._id)} className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <CategoryAnalyticsModal 
                isOpen={isAnalyticsOpen} 
                onClose={() => setIsAnalyticsOpen(false)} 
                category={analyticsCategory} 
                tournamentId={tournamentId} 
            />
        </section>
    );
}
