// Organizer announcements: a list of posts (pinned first) with edit, pin and delete,
// and a side drawer to compose. Players read them through components/AnnouncementsPanel.
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { AlertCircle, Loader2, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import { announcementApi, Announcement, AnnouncementSeverity } from '@/api/announcement';
import { cn } from '@/lib/utils';
import { BTN_PRIMARY, BTN_SECONDARY, Tone, ToneBadge } from '../shared';
import { ConfirmBar, Drawer, EmptyState, Field, INPUT, MoreMenu, Notice, PageHead, PANEL, Segmented, Spinner, Switch, TEXTAREA } from '../ui';

const SEVERITY: Record<AnnouncementSeverity, { label: string; tone: Tone }> = {
    info: { label: 'Info', tone: 'blue' },
    important: { label: 'Important', tone: 'red' },
    schedule_change: { label: 'Schedule change', tone: 'amber' },
};
const SEVERITY_OPTIONS = (Object.keys(SEVERITY) as AnnouncementSeverity[]).map(value => ({ value, label: SEVERITY[value].label }));

type Draft = { title: string; message: string; severity: AnnouncementSeverity; pinned: boolean };
const EMPTY: Draft = { title: '', message: '', severity: 'info', pinned: false };
const draftOf = (a: Announcement): Draft => ({ title: a.title || '', message: a.message, severity: a.severity, pinned: a.pinned });

const errText = (e: unknown, fallback: string) => {
    const d = (e as { response?: { data?: { message?: string; data?: { message?: string } } } })?.response?.data;
    return d?.data?.message || d?.message || fallback;
};
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const when = (iso: string) => { try { return format(new Date(iso), 'd MMM, h:mm a'); } catch { return ''; } };

export default function AnnouncementsSection({ tournamentId }: { tournamentId: string }) {
    const [items, setItems] = useState<Announcement[]>([]);
    const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
    const [loadError, setLoadError] = useState('');
    // Composer: null = closed, 'new', or the announcement being edited.
    const [editing, setEditing] = useState<Announcement | 'new' | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

    const load = useCallback(async () => {
        try {
            setItems(await announcementApi.list(tournamentId));
            setLoadState('ok');
        } catch (e) {
            setLoadError(errText(e, 'The server didn’t respond.'));
            setLoadState('error');
        }
    }, [tournamentId]);

    useEffect(() => { setLoadState('loading'); load(); }, [load]);

    const sorted = [...items].sort((a, b) => Number(b.pinned) - Number(a.pinned));

    const togglePin = async (a: Announcement) => {
        setBusy(a._id); setRowError(null);
        try {
            await announcementApi.update(a._id, { ...draftOf(a), pinned: !a.pinned });
            await load();
        } catch (e) {
            setRowError({ id: a._id, message: errText(e, a.pinned ? 'Couldn’t unpin this announcement.' : 'Couldn’t pin this announcement.') });
        } finally { setBusy(null); }
    };

    const remove = async (id: string) => {
        setBusy(id); setRowError(null);
        try {
            await announcementApi.remove(id);
            setConfirmDelete(null);
            await load();
        } catch (e) {
            setConfirmDelete(null);
            setRowError({ id, message: errText(e, 'Couldn’t delete this announcement.') });
        } finally { setBusy(null); }
    };

    const newButton = (
        <button type="button" onClick={() => setEditing('new')} className={BTN_PRIMARY}>
            <Plus aria-hidden className="h-4 w-4" />New announcement
        </button>
    );

    return (
        <div className="space-y-6">
            <PageHead title="Announcements" desc="Updates players see on the tournament page. Pinned posts stay on top." actions={newButton} />

            <section aria-label="Announcements" className={cn(PANEL, 'overflow-hidden')}>
                {loadState === 'loading' ? <Spinner label="Loading announcements" /> : loadState === 'error' ? (
                    <div role="alert">
                        <EmptyState title="Couldn’t load announcements" text={loadError}
                            action={<button type="button" onClick={() => { setLoadState('loading'); load(); }} className={BTN_SECONDARY}>Try again</button>} />
                    </div>
                ) : sorted.length === 0 ? (
                    <EmptyState title="No announcements yet" text="Post one to keep players in the loop about schedules, venues and rules."
                        action={<button type="button" onClick={() => setEditing('new')} className={BTN_SECONDARY}>New announcement</button>} />
                ) : (
                    <ul className="divide-y divide-line">
                        {sorted.map(a => {
                            const sev = SEVERITY[a.severity] ?? SEVERITY.info;
                            return (
                                <li key={a._id}>
                                    <article aria-busy={busy === a._id || undefined}
                                        className={cn('grid gap-2 px-4 py-4 sm:px-5', a.pinned && 'shadow-[inset_2px_0_0_var(--color-primary)]')}>
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <ToneBadge label={sev.label} tone={sev.tone} />
                                                {a.pinned && (
                                                    <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-px text-xs text-fg-muted ring-1 ring-inset ring-line">
                                                        <Pin aria-hidden className="h-3 w-3 text-primary" />Pinned
                                                    </span>
                                                )}
                                            </div>
                                            <MoreMenu label={`Actions for ${a.title || a.message.slice(0, 40)}`} items={[
                                                { label: 'Edit', icon: Pencil, onSelect: () => setEditing(a) },
                                                { label: a.pinned ? 'Unpin' : 'Pin to top', icon: a.pinned ? PinOff : Pin, onSelect: () => togglePin(a), disabled: busy === a._id },
                                                'separator',
                                                { label: 'Delete', icon: Trash2, danger: true, onSelect: () => { setRowError(null); setConfirmDelete(a._id); } },
                                            ]} />
                                        </div>
                                        {a.title && <h3 className="text-[15px] font-semibold text-fg">{a.title}</h3>}
                                        <p className="max-w-[75ch] whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{a.message}</p>
                                        <p className="text-xs text-fg-subtle">
                                            {[a.authorName, a.authorRole && capitalize(a.authorRole), when(a.createdAt)].filter(Boolean).join(' · ')}
                                        </p>
                                        {rowError?.id === a._id && <p role="alert" className="text-[13px] text-red-300">{rowError.message}</p>}
                                    </article>
                                    {confirmDelete === a._id && (
                                        <ConfirmBar danger busy={busy === a._id}
                                            message="Delete this announcement? Players will no longer see it."
                                            confirmLabel="Delete" onConfirm={() => remove(a._id)} onCancel={() => setConfirmDelete(null)} />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>

            {editing && (
                <Composer tournamentId={tournamentId} announcement={editing === 'new' ? null : editing}
                    onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
            )}
        </div>
    );
}

function Composer({ tournamentId, announcement, onClose, onSaved }: {
    tournamentId: string; announcement: Announcement | null; onClose: () => void; onSaved: () => void;
}) {
    const [draft, setDraft] = useState<Draft>(announcement ? draftOf(announcement) : EMPTY);
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }));
    const messageError = tried && !draft.message.trim() ? 'Write a message for players.' : undefined;

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setTried(true);
        if (!draft.message.trim()) return;
        setSaving(true); setError(null);
        const payload = { ...draft, title: draft.title.trim(), message: draft.message.trim() };
        try {
            if (announcement) await announcementApi.update(announcement._id, payload);
            else await announcementApi.create(tournamentId, payload);
            onSaved();
        } catch (err) {
            setError(errText(err, announcement ? 'Couldn’t save your changes.' : 'Couldn’t post this announcement.'));
            setSaving(false);
        }
    };

    return (
        <Drawer title={announcement ? 'Edit announcement' : 'New announcement'}
            description="Players see this on the tournament page and in the app." onClose={onClose}
            footer={<>
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="submit" form="announcement-form" disabled={saving} className={BTN_PRIMARY}>
                    {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
                    {announcement ? 'Save changes' : 'Post announcement'}
                </button>
            </>}>
            <form id="announcement-form" onSubmit={submit} noValidate className="grid gap-4">
                {error && <Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice>}
                <Field id="ann-title" label="Title" count={`${draft.title.length}/140`}>
                    <input id="ann-title" className={INPUT} maxLength={140} placeholder="Optional" value={draft.title}
                        onChange={e => set({ title: e.target.value })} />
                </Field>
                <Field id="ann-message" label="Message" count={`${draft.message.length}/4000`} error={messageError}>
                    <textarea id="ann-message" className={TEXTAREA} rows={6} maxLength={4000} required aria-invalid={!!messageError}
                        placeholder="What do players need to know?" value={draft.message} onChange={e => set({ message: e.target.value })} />
                </Field>
                <Field label="Type" help="Important and Schedule change are highlighted for players.">
                    <Segmented name="ann-severity" label="Type" value={draft.severity} options={SEVERITY_OPTIONS} onChange={severity => set({ severity })} />
                </Field>
                <Switch id="ann-pinned" label="Pin to top" description="Keeps this above newer posts until you unpin it."
                    checked={draft.pinned} onChange={pinned => set({ pinned })} />
            </form>
        </Drawer>
    );
}
