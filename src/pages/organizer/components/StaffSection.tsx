import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Plus, Trash2, Loader2, X, Shield, Mail } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../../store/hooks';
import { addStaff, removeStaff } from '../../../store/slices/tournamentSlice';
import { staffApi, StaffMember } from '../../../api/staff';
import { Input } from '@/components/ui/input';

interface StaffSectionProps {
    tournamentId: string;
    staffIds: string[];
}

const emptyForm = { firstName: '', lastName: '', email: '', phone: '' };

const StaffSection: React.FC<StaffSectionProps> = ({ tournamentId, staffIds }) => {
    const dispatch = useAppDispatch();
    const { isLoading } = useAppSelector(state => state.tournament);

    const [myStaff, setMyStaff] = useState<StaffMember[]>([]);
    const [localError, setLocalError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const [isCreating, setIsCreating] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const [selectedStaffId, setSelectedStaffId] = useState('');

    const loadStaff = useCallback(async () => {
        try {
            setMyStaff(await staffApi.list());
        } catch (err: any) {
            setLocalError(err.response?.data?.message || 'Failed to load staff.');
        }
    }, []);

    useEffect(() => { loadStaff(); }, [loadStaff]);

    const staffById = (id: string) => myStaff.find(s => s._id === id);
    const assignable = myStaff.filter(s => s.isActive && !staffIds?.includes(s._id));

    const handleCreate = async () => {
        setLocalError(null);
        if (!form.firstName || !form.lastName || !form.email || !form.phone) return;
        setBusy(true);
        try {
            await staffApi.create(form);
            setForm(emptyForm);
            setIsCreating(false);
            await loadStaff();
        } catch (err: any) {
            setLocalError(err.response?.data?.message || 'Failed to create staff.');
        } finally {
            setBusy(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedStaffId) return;
        const result = await dispatch(addStaff({ id: tournamentId, staffData: { staffId: selectedStaffId } }));
        if (addStaff.fulfilled.match(result)) setSelectedStaffId('');
    };

    const handleRemove = async (staffId: string) => {
        if (window.confirm('Remove this staff member from the tournament?')) {
            await dispatch(removeStaff({ id: tournamentId, staffId }));
        }
    };

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Shield className="h-5 w-5" /></div>
                    <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Tournament Staff ({staffIds?.length || 0})</h2>
                </div>
                {!isCreating && (
                    <button onClick={() => setIsCreating(true)} className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 hover:bg-primary/30 text-primary font-medium transition-colors text-sm">
                        <Plus className="h-4 w-4" /> New Staff Account
                    </button>
                )}
            </div>

            {localError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-sm">{localError}</div>
            )}

            {/* Create staff credentials */}
            {isCreating && (
                <div className="flex flex-col gap-4 p-5 bg-black/40 rounded-2xl border border-white/5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-white font-medium flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /> Create staff — a temporary password is emailed to them</h3>
                        <button onClick={() => { setIsCreating(false); setLocalError(null); }} className="p-1.5 rounded-lg border border-white/20 text-white hover:bg-white/10"><X className="h-4 w-4" /></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="bg-black/50 border-white/10 text-white" />
                        <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="bg-black/50 border-white/10 text-white" />
                        <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" className="bg-black/50 border-white/10 text-white" />
                        <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="bg-black/50 border-white/10 text-white" />
                    </div>
                    <button onClick={handleCreate} disabled={busy} className="self-end px-6 py-2 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create & Email Credentials'}
                    </button>
                </div>
            )}

            {/* Assign an existing staff account to this tournament */}
            <div className="flex flex-col md:flex-row gap-3 md:items-end p-5 bg-black/30 rounded-2xl border border-white/5">
                <div className="flex-1 space-y-1">
                    <label className="text-xs text-gray-400 ml-1">Assign existing staff to this tournament</label>
                    <select value={selectedStaffId} onChange={e => setSelectedStaffId(e.target.value)} className="w-full h-10 rounded-lg bg-black/50 border border-white/10 text-white px-3 text-sm">
                        <option value="">{assignable.length ? 'Select a staff member…' : 'No unassigned staff available'}</option>
                        {assignable.map(s => (
                            <option key={s._id} value={s._id}>{s.firstName} {s.lastName} — {s.email}</option>
                        ))}
                    </select>
                </div>
                <button onClick={handleAssign} disabled={isLoading || !selectedStaffId} className="px-6 py-2 h-10 rounded-lg bg-primary hover:bg-primary/90 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
                </button>
            </div>

            {/* Assigned staff */}
            {!staffIds || staffIds.length === 0 ? (
                <div className="text-center py-10 text-gray-500">No staff assigned to this tournament yet.</div>
            ) : (
                <div className="flex flex-col gap-3">
                    {staffIds.map((staffId) => {
                        const s = staffById(staffId);
                        return (
                            <div key={staffId} className="bg-black/30 border border-white/10 rounded-xl p-4 flex justify-between items-center hover:border-white/20 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center text-primary font-bold">
                                        <UserPlus className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-white font-medium">{s ? `${s.firstName} ${s.lastName}` : 'Staff Member'}</span>
                                        <span className="text-xs text-gray-500">{s ? s.email : staffId}</span>
                                    </div>
                                </div>
                                <button onClick={() => handleRemove(staffId)} className="p-2 hover:bg-white/10 rounded-lg text-red-500 transition-colors" title="Remove from tournament">
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

export default StaffSection;
