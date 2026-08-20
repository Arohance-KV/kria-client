import React, { useEffect, useState } from 'react';
import { Layers, Plus, Trash2, Edit2, Loader2, DoorOpen, Gavel, Play, CheckCircle, Trophy } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
    fetchTournamentCategories,
    deleteCategory,
    openCategoryRegistration,
    startCategoryAuction,
    startCategory,
    completeCategory,
} from '../../../store/slices/categorySlice';
import { sportRegistry } from '@/sports/registry';
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

interface Props {
    tournamentId: string;
    sports: string[];
}

export default function CategoriesSection({ tournamentId, sports }: Props) {
    const dispatch = useAppDispatch();
    const { categories, isLoading } = useAppSelector(state => state.category);

    const [isCreating, setIsCreating] = useState(false);
    const [editingCategory, setEditingCategory] = useState<any | null>(null);
    const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
    const [analyticsCategory, setAnalyticsCategory] = useState<any>(null);
    const [selectedSport, setSelectedSport] = useState(sports[0]);

    // Keep selectedSport valid if the tournament's sport list changes.
    useEffect(() => {
        if (sports.length > 0 && !sports.includes(selectedSport)) {
            setSelectedSport(sports[0]);
        }
    }, [sports, selectedSport]);

    const plugin = sportRegistry.get(selectedSport);
    const CategoryForm = plugin?.categoryForm;

    useEffect(() => {
        if (tournamentId) dispatch(fetchTournamentCategories(tournamentId));
    }, [tournamentId, dispatch]);

    const closeForm = () => { setIsCreating(false); setEditingCategory(null); };
    const onFormSuccess = () => { dispatch(fetchTournamentCategories(tournamentId)); closeForm(); };

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this category?')) await dispatch(deleteCategory(id));
    };
    const handleStatusAction = async (id: string, action: any, extra?: any) => { await dispatch(action(extra ?? id)); };
    const openAnalytics = (category: any) => { setAnalyticsCategory(category); setIsAnalyticsOpen(true); };

    const showForm = isCreating || !!editingCategory;

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Layers className="h-5 w-5" /></div>
                    <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Categories</h2>
                </div>
                {!showForm && CategoryForm && (
                    <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-full font-medium text-sm transition-colors w-fit">
                        <Plus className="h-4 w-4" /> Add Category
                    </button>
                )}
                {!showForm && !CategoryForm && (
                    <span className="text-xs text-gray-500">Category creation for "{selectedSport}" is not available.</span>
                )}
            </div>

            {showForm && (() => {
                // Editing an existing category uses that category's own sport plugin;
                // creating a new one uses the sport picked below (selectedSport).
                const ActiveCategoryForm = editingCategory
                    ? sportRegistry.get(editingCategory.sport)?.categoryForm
                    : CategoryForm;
                if (!ActiveCategoryForm) return null;
                return (
                    <div className="flex flex-col gap-4">
                        {sports.length > 1 && !editingCategory && (
                            <select
                                className="flex h-10 rounded-lg border border-white/10 bg-black/40 px-3 text-sm text-white capitalize w-fit"
                                value={selectedSport}
                                onChange={(e) => setSelectedSport(e.target.value)}
                            >
                                {sports.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                            </select>
                        )}
                        <ActiveCategoryForm
                            tournamentId={tournamentId}
                            category={editingCategory}
                            onSuccess={onFormSuccess}
                            onCancel={closeForm}
                            sport={editingCategory ? (editingCategory as any).sport : selectedSport}
                        />
                    </div>
                );
            })()}

            {isLoading && categories.length === 0 ? (
                <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
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
                                        <h3 className="text-lg font-bold text-white leading-tight">{category.name}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                            <span className="capitalize">{category.gender}</span>
                                            <span>•</span>
                                            <span className="capitalize">{category.bracketType === 'team_league' ? 'Team League' : category.bracketType}</span>
                                        </div>
                                    </div>
                                    <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded border ${status.bg} ${status.text} ${status.border} whitespace-nowrap ml-2`}>{status.label}</span>
                                </div>

                                <div className="grid grid-cols-2 gap-y-3 text-sm text-gray-400 mb-5 p-3 bg-white/5 rounded-lg flex-grow">
                                    <div>
                                        <span className="block text-xs uppercase opacity-70 mb-1">Age Group</span>
                                        <span className="text-white font-medium">{category.ageGroup?.label}</span>
                                        {(category.ageGroup?.min || category.ageGroup?.max) && (
                                            <span className="text-xs ml-1 text-gray-400">({category.ageGroup.min || '0'} - {category.ageGroup.max || '∞'})</span>
                                        )}
                                    </div>
                                    <div>
                                        <span className="block text-xs uppercase opacity-70 mb-1">Reg. Fee</span>
                                        <span className={`font-medium ${category.isPaidRegistration ? 'text-primary' : 'text-emerald-400'}`}>
                                            {category.isPaidRegistration ? `₹${category.registrationFee}` : 'Free'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-xs uppercase opacity-70 mb-1">Max Slots</span>
                                        <span className="text-white font-medium">{category.maxRegistrations ? category.maxRegistrations : 'Unlimited'}</span>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-white/10 flex flex-wrap gap-2 justify-between items-center mt-auto">
                                    <div className="flex gap-2">
                                        {category.status === 'setup' && <button onClick={() => handleStatusAction(category._id, openCategoryRegistration)} className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded" title="Open Reg"><DoorOpen className="h-4 w-4" /></button>}
                                        {category.status === 'registration' && <button onClick={() => handleStatusAction(category._id, startCategoryAuction, { id: category._id, tournamentId })} className="p-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded" title="Start Auction"><Gavel className="h-4 w-4" /></button>}
                                        {category.status === 'auction' && <button onClick={() => handleStatusAction(category._id, startCategory)} className="p-2 bg-primary/10 text-primary hover:bg-primary/20 rounded" title="Start Playing"><Play className="h-4 w-4" /></button>}
                                        {category.status === 'ongoing' && <button onClick={() => handleStatusAction(category._id, completeCategory)} className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded" title="Complete"><CheckCircle className="h-4 w-4" /></button>}
                                        {category.status === 'groups_configured' && category.bracketType === 'team_league' && <button onClick={() => handleStatusAction(category._id, completeCategory)} className="p-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded" title="Complete"><CheckCircle className="h-4 w-4" /></button>}
                                        {(category.status === 'completed' || (category.status === 'groups_configured' && category.bracketType === 'team_league')) && <button onClick={() => openAnalytics(category)} className="p-2 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 rounded flex items-center gap-1.5" title="Analytics & Awards"><Trophy className="h-4 w-4" /> <span className="text-xs font-semibold uppercase pr-1">Awards</span></button>}
                                    </div>
                                    <div className="flex gap-2">
                                        {sportRegistry.get(category.sport)?.categoryForm && <button onClick={() => { setEditingCategory(category); setIsCreating(false); }} className="p-2 text-primary hover:text-white hover:bg-primary/20 rounded transition-colors"><Edit2 className="h-4 w-4" /></button>}
                                        <button onClick={() => handleDelete(category._id)} className="p-2 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <CategoryAnalyticsModal isOpen={isAnalyticsOpen} onClose={() => setIsAnalyticsOpen(false)} category={analyticsCategory} tournamentId={tournamentId} />
        </section>
    );
}
