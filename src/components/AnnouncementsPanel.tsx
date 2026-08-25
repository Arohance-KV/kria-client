import React, { useCallback, useEffect, useState } from 'react';
import { Megaphone, Pin, Loader2, Plus, Edit2, Trash2, X, AlertCircle, CalendarClock, Info, AlertTriangle } from 'lucide-react';
import { announcementApi, Announcement, AnnouncementSeverity } from '../api/announcement';

const SEVERITY: Record<AnnouncementSeverity, { label: string; badge: string; icon: React.ElementType }> = {
    info: { label: 'Info', badge: 'bg-blue-500/10 text-blue-400 border-blue-500/30', icon: Info },
    important: { label: 'Important', badge: 'bg-red-500/10 text-red-400 border-red-500/30', icon: AlertTriangle },
    schedule_change: { label: 'Schedule Change', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: CalendarClock },
};

const SEVERITY_ORDER: AnnouncementSeverity[] = ['info', 'important', 'schedule_change'];

const emptyForm = { title: '', message: '', severity: 'info' as AnnouncementSeverity, pinned: false };

interface Props {
    tournamentId: string;
    canManage?: boolean;
}

export default function AnnouncementsPanel({ tournamentId, canManage = false }: Props) {
    const [items, setItems] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try { setItems(await announcementApi.list(tournamentId)); }
        catch { setItems([]); }
        finally { setLoading(false); }
    }, [tournamentId]);

    useEffect(() => { load(); }, [load]);

    const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); };

    const submit = async () => {
        if (!form.message.trim()) return;
        setSubmitting(true); setError(null);
        try {
            if (editingId) await announcementApi.update(editingId, form);
            else await announcementApi.create(tournamentId, form);
            resetForm();
            await load();
        } catch (e: any) {
            setError(e?.response?.data?.data?.message || e?.response?.data?.message || 'Failed to save announcement.');
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (a: Announcement) => {
        setEditingId(a._id);
        setForm({ title: a.title || '', message: a.message, severity: a.severity, pinned: a.pinned });
        setShowForm(true);
    };

    const remove = async (id: string) => {
        if (!confirm('Delete this announcement?')) return;
        try { await announcementApi.remove(id); await load(); }
        catch (e: any) { setError(e?.response?.data?.data?.message || 'Failed to delete.'); }
    };

    const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Megaphone className="h-5 w-5" /></div>
                    <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Announcements</h2>
                </div>
                {canManage && !showForm && (
                    <button onClick={() => { resetForm(); setShowForm(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-full font-medium text-sm transition-colors w-fit">
                        <Plus className="h-4 w-4" /> New Announcement
                    </button>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-3 p-3 bg-red-900/20 border border-red-900/50 rounded-xl text-red-300 text-sm">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
                </div>
            )}

            {/* Compose / edit form */}
            {canManage && showForm && (
                <div className="bg-black/40 border border-white/10 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-oswald font-bold text-white">{editingId ? 'Edit Announcement' : 'New Announcement'}</h3>
                        <button onClick={resetForm} className="text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                    </div>
                    <input
                        type="text" placeholder="Title (optional)" value={form.title} maxLength={140}
                        onChange={e => setForm({ ...form, title: e.target.value })}
                        className="w-full h-10 rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white focus:outline-none focus:border-primary"
                    />
                    <textarea
                        placeholder="Write your announcement…" value={form.message} maxLength={4000} rows={4}
                        onChange={e => setForm({ ...form, message: e.target.value })}
                        className="w-full rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary resize-y"
                    />
                    <div className="flex flex-wrap items-center gap-4">
                        <select
                            value={form.severity}
                            onChange={e => setForm({ ...form, severity: e.target.value as AnnouncementSeverity })}
                            className="h-10 rounded-lg border border-white/10 bg-black/50 px-3 text-sm text-white focus:outline-none focus:border-primary"
                        >
                            {SEVERITY_ORDER.map(s => <option key={s} value={s} className="bg-[#1a1a1a]">{SEVERITY[s].label}</option>)}
                        </select>
                        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
                            <input type="checkbox" checked={form.pinned}
                                onChange={e => setForm({ ...form, pinned: e.target.checked })}
                                className="accent-primary h-4 w-4" />
                            <Pin className="h-4 w-4" /> Pin to top
                        </label>
                        <div className="flex-1" />
                        <button onClick={resetForm} className="px-4 py-2 rounded-xl border border-white/10 text-white hover:bg-white/5 font-medium text-sm">Cancel</button>
                        <button onClick={submit} disabled={submitting || !form.message.trim()}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-sm disabled:opacity-50">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {editingId ? 'Save' : 'Post'}
                        </button>
                    </div>
                </div>
            )}

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : items.length === 0 ? (
                <div className="text-center p-8 border border-white/5 rounded-xl bg-black/20">
                    <Megaphone className="h-10 w-10 text-gray-500 mx-auto mb-3 opacity-50" />
                    <p className="text-gray-400 font-medium">No announcements yet.</p>
                    <p className="text-sm text-gray-500 mt-1">{canManage ? 'Post one to keep players in the loop.' : 'Check back later for updates from the organizer.'}</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {items.map(a => {
                        const sev = SEVERITY[a.severity] || SEVERITY.info;
                        const SevIcon = sev.icon;
                        return (
                            <div key={a._id}
                                className={`bg-black/40 border rounded-2xl p-5 flex flex-col gap-2 ${a.pinned ? 'border-primary/40' : 'border-white/10'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border ${sev.badge}`}>
                                            <SevIcon className="h-3 w-3" /> {sev.label}
                                        </span>
                                        {a.pinned && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded border bg-primary/10 text-primary border-primary/30">
                                                <Pin className="h-3 w-3" /> Pinned
                                            </span>
                                        )}
                                    </div>
                                    {canManage && (
                                        <div className="flex gap-1 shrink-0">
                                            <button onClick={() => startEdit(a)} className="p-1.5 text-primary hover:text-white hover:bg-primary/20 rounded transition-colors"><Edit2 className="h-4 w-4" /></button>
                                            <button onClick={() => remove(a._id)} className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"><Trash2 className="h-4 w-4" /></button>
                                        </div>
                                    )}
                                </div>
                                {a.title && <h4 className="text-lg font-bold text-white leading-tight">{a.title}</h4>}
                                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{a.message}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                    <span className="text-gray-400 font-medium">{a.authorName}</span>
                                    <span className="capitalize text-gray-600">· {a.authorRole}</span>
                                    <span>·</span>
                                    <span>{fmtDate(a.createdAt)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
