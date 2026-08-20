import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import {
    fetchRegistrationsByTournament,
    approveRegistration,
    rejectRegistration,
    manualAssignPlayer
} from '../../../store/slices/registrationSlice';
import { fetchTournamentTeams } from '../../../store/slices/teamSlice';
import { Users, Loader2, CheckCircle, XCircle, Clock, ShieldAlert, UserPlus, X } from 'lucide-react';

interface RegistrationsSectionProps {
    tournamentId: string;
}

// Statuses where an organizer may manually assign/reassign the player to a team.
const ASSIGNABLE_STATUSES = ['approved', 'assigned', 'auctioned'];

const RegistrationsSection: React.FC<RegistrationsSectionProps> = ({ tournamentId }) => {
    const dispatch = useAppDispatch();
    const { tournamentRegistrations, isLoading, categories, error } = useAppSelector(state => state.registration);
    const { teams } = useAppSelector(state => state.team);

    const [assigningId, setAssigningId] = useState<string | null>(null);
    // The registration currently open in the assign modal (null = closed).
    const [assignTarget, setAssignTarget] = useState<any | null>(null);
    const [assignForm, setAssignForm] = useState({ teamId: '', soldPrice: '' });

    useEffect(() => {
        dispatch(fetchRegistrationsByTournament({ tournamentId }));
        dispatch(fetchTournamentTeams(tournamentId));
    }, [dispatch, tournamentId]);

    const handleApprove = async (id: string) => {
        await dispatch(approveRegistration(id));
    };

    const handleReject = async (id: string) => {
        await dispatch(rejectRegistration(id));
    };

    const openAssignModal = (reg: any) => {
        setAssignTarget(reg);
        setAssignForm({
            teamId: reg.teamId || '',
            soldPrice: reg.auctionData?.soldPrice ? String(reg.auctionData.soldPrice) : '',
        });
    };

    const handleAssign = async () => {
        if (!assignTarget || !assignForm.teamId) return;
        const registrationId = assignTarget._id;
        setAssigningId(registrationId);
        const result = await dispatch(manualAssignPlayer({
            registrationId,
            teamId: assignForm.teamId,
            soldPrice: assignForm.soldPrice ? Number(assignForm.soldPrice) : undefined,
        }));
        setAssigningId(null);
        if (manualAssignPlayer.fulfilled.match(result)) {
            // Refresh team budgets to reflect the deduction.
            dispatch(fetchTournamentTeams(tournamentId));
            setAssignTarget(null);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending': return <span className="px-3 py-1 bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><Clock className="h-3 w-3" /> Pending</span>;
            case 'approved': return <span className="px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><CheckCircle className="h-3 w-3" /> Approved</span>;
            case 'rejected': return <span className="px-3 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><XCircle className="h-3 w-3" /> Rejected</span>;
            default: return <span className="px-3 py-1 bg-gray-500/10 text-gray-400 border border-gray-500/20 rounded-full text-xs font-bold uppercase tracking-wider w-fit">{status}</span>;
        }
    };

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg text-primary"><Users className="h-5 w-5" /></div>
                <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Player Applications</h2>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-300 text-sm">
                    <ShieldAlert className="h-5 w-5 flex-shrink-0" /> {error}
                </div>
            )}

            {isLoading && tournamentRegistrations.length === 0 ? (
                <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : tournamentRegistrations.length === 0 ? (
                <div className="text-center p-10 bg-black/20 rounded-2xl border border-white/5">
                    <ShieldAlert className="h-10 w-10 text-gray-500 mx-auto mb-3 opacity-50" />
                    <p className="text-gray-400">No applications received yet.</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead>
                            <tr className="border-b border-white/10 bg-black/40">
                                <th className="p-4 rounded-tl-xl text-xs font-bold text-gray-400 uppercase tracking-wider border-0">Player Name</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-0">Category</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-0">Gender / Age</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-0">Status</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-0">Team</th>
                                <th className="p-4 rounded-tr-xl text-xs font-bold text-gray-400 uppercase tracking-wider text-right border-0">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 bg-black/20">
                            {tournamentRegistrations.map((reg: any) => (
                                <tr key={reg._id} className="hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <p className="text-white font-medium capitalize">{reg.profile?.firstName} {reg.profile?.lastName}</p>
                                        <p className="text-xs text-gray-500">{reg.profile?.phone}</p>
                                    </td>
                                    <td className="p-4 text-primary font-medium text-sm">
                                        {categories?.find((c: any) => c._id === reg.categoryId)?.name || reg.categoryDetails?.name || 'Unknown Category'}
                                    </td>
                                    <td className="p-4 text-gray-300 text-sm">
                                        <span className="capitalize font-medium">{reg.profile?.gender}</span>, {reg.profile?.age} yrs
                                    </td>
                                    <td className="p-4">
                                        {getStatusBadge(reg.status)}
                                    </td>
                                    <td className="p-4 text-sm text-gray-300">
                                        {reg.teamId
                                            ? <span className="font-medium text-white">{teams.find(t => t._id === reg.teamId)?.name || 'Assigned'}</span>
                                            : <span className="text-gray-600">—</span>}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex items-center justify-end gap-2">
                                            {reg.status === 'pending' && (
                                                <>
                                                    <button
                                                        onClick={() => handleApprove(reg._id)}
                                                        className="p-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 rounded-lg transition-colors group"
                                                        title="Approve"
                                                    >
                                                        <CheckCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleReject(reg._id)}
                                                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors group"
                                                        title="Reject"
                                                    >
                                                        <XCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
                                                    </button>
                                                </>
                                            )}
                                            {ASSIGNABLE_STATUSES.includes(reg.status) && (
                                                <button
                                                    onClick={() => openAssignModal(reg)}
                                                    disabled={assigningId === reg._id}
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                                    title={reg.teamId ? 'Reassign to team' : 'Assign to team'}
                                                >
                                                    {assigningId === reg._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                                    {reg.teamId ? 'Reassign' : 'Assign'}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* MANUAL ASSIGN MODAL */}
            {assignTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
                        <button onClick={() => setAssignTarget(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                        <h3 className="text-2xl font-oswald font-bold mb-2">{assignTarget.teamId ? 'Reassign Player' : 'Assign Player'}</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            Assign <span className="text-white font-bold capitalize">{assignTarget.profile?.firstName} {assignTarget.profile?.lastName}</span> to a team
                        </p>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Select Team *</label>
                                <select value={assignForm.teamId} onChange={e => setAssignForm({ ...assignForm, teamId: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-primary">
                                    <option value="">Choose team…</option>
                                    {teams.map(team => <option key={team._id} value={team._id}>{team.name} — ₹{team.budget.toLocaleString()} left</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Price (₹) <span className="text-gray-600">optional — deducted from team budget</span></label>
                                <input type="number" min="0" value={assignForm.soldPrice} onChange={e => setAssignForm({ ...assignForm, soldPrice: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-primary font-mono text-lg" placeholder="Leave blank for free assignment" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setAssignTarget(null)} className="px-5 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 font-medium">Cancel</button>
                            <button onClick={handleAssign} disabled={!assignForm.teamId || assigningId === assignTarget._id}
                                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold disabled:opacity-50 flex items-center gap-2">
                                {assigningId === assignTarget._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default RegistrationsSection;
