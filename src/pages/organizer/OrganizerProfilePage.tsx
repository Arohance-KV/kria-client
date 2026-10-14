import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRight, Camera, Check, Loader2, LogOut } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
    changePassword, fetchOrganizerStats, logout, updateOrganization, updateProfile, uploadOrganizerProfileImage,
} from '../../store/slices/authSlice';
import { cn } from '@/lib/utils';
import { AccountMenu, Brand, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, OrganizerSidebar, TONE } from './shared';
import { Avatar, Field, FormSection, INPUT, Notice, PageHead, PANEL, TEXTAREA } from './ui';

// Server limit (profileImageMemoryUpload: 5 * 1000 * 1000 bytes); checked first so a big photo never uploads.
const MAX_PHOTO = 5_000_000;
const INVALID = 'border-red-400/50 hover:border-red-400/60';

type User = { firstName?: string; lastName?: string; phone?: string; organization?: { name?: string; description?: string } } | null;
const detailsOf = (u: User) => ({ firstName: u?.firstName ?? '', lastName: u?.lastName ?? '', phone: u?.phone ?? '' });
const orgOf = (u: User) => ({ name: u?.organization?.name ?? '', description: u?.organization?.description ?? '' });
const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

// Error messages keyed by input id, in page order, so the first key is the field to focus.
const detailErrors = (d: ReturnType<typeof detailsOf>) => {
    const e: Record<string, string> = {};
    if (!d.firstName.trim()) e['pf-first'] = 'Enter your first name.';
    if (!d.lastName.trim()) e['pf-last'] = 'Enter your last name.';
    const phone = d.phone.trim();
    // The server requires a phone (model `required`, and it rejects an empty string).
    if (!phone) e['pf-phone'] = 'Enter your mobile number.';
    else if (!/^\+?[\d\s-]+$/.test(phone) || !/^\d{10,15}$/.test(phone.replace(/\D/g, ''))) e['pf-phone'] = 'Enter a 10-digit mobile number.';
    return e;
};
const orgErrors = (o: ReturnType<typeof orgOf>) =>
    !o.name.trim() && o.description.trim() ? { 'pf-org': 'Add a name for the organization you describe.' } : {};

const EMPTY_PWD = { current: '', next: '', confirm: '' };

const OrganizerProfilePage = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user, organizerStats } = useAppSelector(s => s.auth);
    const isStaff = user?.role === 'staff';

    const [details, setDetails] = useState(() => detailsOf(user));
    const [org, setOrg] = useState(() => orgOf(user));
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [savedMsg, setSavedMsg] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [photoError, setPhotoError] = useState<string | null>(null);
    const [pwd, setPwd] = useState(EMPTY_PWD);
    const [pwdErrors, setPwdErrors] = useState<Record<string, string>>({});
    const [pwdBusy, setPwdBusy] = useState(false);
    const [pwdDone, setPwdDone] = useState(false);

    useEffect(() => { dispatch(fetchOrganizerStats()); }, [dispatch]);
    // Reset the forms only when a different account loads, not on every user update (photo, save).
    useEffect(() => { setDetails(detailsOf(user)); setOrg(orgOf(user)); }, [user?._id]);
    useEffect(() => {
        if (!savedMsg) return;
        const timer = setTimeout(() => setSavedMsg(null), 2500);
        return () => clearTimeout(timer);
    }, [savedMsg]);

    const handleLogout = () => { dispatch(logout()); navigate('/login'); };

    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Organizer';
    const orgName = user?.organization?.name;
    const since = user?.createdAt ? format(new Date(user.createdAt), 'MMMM yyyy') : null;

    const detailsDirty = !same(details, detailsOf(user));
    const orgDirty = !same(org, orgOf(user));
    const dirty = detailsDirty || orgDirty;
    // Only the sections being saved are checked, so an untouched one never blocks a save.
    const errors: Record<string, string> = { ...(detailsDirty && detailErrors(details)), ...(orgDirty && orgErrors(org)) };
    const err = (id: string) => (tried ? errors[id] : undefined);
    const invalid = (id: string) => (err(id) ? { 'aria-invalid': true as const } : {});

    const discard = () => { setDetails(detailsOf(user)); setOrg(orgOf(user)); setTried(false); setSaveError(null); };

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!dirty || saving) return;
        setTried(true);
        const firstBad = Object.keys(errors)[0];
        if (firstBad) { document.getElementById(firstBad)?.focus(); return; }

        setSaving(true);
        setSaveError(null);
        const parts: string[] = [];
        let failure: string | null = null;
        if (detailsDirty) {
            const data = { firstName: details.firstName.trim(), lastName: details.lastName.trim(), phone: details.phone.trim() };
            const result = await dispatch(updateProfile({ role: 'organizer', data }));
            if (updateProfile.fulfilled.match(result)) { setDetails(data); parts.push('details'); }
            else failure = String(result.payload ?? 'Couldn’t save your details.');
        }
        if (orgDirty) {
            const data = { name: org.name.trim(), description: org.description.trim() };
            // The server replaces the whole organization: resend the logo, and drop empty fields it would reject.
            const body = Object.fromEntries(Object.entries({ ...data, logo: user?.organization?.logo }).filter(([, v]) => v));
            const result = await dispatch(updateOrganization(body));
            if (updateOrganization.fulfilled.match(result)) { setOrg(data); parts.push('organization'); }
            else failure = String(result.payload ?? 'Couldn’t save your organization.');
        }
        setSaving(false);
        if (failure) { setSaveError(failure); return; }
        setTried(false);
        setSavedMsg(`Saved your ${parts.join(' and ')}.`);
    };

    const handlePhoto = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!/^image\/(png|jpeg|gif)$/.test(file.type)) { setPhotoError('Use a PNG, JPG or GIF image.'); return; }
        if (file.size > MAX_PHOTO) {
            setPhotoError(`That image is ${(Math.ceil(file.size / 100_000) / 10).toFixed(1)} MB. Use one under 5 MB.`);
            return;
        }
        setPhotoError(null);
        setUploading(true);
        const result = await dispatch(uploadOrganizerProfileImage(file));
        setUploading(false);
        if (uploadOrganizerProfileImage.rejected.match(result)) setPhotoError(String(result.payload ?? 'Couldn’t upload the photo.'));
    };

    const handlePassword = async (e: FormEvent) => {
        e.preventDefault();
        setPwdDone(false);
        const errs: Record<string, string> = {};
        if (!pwd.current) errs['pw-current'] = 'Enter your current password.';
        if (!pwd.next) errs['pw-new'] = 'Enter a new password.';
        else if (pwd.next === pwd.current) errs['pw-new'] = 'Choose a password different from your current one.';
        if (pwd.confirm !== pwd.next) errs['pw-confirm'] = 'The passwords don’t match.';
        setPwdErrors(errs);
        const firstBad = Object.keys(errs)[0];
        if (firstBad) { document.getElementById(firstBad)?.focus(); return; }

        setPwdBusy(true);
        const result = await dispatch(changePassword({ role: 'organizer', data: { currentPassword: pwd.current, newPassword: pwd.next } }));
        setPwdBusy(false);
        if (changePassword.fulfilled.match(result)) { setPwd(EMPTY_PWD); setPwdDone(true); return; }
        // e.g. "Current password is incorrect."
        setPwdErrors({ 'pw-current': String(result.payload ?? 'Couldn’t change your password.') });
        document.getElementById('pw-current')?.focus();
    };

    const stat = (n?: number) => n ?? '—';
    const pwdInput = (id: string, key: keyof typeof EMPTY_PWD, autoComplete: string) => (
        <input id={id} type="password" autoComplete={autoComplete} value={pwd[key]} aria-invalid={pwdErrors[id] ? true : undefined}
            onChange={e => setPwd(p => ({ ...p, [key]: e.target.value }))} className={cn(INPUT, pwdErrors[id] && INVALID)} />
    );

    return (
        <div className="min-h-screen bg-canvas font-ui text-fg antialiased">
            <OrganizerSidebar isStaff={isStaff} />

            <div className="md:pl-16 lg:pl-60">
                <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-canvas/95 px-4 sm:px-6 lg:px-8">
                    <Brand className="md:hidden" />
                    <p className="hidden text-sm text-fg-muted md:block">
                        Organizer <span aria-hidden className="mx-1.5 text-fg-subtle">/</span>
                        <span className="text-fg">Profile</span>
                    </p>
                    <AccountMenu name={fullName} email={user?.email} image={user?.profileImage} onLogout={handleLogout} />
                </header>

                <main className="mx-auto max-w-[960px] space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
                    <PageHead title="Profile" desc="Your account, your organization and how you sign in." />

                    <section aria-label="Account" className={cn(PANEL, 'grid gap-4 p-5')}>
                        <div className="flex flex-wrap items-center gap-4">
                            <Avatar size="xl" name={fullName} src={user?.profileImage} />
                            <div className="min-w-0 flex-[1_1_200px]">
                                <p className="text-[17px] font-semibold text-fg">{fullName}</p>
                                <p className="text-[13px] text-fg-muted [overflow-wrap:anywhere]">
                                    {user?.email}{orgName && ` · ${orgName}`}
                                </p>
                                {since && <p className="mt-0.5 text-xs text-fg-subtle">Organizer since {since}</p>}
                            </div>
                            <div className="max-md:basis-full">
                                <input id="pf-photo" type="file" accept="image/png,image/jpeg,image/gif" hidden onChange={handlePhoto} />
                                <button type="button" disabled={uploading} onClick={() => document.getElementById('pf-photo')?.click()}
                                    className={cn(BTN_SECONDARY, BTN_SM)}>
                                    {uploading
                                        ? <><Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />Uploading…</>
                                        : <><Camera aria-hidden className="h-3.5 w-3.5" />Change photo</>}
                                </button>
                            </div>
                        </div>
                        {photoError && <p role="alert" className="text-xs text-red-300">{photoError}</p>}
                        <div className="flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-line pt-4">
                            <dl className="grid flex-auto grid-cols-[repeat(3,auto)] justify-start gap-x-5 gap-y-2 md:gap-x-7">
                                {([
                                    ['Tournaments run', organizerStats?.totalTournaments],
                                    ['Completed', organizerStats?.completedTournaments],
                                    ['Players hosted', organizerStats?.totalPlayersHosted],
                                ] as const).map(([label, n]) => (
                                    <div key={label}>
                                        <dt className="text-xs text-fg-subtle">{label}</dt>
                                        <dd className="text-lg font-semibold tabular-nums text-fg">{stat(n)}</dd>
                                    </div>
                                ))}
                            </dl>
                            <Link to="/organizer/home" className="inline-flex items-center gap-1.5 rounded-md text-[13px] text-fg-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
                                All tournaments <ArrowRight aria-hidden className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </section>

                    <div className={cn(PANEL, 'px-4 pt-4 sm:px-6')}>
                        <form id="profile-form" onSubmit={handleSave} noValidate>
                            <FormSection title="Personal details" desc="Your name and number, as your staff see them.">
                                <div className="grid gap-x-3 gap-y-4 md:grid-cols-2">
                                    <Field id="pf-first" label="First name" error={err('pf-first')}>
                                        <input id="pf-first" autoComplete="given-name" value={details.firstName} {...invalid('pf-first')}
                                            onChange={e => setDetails(d => ({ ...d, firstName: e.target.value }))} className={cn(INPUT, err('pf-first') && INVALID)} />
                                    </Field>
                                    <Field id="pf-last" label="Last name" error={err('pf-last')}>
                                        <input id="pf-last" autoComplete="family-name" value={details.lastName} {...invalid('pf-last')}
                                            onChange={e => setDetails(d => ({ ...d, lastName: e.target.value }))} className={cn(INPUT, err('pf-last') && INVALID)} />
                                    </Field>
                                    <Field id="pf-phone" label="Mobile" error={err('pf-phone')}>
                                        <input id="pf-phone" type="tel" inputMode="tel" autoComplete="tel" value={details.phone} {...invalid('pf-phone')}
                                            onChange={e => setDetails(d => ({ ...d, phone: e.target.value }))} className={cn(INPUT, err('pf-phone') && INVALID)} />
                                    </Field>
                                    <Field id="pf-email" label="Email" help="You sign in with this.">
                                        <input id="pf-email" type="email" readOnly value={user?.email ?? ''}
                                            className={cn(INPUT, 'border-dashed bg-transparent text-fg-muted hover:border-line')} />
                                    </Field>
                                </div>
                            </FormSection>

                            <FormSection title="Organization" desc="The club, academy or company that runs your tournaments.">
                                <div className="grid gap-4">
                                    <Field id="pf-org" label="Name" error={err('pf-org')}>
                                        <input id="pf-org" autoComplete="organization" value={org.name} {...invalid('pf-org')}
                                            onChange={e => setOrg(o => ({ ...o, name: e.target.value }))} className={cn(INPUT, err('pf-org') && INVALID)} />
                                    </Field>
                                    <Field id="pf-about" label="About" count={`${org.description.length} characters`}>
                                        <textarea id="pf-about" rows={3} value={org.description} className={TEXTAREA}
                                            onChange={e => setOrg(o => ({ ...o, description: e.target.value }))} />
                                    </Field>
                                </div>
                            </FormSection>
                        </form>

                        <FormSection title="Password" desc="Change the password you sign in with.">
                            <form onSubmit={handlePassword} noValidate aria-label="Change password" className="grid gap-4">
                                <Field id="pw-current" label="Current password" error={pwdErrors['pw-current']}>
                                    {pwdInput('pw-current', 'current', 'current-password')}
                                </Field>
                                <div className="grid gap-x-3 gap-y-4 md:grid-cols-2">
                                    <Field id="pw-new" label="New password" error={pwdErrors['pw-new']}>
                                        {pwdInput('pw-new', 'next', 'new-password')}
                                    </Field>
                                    <Field id="pw-confirm" label="Confirm new password" error={pwdErrors['pw-confirm']}>
                                        {pwdInput('pw-confirm', 'confirm', 'new-password')}
                                    </Field>
                                </div>
                                {pwdDone && (
                                    <div role="status">
                                        <Notice tone="neutral" icon={Check} className={TONE.green.badge}>
                                            Password changed. Use the new one next time you sign in.
                                        </Notice>
                                    </div>
                                )}
                                <div className="flex justify-end">
                                    <button type="submit" disabled={pwdBusy} className={BTN_SECONDARY}>
                                        {pwdBusy && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
                                        {pwdBusy ? 'Changing…' : 'Change password'}
                                    </button>
                                </div>
                            </form>
                        </FormSection>

                        <FormSection title="Sign out" desc="End your session on this device.">
                            <button type="button" onClick={handleLogout} className={BTN_SECONDARY}>
                                <LogOut aria-hidden className="h-4 w-4" />Sign out
                            </button>
                        </FormSection>
                    </div>

                    {(dirty || savedMsg) && (
                        <div role="status" className="sticky bottom-4 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-raised py-2.5 pl-4 pr-2.5 text-sm shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-line">
                            {dirty ? (
                                <>
                                    <span className={cn(saveError && 'text-red-300')}>{saveError ?? 'You have unsaved changes'}</span>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={discard} disabled={saving} className={cn(BTN_SECONDARY, BTN_SM)}>Discard</button>
                                        <button type="submit" form="profile-form" disabled={saving} className={cn(BTN_PRIMARY, BTN_SM)}>
                                            {saving && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}{saving ? 'Saving…' : 'Save changes'}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <span className="flex items-center gap-2 py-1 text-fg-muted"><Check aria-hidden className="h-4 w-4 text-emerald-400" />{savedMsg}</span>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default OrganizerProfilePage;
