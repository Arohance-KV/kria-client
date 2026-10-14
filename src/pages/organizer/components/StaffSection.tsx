// Staff assigned to this tournament, plus a drawer to add one of the organizer's
// existing staff or create a new account and add it in one step.
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from 'react';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import { useAppDispatch } from '../../../store/hooks';
import { addStaff, clearTournamentError, removeStaff } from '../../../store/slices/tournamentSlice';
import { staffApi, StaffMember } from '../../../api/staff';
import { cn } from '@/lib/utils';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, ToneBadge } from '../shared';
import {
    Avatar, COLHEAD, ConfirmBar, Drawer, EmptyState, Field, INPUT, Notice, PageHead, PANEL, ROW, SearchInput, SegTabs, Spinner, Switch, useReadOnly,
} from '../ui';

interface StaffSectionProps {
    tournamentId: string;
    staffIds: string[];
}

type ListState = 'loading' | 'ok' | 'error';

const emptyForm = { firstName: '', lastName: '', email: '', phone: '' };
type StaffForm = typeof emptyForm;

const fullName = (s: Pick<StaffMember, 'firstName' | 'lastName'>) => `${s.firstName} ${s.lastName}`.trim();
const errText = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

const validate = (f: StaffForm) => {
    const e: Partial<Record<keyof StaffForm, string>> = {};
    if (!f.firstName.trim()) e.firstName = 'Enter a first name.';
    if (!f.lastName.trim()) e.lastName = 'Enter a last name.';
    if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email address.';
    if (f.phone.replace(/\D/g, '').length < 10) e.phone = 'Enter a phone number with at least 10 digits.';
    return e;
};

// Wide layout (xl+): name · email · phone · account · actions
const COLS = 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_6rem_7rem]';

const StaffSection = ({ tournamentId, staffIds = [] }: StaffSectionProps) => {
    const dispatch = useAppDispatch();
    const readOnly = useReadOnly();
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [listState, setListState] = useState<ListState>('loading');
    const [listError, setListError] = useState('');
    const [adding, setAdding] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

    const loadStaff = useCallback(async () => {
        try {
            setStaff(await staffApi.list());
            setListState('ok');
        } catch (err) {
            setListError(errText(err, 'The server didn’t respond.'));
            setListState('error');
        }
    }, []);

    useEffect(() => { loadStaff(); }, [loadStaff]);

    const retry = () => { setListState('loading'); loadStaff(); };

    const handleRemove = async (staffId: string) => {
        setRemoving(staffId);
        setRowError(null);
        const r = await dispatch(removeStaff({ id: tournamentId, staffId }));
        setRemoving(null);
        setConfirmRemove(null);
        if (!removeStaff.fulfilled.match(r)) {
            dispatch(clearTournamentError()); // shown on the row instead of the page banner
            setRowError({ id: staffId, message: (r.payload as string) || 'Couldn’t remove them from this tournament.' });
        }
    };

    const addButton = !readOnly && (
        <button type="button" onClick={() => setAdding(true)} className={BTN_PRIMARY}>
            <Plus aria-hidden className="h-4 w-4" />Add staff
        </button>
    );

    return (
        <div className="space-y-6">
            <PageHead title="Staff" actions={addButton}
                desc="People who help run this tournament. Staff can manage everything except payments, staff and deleting the tournament." />

            <section aria-label="Assigned staff" className={cn(PANEL, 'overflow-hidden')}>
                {staffIds.length === 0 ? (
                    <EmptyState title="No staff on this tournament yet" text="Add people who can help you run it. Each gets their own login."
                        action={!readOnly && <button type="button" onClick={() => setAdding(true)} className={BTN_SECONDARY}>Add staff</button>} />
                ) : listState === 'loading' ? <Spinner label="Loading staff" /> : (
                    <>
                        {listState === 'error' && (
                            <div className="border-b border-line p-3">
                                <Notice tone="red" icon={AlertCircle}>
                                    <span role="alert">Couldn’t load staff details. {listError}</span>{' '}
                                    <button type="button" onClick={retry} className="font-medium underline underline-offset-2">Try again</button>
                                </Notice>
                            </div>
                        )}
                        <div className={cn(COLHEAD, 'hidden xl:grid', COLS)}>
                            <span>Name</span><span>Email</span><span>Phone</span><span>Account</span><span />
                        </div>
                        <ul className="divide-y divide-line">
                            {staffIds.map(id => {
                                const s = staff.find(x => x._id === id);
                                const name = s ? fullName(s) : 'Staff member';
                                const status = s && (s.isActive
                                    ? <ToneBadge label="Active" tone="green" />
                                    : <ToneBadge label="Inactive" tone="neutral" />);
                                return (
                                    <li key={id}>
                                        <div className={cn(ROW, 'grid-cols-[minmax(0,1fr)_auto]', COLS)}>
                                            <div className="flex min-w-0 items-center gap-3">
                                                <Avatar name={name} size="lg" />
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-fg">{name}</p>
                                                    <p className="truncate text-[13px] text-fg-subtle xl:hidden">
                                                        {s ? [s.email, s.phone].filter(Boolean).join(' · ') : 'Details unavailable'}
                                                    </p>
                                                    {s && !s.isActive && <span className="mt-1 inline-block xl:hidden">{status}</span>}
                                                </div>
                                            </div>
                                            <span className="hidden truncate text-sm text-fg-muted xl:block">{s?.email ?? '—'}</span>
                                            <span className="hidden text-sm tabular-nums text-fg-muted xl:block">{s?.phone ?? '—'}</span>
                                            <span className="hidden xl:block">{status}</span>
                                            <div className="flex justify-end">
                                                {!readOnly && (
                                                    <button type="button" onClick={() => { setRowError(null); setConfirmRemove(id); }}
                                                        disabled={removing === id} className={cn(BTN_GHOST, BTN_SM)}>
                                                        Remove<span className="sr-only"> {name}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        {rowError?.id === id && (
                                            <p role="alert" className="border-t border-line px-4 py-2.5 text-[13px] text-red-300 sm:px-5">{rowError.message}</p>
                                        )}
                                        {confirmRemove === id && (
                                            <ConfirmBar danger busy={removing === id} confirmLabel="Remove"
                                                message={`Remove ${name} from this tournament? Their account stays, and you can add them back later.`}
                                                onConfirm={() => handleRemove(id)} onCancel={() => setConfirmRemove(null)} />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </>
                )}
            </section>

            {adding && (
                <AddStaffDrawer tournamentId={tournamentId} staff={staff} staffIds={staffIds} listState={listState} listError={listError}
                    onRetry={retry} onCreated={loadStaff} onClose={() => setAdding(false)} />
            )}
        </div>
    );
};

function AddStaffDrawer({ tournamentId, staff, staffIds, listState, listError, onRetry, onCreated, onClose }: {
    tournamentId: string; staff: StaffMember[]; staffIds: string[]; listState: ListState; listError: string;
    onRetry: () => void; onCreated: () => void; onClose: () => void;
}) {
    const dispatch = useAppDispatch();
    const [tab, setTab] = useState<'existing' | 'new'>('existing');
    const [q, setQ] = useState('');
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<StaffForm>(emptyForm);
    const [assign, setAssign] = useState(true);
    const [tried, setTried] = useState(false);
    const errors = tried ? validate(form) : {};

    const unassigned = staff.filter(s => !staffIds.includes(s._id));
    const needle = q.trim().toLowerCase();
    const shown = unassigned.filter(s => !needle || `${fullName(s)} ${s.email}`.toLowerCase().includes(needle));

    /** Adds a staff account to this tournament; returns an error message on failure. */
    const assignToTournament = async (staffId: string) => {
        const r = await dispatch(addStaff({ id: tournamentId, staffData: { staffId } }));
        if (addStaff.fulfilled.match(r)) return null;
        dispatch(clearTournamentError()); // shown in the drawer instead of the page banner
        return (r.payload as string) || 'The server didn’t respond.';
    };

    const addExisting = async (s: StaffMember) => {
        setBusy(s._id);
        setError(null);
        const err = await assignToTournament(s._id);
        setBusy(null);
        if (err) setError(`Couldn’t add ${fullName(s)}. ${err}`);
        else onClose();
    };

    const create = async (e: FormEvent) => {
        e.preventDefault();
        setTried(true);
        if (Object.keys(validate(form)).length) return;
        setBusy('create');
        setError(null);
        const data = { firstName: form.firstName.trim(), lastName: form.lastName.trim(), email: form.email.trim(), phone: form.phone.trim() };
        let created: StaffMember | undefined;
        try {
            created = await staffApi.create(data);
        } catch (err) {
            setError(errText(err, 'Couldn’t create the account.'));
            setBusy(null);
            return;
        }
        onCreated();
        if (assign) {
            const err = created?._id ? await assignToTournament(created._id) : 'The new account’s ID wasn’t returned.';
            if (err) {
                // The account exists now, so don't offer to create it again.
                setBusy(null);
                setForm(emptyForm);
                setTried(false);
                setTab('existing');
                setError(`Account created for ${fullName(data)}, but adding them to this tournament failed. ${err} Add them from Your staff.`);
                return;
            }
        }
        onClose();
    };

    const setField = (k: keyof StaffForm) => (e: ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

    return (
        <Drawer title="Add staff" description="Staff accounts belong to you and can help on any of your tournaments." onClose={onClose}
            footer={tab === 'new' && <>
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="submit" form="staff-form" disabled={busy === 'create'} className={BTN_PRIMARY}>
                    {busy === 'create' && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}Create and send invite
                </button>
            </>}>
            <div className="grid gap-4">
                <SegTabs<'existing' | 'new'> label="Add staff" value={tab} onChange={setTab}
                    items={[{ key: 'existing', label: 'Your staff', count: listState === 'ok' ? unassigned.length : undefined }, { key: 'new', label: 'New account' }]} />

                {error && <Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice>}

                {tab === 'existing' ? (
                    listState === 'loading' ? <Spinner label="Loading your staff" /> : listState === 'error' ? (
                        <Notice tone="red" icon={AlertCircle}>
                            <span role="alert">Couldn’t load your staff. {listError}</span>{' '}
                            <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">Try again</button>
                        </Notice>
                    ) : unassigned.length === 0 ? (
                        <div className={PANEL}>
                            <EmptyState
                                title={staff.length ? 'All your staff are already on this tournament' : 'No staff accounts yet'}
                                text="Create an account to add someone new."
                                action={<button type="button" onClick={() => setTab('new')} className={BTN_SECONDARY}>New account</button>} />
                        </div>
                    ) : (
                        <>
                            <SearchInput value={q} onChange={setQ} label="Search staff" placeholder="Search your staff" className="sm:w-full" />
                            {shown.length === 0 ? (
                                <p className="py-6 text-center text-[13.5px] text-fg-muted">No staff match “{q.trim()}”.</p>
                            ) : (
                                <ul className={cn(PANEL, 'divide-y divide-line')}>
                                    {shown.map(s => (
                                        <li key={s._id} className={cn(ROW, 'grid-cols-[minmax(0,1fr)_auto] sm:px-4', !s.isActive && 'opacity-60')}>
                                            <div className="flex min-w-0 items-center gap-2.5">
                                                <Avatar name={fullName(s)} />
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-fg">{fullName(s)}</p>
                                                    <p className="truncate text-[13px] text-fg-subtle">{s.email}</p>
                                                </div>
                                            </div>
                                            {s.isActive ? (
                                                <button type="button" onClick={() => addExisting(s)} disabled={!!busy} className={cn(BTN_SECONDARY, BTN_SM)}>
                                                    {busy === s._id && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
                                                    Add<span className="sr-only"> {fullName(s)}</span>
                                                </button>
                                            ) : <span className="text-[12.5px] text-fg-subtle">Inactive</span>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    )
                ) : (
                    <form id="staff-form" onSubmit={create} noValidate className="grid gap-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field id="staff-first" label="First name" error={errors.firstName}>
                                <input id="staff-first" className={INPUT} autoComplete="off" aria-invalid={!!errors.firstName} value={form.firstName} onChange={setField('firstName')} />
                            </Field>
                            <Field id="staff-last" label="Last name" error={errors.lastName}>
                                <input id="staff-last" className={INPUT} autoComplete="off" aria-invalid={!!errors.lastName} value={form.lastName} onChange={setField('lastName')} />
                            </Field>
                            <Field id="staff-email" label="Email" className="sm:col-span-2" error={errors.email} help="We email a temporary password to this address.">
                                <input id="staff-email" type="email" className={INPUT} autoComplete="off" aria-invalid={!!errors.email} value={form.email} onChange={setField('email')} />
                            </Field>
                            <Field id="staff-phone" label="Phone" className="sm:col-span-2" error={errors.phone}>
                                <input id="staff-phone" type="tel" className={INPUT} autoComplete="off" aria-invalid={!!errors.phone} value={form.phone} onChange={setField('phone')} />
                            </Field>
                        </div>
                        <Switch id="staff-assign" label="Add to this tournament" description="Turn off to only create the account."
                            checked={assign} onChange={setAssign} />
                    </form>
                )}
            </div>
        </Drawer>
    );
}

export default StaffSection;
