import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { AlertCircle, CalendarDays, ImagePlus, Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/slices/authSlice';
import { createTournament } from '../../store/slices/tournamentSlice';
import { uploadImage } from '../../api/upload';
import { sportRegistry } from '@/sports/registry';
import { cn } from '@/lib/utils';
import { AccountMenu, BTN_DANGER_SOLID, BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, FOCUS, OrganizerSidebar } from './shared';
import { CHOICE, Field, FormSection, INPUT, INPUT_SM, MoneyInput, Notice, PageHead, Switch, TEXTAREA } from './ui';

// ─── Form model & validation ──────────────────────────────────────────────────

type Pin = { lat: number; lng: number };

type Form = {
    name: string; sports: string[]; description: string; bannerImage: string;
    startDate: string; endDate: string; registrationDeadline: string;
    venue: { name: string; city: string; address: string };
    pin: Pin | null;
    // Kept as typed so an empty box is an error, not a silent 0.
    maxTeams: string; defaultBudget: string;
    auctionType: 'manual' | 'live'; allowLateRegistration: boolean; allowMultiCategoryRegistration: boolean;
};

const BLANK: Form = {
    name: '', sports: ['badminton'], description: '', bannerImage: '',
    startDate: '', endDate: '', registrationDeadline: '',
    venue: { name: '', city: '', address: '' }, pin: null,
    maxTeams: '8', defaultBudget: '100000',
    auctionType: 'manual', allowLateRegistration: false, allowMultiCategoryRegistration: true,
};

// Error key → the control to focus. In page order: the first error gets focus on a failed submit.
const FIELD_IDS = {
    name: 'c-name', sports: 'c-sports', startDate: 'c-start', endDate: 'c-end', registrationDeadline: 'c-deadline',
    venue: 'c-venue', city: 'c-city', maxTeams: 'c-max', defaultBudget: 'c-budget',
} as const;
type ErrKey = keyof typeof FIELD_IDS;

/** The server's create rules (tournament.validator + service), so a bad form never leaves the page. Dates are yyyy-MM-dd. */
const validate = (f: Form, today: string) => {
    const e: Partial<Record<ErrKey, string>> = {};
    if (!f.name.trim()) e.name = 'Give the tournament a name.';
    if (!f.sports.length) e.sports = 'Choose at least one sport.';
    if (!f.startDate) e.startDate = 'Choose a start date.';
    else if (f.startDate <= today) e.startDate = 'The start date must be after today.';
    if (!f.endDate) e.endDate = 'Choose an end date.';
    else if (f.startDate && f.endDate < f.startDate) e.endDate = "The end date can't be before the start.";
    if (!f.registrationDeadline) e.registrationDeadline = 'Choose a deadline.';
    else if (f.startDate && f.registrationDeadline > f.startDate) e.registrationDeadline = 'Registration must close on or before the start date.';
    if (!f.venue.name.trim()) e.venue = 'Enter the venue name.';
    if (!f.venue.city.trim()) e.city = 'Enter the city.';
    if (!/^\d+$/.test(f.maxTeams) || Number(f.maxTeams) < 2) e.maxTeams = 'At least 2 teams.';
    if (!/^\d+$/.test(f.defaultBudget)) e.defaultBudget = 'Use a whole number of rupees.';
    return e;
};

const INPUT_ERR = 'border-red-400/50 hover:border-red-400/60';
const BANNER_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
const MAX_BANNER_BYTES = 5 * 1024 * 1024;
const fileSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const shortDate = (d: string) => format(parseISO(d), 'd MMM');

// ─── Map ──────────────────────────────────────────────────────────────────────

const NOMINATIM = 'https://nominatim.openstreetmap.org';
type Place = { place_id?: number; lat?: string; lon?: string; display_name?: string; address?: Record<string, string> };
const cityOf = (a: Record<string, string> = {}) => a.city || a.town || a.village || a.suburb || a.county || '';
const round6 = (n: number) => Number(n.toFixed(6));
const INDIA: [number, number] = [20.5937, 78.9629];

// Lucide's MapPin in the brand colour, so no marker images are fetched.
const PIN_ICON = L.divIcon({
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 29],
    html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="rgba(249,115,22,0.3)" stroke="#F97316" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>',
});

// Dark map: inverted OSM tiles (markers live in another pane, so the pin keeps its colour) and app-coloured controls.
const MAP_SKIN = [
    '[&_.leaflet-container]:bg-[#14161a]! [&_.leaflet-tile-pane]:[filter:invert(1)_hue-rotate(180deg)_brightness(0.9)_contrast(0.9)]',
    '[&_.leaflet-bar]:border-line! [&_.leaflet-bar_a]:border-line! [&_.leaflet-bar_a]:bg-raised! [&_.leaflet-bar_a]:text-fg!',
    '[&_.leaflet-control-attribution]:bg-canvas/80! [&_.leaflet-control-attribution]:text-fg-subtle! [&_.leaflet-control-attribution_a]:text-fg-muted!',
].join(' ');

const PinLayer = ({ pin, onPick }: { pin: Pin | null; onPick: (p: Pin) => void }) => {
    const toPin = (ll: L.LatLng) => onPick({ lat: round6(ll.lat), lng: round6(ll.lng) });
    const map = useMapEvents({ click: e => toPin(e.latlng) });
    // ponytail: Leaflet renders grey tiles when its container mounts at size 0 (hidden/animated parent). Force a resize once.
    useEffect(() => {
        const t = setTimeout(() => map.invalidateSize(), 250);
        return () => clearTimeout(t);
    }, [map]);
    useEffect(() => {
        if (pin) map.flyTo([pin.lat, pin.lng], Math.max(map.getZoom(), 14), { duration: 1.2 });
    }, [pin?.lat, pin?.lng]);
    return pin && <Marker position={[pin.lat, pin.lng]} icon={PIN_ICON} draggable eventHandlers={{ dragend: e => toPin(e.target.getLatLng()) }} />;
};

/** Search, "Use my location", the map itself and the coordinates readout. `place` comes with a search pick. */
const VenueMap = ({ pin, onChange }: { pin: Pin | null; onChange: (pin: Pin | null, place?: Place) => void }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Place[] | null>(null);
    const [searching, setSearching] = useState(false);
    const [locating, setLocating] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    // On touch screens the map ignores gestures until tapped, so swiping past it scrolls the page.
    // ponytail: once tapped it stays live; re-lock on scroll-away if organizers find it grabby.
    const [live, setLive] = useState(() => !window.matchMedia?.('(pointer: coarse)').matches);
    const justPicked = useRef(false);

    // Debounced Nominatim autocomplete. 500ms respects the free tier's ~1 req/s policy.
    useEffect(() => {
        const q = query.trim();
        if (justPicked.current || q.length < 3) { justPicked.current = false; setResults(null); return; }
        setSearching(true);
        const ctrl = new AbortController();
        const t = setTimeout(() => {
            fetch(`${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=8&accept-language=en&q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
                .then(r => (r.ok ? r.json() : Promise.reject(r)))
                .then(d => { setResults(Array.isArray(d) ? d : []); setMessage(null); })
                .catch(() => { if (!ctrl.signal.aborted) { setResults(null); setMessage("Search isn't working right now. Click the map to place the pin instead."); } })
                .finally(() => { if (!ctrl.signal.aborted) setSearching(false); });
        }, 500);
        return () => { clearTimeout(t); ctrl.abort(); setSearching(false); };
    }, [query]);

    const pick = (r: Place) => {
        justPicked.current = true;
        setQuery(r.display_name ?? '');
        setResults(null);
        onChange({ lat: round6(Number(r.lat)), lng: round6(Number(r.lon)) }, r);
    };

    const locate = () => {
        const failed = "Couldn't get your location. Search for the venue or click the map instead.";
        if (!navigator.geolocation) { setMessage(failed); return; }
        setLocating(true);
        setMessage(null);
        navigator.geolocation.getCurrentPosition(
            p => { setLocating(false); onChange({ lat: round6(p.coords.latitude), lng: round6(p.coords.longitude) }); },
            () => { setLocating(false); setMessage(failed); },
            { timeout: 15000 },
        );
    };

    return (
        <div className="rounded-[10px] border border-line">
            <div className="flex flex-wrap gap-2 rounded-t-[10px] border-b border-line bg-canvas p-2">
                <div className="relative min-w-0 flex-1 basis-56"
                    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setResults(null); }}>
                    <label>
                        <span className="sr-only">Search for a place</span>
                        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
                        <input type="search" value={query} placeholder="Search venue, area or landmark" autoComplete="off"
                            className={cn(INPUT_SM, 'w-full bg-panel pl-8 pr-8')}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter') { e.preventDefault(); if (results?.[0]) pick(results[0]); }
                                if (e.key === 'Escape' && results) { e.preventDefault(); setResults(null); }
                            }} />
                    </label>
                    {searching && <Loader2 aria-hidden className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-fg-subtle" />}
                    {results && (
                        <ul data-lenis-prevent className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-line bg-raised p-1 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
                            {results.length ? results.map((r, i) => (
                                <li key={r.place_id ?? i}>
                                    <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => pick(r)}
                                        className={cn('flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-[13px] text-fg-muted transition-colors hover:bg-white/[0.05] hover:text-fg', FOCUS)}>
                                        <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                                        <span className="leading-snug">{r.display_name}</span>
                                    </button>
                                </li>
                            )) : (
                                <li className="px-2.5 py-2 text-[13px] text-fg-muted">No matches. Try a nearby landmark, then drag the pin to the exact spot.</li>
                            )}
                        </ul>
                    )}
                </div>
                <button type="button" onClick={locate} disabled={locating} className={cn(BTN_SECONDARY, BTN_SM)}>
                    {locating ? <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed aria-hidden className="h-3.5 w-3.5" />}
                    Use my location
                </button>
                {message && <p role="status" className="w-full px-0.5 text-xs text-amber-300">{message}</p>}
            </div>
            <div data-lenis-prevent className={cn('relative isolate h-56', MAP_SKIN)}>
                <MapContainer center={pin ? [pin.lat, pin.lng] : INDIA} zoom={pin ? 14 : 4} className="h-full w-full">
                    <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <PinLayer pin={pin} onPick={p => onChange(p)} />
                </MapContainer>
                {!live && (
                    <button type="button" onClick={() => setLive(true)}
                        className={cn('absolute inset-0 z-[1001] flex items-end justify-center pb-3', FOCUS)}>
                        <span className="rounded-md bg-canvas/90 px-2.5 py-1 text-xs text-fg-muted ring-1 ring-line">Tap to use the map</span>
                    </button>
                )}
            </div>
            <div className="flex min-h-11 flex-wrap rounded-b-[10px] items-center justify-between gap-2 border-t border-line bg-canvas px-3 py-2 text-xs text-fg-subtle">
                <span className="tabular-nums">{pin ? `${pin.lat.toFixed(6)}, ${pin.lng.toFixed(6)}` : 'No pin'}</span>
                {pin && <button type="button" onClick={() => onChange(null)} className={cn(BTN_GHOST, BTN_SM, 'h-7')}>Remove pin</button>}
            </div>
        </div>
    );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const CreateTournamentPage = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user } = useAppSelector(s => s.auth);
    const isStaff = user?.role === 'staff';
    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Organizer';

    const [form, setForm] = useState<Form>(BLANK);
    const [tried, setTried] = useState(false);
    const [creating, setCreating] = useState(false);
    const [serverError, setServerError] = useState<string | null>(null);
    const [discarding, setDiscarding] = useState(false);
    const [banner, setBanner] = useState<{ name: string; size: number } | null>(null);
    const [bannerError, setBannerError] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const bannerInput = useRef<HTMLInputElement>(null);
    const errorRef = useRef<HTMLDivElement>(null);
    // Which venue fields the map filled in: only those follow the pin when it moves.
    const fromMap = useRef({ city: false, address: false });
    // Only the latest reverse-geocode may fill the venue.
    const geoSeq = useRef(0);

    useEffect(() => { if (serverError) errorRef.current?.focus(); }, [serverError]);

    const today = format(new Date(), 'yyyy-MM-dd');
    const allErrors = validate(form, today);
    const errors = tried ? allErrors : {};
    const errCount = Object.keys(errors).length;
    const dirty = JSON.stringify(form) !== JSON.stringify(BLANK);
    const scheduleOk = !allErrors.startDate && !allErrors.endDate && !allErrors.registrationDeadline;
    const days = scheduleOk ? differenceInCalendarDays(parseISO(form.endDate), parseISO(form.startDate)) + 1 : 0;

    const set = (patch: Partial<Form>) => setForm(f => ({ ...f, ...patch }));
    const setVenue = (patch: Partial<Form['venue']>) => setForm(f => ({ ...f, venue: { ...f.venue, ...patch } }));
    const control = (k: ErrKey) => ({ className: cn(INPUT, errors[k] && INPUT_ERR), 'aria-invalid': errors[k] ? true : undefined });

    const fillFromMap = (place: Place) => setForm(f => {
        const venue = { ...f.venue };
        const city = cityOf(place.address), address = place.display_name ?? '';
        if (city && (!venue.city.trim() || fromMap.current.city)) { venue.city = city; fromMap.current.city = true; }
        if (address && (!venue.address.trim() || fromMap.current.address)) { venue.address = address; fromMap.current.address = true; }
        return { ...f, venue };
    });

    const placePin = (pin: Pin | null, place?: Place) => {
        const seq = ++geoSeq.current;
        set({ pin });
        if (!pin) return;
        if (place) { fillFromMap(place); return; }
        // Best effort: a failed lookup just leaves the venue fields as they are.
        fetch(`${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&accept-language=en&lat=${pin.lat}&lon=${pin.lng}`)
            .then(r => (r.ok ? r.json() : Promise.reject(r)))
            .then((p: Place) => { if (seq === geoSeq.current) fillFromMap(p); })
            .catch(() => {});
    };

    const pickBanner = async (file?: File) => {
        if (!file) return;
        if (!BANNER_TYPES.includes(file.type)) { setBannerError('Use a PNG, JPG or GIF image.'); return; }
        if (file.size > MAX_BANNER_BYTES) { setBannerError('That image is over 5 MB. Choose a smaller one.'); return; }
        setBannerError(null);
        setUploading(true);
        try {
            const url = await uploadImage(file, 'tournament-banners');
            set({ bannerImage: url });
            setBanner({ name: file.name, size: file.size });
        } catch {
            setBannerError("Couldn't upload the image. Try again.");
        } finally {
            setUploading(false);
        }
    };

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        if (creating) return;
        setTried(true);
        const first = Object.keys(validate(form, today))[0] as ErrKey | undefined;
        if (first) {
            const el = document.getElementById(FIELD_IDS[first]);
            (el instanceof HTMLInputElement ? el : el?.querySelector('input'))?.focus();
            return;
        }
        setCreating(true);
        setServerError(null);
        const result = await dispatch(createTournament({
            name: form.name.trim(),
            description: form.description.trim(),
            sports: form.sports,
            bannerImage: form.bannerImage,
            startDate: form.startDate,
            endDate: form.endDate,
            registrationDeadline: form.registrationDeadline,
            venue: {
                name: form.venue.name.trim(),
                city: form.venue.city.trim(),
                address: form.venue.address.trim(),
                ...(form.pin ? { coordinates: form.pin } : {}),
            },
            settings: {
                maxTeams: Number(form.maxTeams),
                defaultBudget: Number(form.defaultBudget),
                auctionType: form.auctionType,
                allowLateRegistration: form.allowLateRegistration,
                allowMultiCategoryRegistration: form.allowMultiCategoryRegistration,
            },
        }));
        if (createTournament.fulfilled.match(result)) {
            navigate(`/organizer/tournament/${result.payload._id}`);
            return;
        }
        setServerError((result.payload as string | undefined) || result.error.message || 'Something went wrong.');
        setCreating(false);
    };

    const handleLogout = () => { dispatch(logout()); navigate('/login'); };

    return (
        <div className="min-h-screen bg-canvas font-ui text-fg antialiased">
            <OrganizerSidebar isStaff={isStaff} />

            <div className="md:pl-16 lg:pl-60">
                <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/95 px-4 sm:px-6 lg:px-8">
                    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-sm text-fg-muted">
                        <Link to="/organizer/home" className={cn('rounded hover:text-fg', FOCUS)}>Tournaments</Link>
                        <span aria-hidden className="text-fg-subtle">/</span>
                        <span aria-current="page" className="truncate text-fg">New tournament</span>
                    </nav>
                    <AccountMenu name={fullName} email={user?.email} image={user?.profileImage} onLogout={handleLogout} />
                </header>

                <main className="mx-auto max-w-6xl space-y-6 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
                    <PageHead title="New tournament" desc="Add the basics now. Categories, entry fees and teams come after it's created." />
                    {serverError && (
                        <div ref={errorRef} tabIndex={-1} role="alert" className="focus:outline-none">
                            <Notice tone="red" icon={AlertCircle}>Couldn't create the tournament: {serverError}</Notice>
                        </div>
                    )}

                    <form onSubmit={submit} noValidate>
                        <FormSection title="General" desc="The name, sports and description players see when they find this tournament.">
                            <div className="grid gap-4">
                                <Field id="c-name" label="Tournament name" count={`${form.name.length}/100`} error={errors.name}>
                                    <input id="c-name" maxLength={100} placeholder="e.g. KRIA Summer Smash 2026" {...control('name')}
                                        value={form.name} onChange={e => set({ name: e.target.value })} />
                                </Field>
                                <Field label="Sports" error={errors.sports} help="Pick every sport this tournament will have categories for.">
                                    <div id="c-sports" role="group" aria-label="Sports" className="flex flex-wrap gap-2">
                                        {sportRegistry.list().map(p => (
                                            <label key={p.sportKey} className={cn(CHOICE, 'h-8 items-center px-3 py-0 text-[13px]')}>
                                                <input type="checkbox" className="accent-primary" checked={form.sports.includes(p.sportKey)}
                                                    onChange={e => set({ sports: e.target.checked ? [...form.sports, p.sportKey] : form.sports.filter(x => x !== p.sportKey) })} />
                                                {p.displayName}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                                <Field id="c-desc" label="Description" count={`${form.description.length}/2000`}
                                    help="Prizes, format, anything players should know before they enter.">
                                    <textarea id="c-desc" rows={4} maxLength={2000} className={TEXTAREA}
                                        value={form.description} onChange={e => set({ description: e.target.value })} />
                                </Field>
                                <Field id="c-banner" label="Banner image" error={bannerError}
                                    help="PNG, JPG or GIF, up to 5 MB. Wide images work best, about 1600 × 600.">
                                    <input ref={bannerInput} id="c-banner" type="file" accept="image/png,image/jpeg,image/gif" className="hidden"
                                        onChange={e => { pickBanner(e.target.files?.[0]); e.target.value = ''; }} />
                                    <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
                                        onDrop={e => { e.preventDefault(); setDragOver(false); if (!uploading) pickBanner(e.dataTransfer.files[0]); }}>
                                        {form.bannerImage ? (
                                            <div className={cn('overflow-hidden rounded-[10px] border', dragOver ? 'border-primary/60' : 'border-line')}>
                                                <img src={form.bannerImage} alt="Banner preview" className="h-32 w-full object-cover" />
                                                <div className="flex items-center justify-between gap-2 bg-canvas px-3 py-2 text-[13px] text-fg-muted">
                                                    <span className="truncate">{banner ? `${banner.name} · ${fileSize(banner.size)}` : 'Banner image'}</span>
                                                    <span className="flex gap-1">
                                                        <button type="button" onClick={() => bannerInput.current?.click()} disabled={uploading} className={cn(BTN_GHOST, BTN_SM)}>
                                                            {uploading && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}{uploading ? 'Uploading…' : 'Replace'}
                                                        </button>
                                                        <button type="button" aria-label="Remove banner" disabled={uploading} className={cn(BTN_GHOST, BTN_SM)}
                                                            onClick={() => { set({ bannerImage: '' }); setBanner(null); }}>Remove</button>
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => bannerInput.current?.click()} disabled={uploading}
                                                className={cn('flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-white/15 bg-canvas text-[13px] text-fg-muted transition-colors hover:border-white/25 hover:text-fg disabled:cursor-wait', FOCUS,
                                                    dragOver && 'border-primary/60 text-fg', bannerError && 'border-red-400/50')}>
                                                {uploading ? (
                                                    <><Loader2 aria-hidden className="h-5 w-5 animate-spin" /><span>Uploading…</span></>
                                                ) : (
                                                    <><ImagePlus aria-hidden className="h-5 w-5" /><span><span className="text-fg">Drop an image</span> or browse</span></>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </Field>
                            </div>
                        </FormSection>

                        <FormSection title="Schedule" desc="Registration closes at the end of the deadline day.">
                            <div className="grid gap-4 sm:grid-cols-3">
                                <Field id="c-start" label="Start date" error={errors.startDate}>
                                    <input id="c-start" type="date" min={format(addDays(new Date(), 1), 'yyyy-MM-dd')} {...control('startDate')}
                                        value={form.startDate} onChange={e => set({ startDate: e.target.value })} />
                                </Field>
                                <Field id="c-end" label="End date" error={errors.endDate}>
                                    <input id="c-end" type="date" min={form.startDate || undefined} {...control('endDate')}
                                        value={form.endDate} onChange={e => set({ endDate: e.target.value })} />
                                </Field>
                                <Field id="c-deadline" label="Registration deadline" error={errors.registrationDeadline}>
                                    <input id="c-deadline" type="date" max={form.startDate || undefined} {...control('registrationDeadline')}
                                        value={form.registrationDeadline} onChange={e => set({ registrationDeadline: e.target.value })} />
                                </Field>
                            </div>
                            {scheduleOk && (
                                <p className="mt-3 flex items-center gap-2 text-[13px] text-fg-muted">
                                    <CalendarDays aria-hidden className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
                                    Entries close {shortDate(form.registrationDeadline)} · play runs {shortDate(form.startDate)} – {shortDate(form.endDate)} ({days} {days === 1 ? 'day' : 'days'})
                                </p>
                            )}
                        </FormSection>

                        <FormSection title="Venue" desc="Where matches are played. The pin helps players find it.">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field id="c-venue" label="Venue name" className="sm:col-span-2" error={errors.venue}>
                                    <input id="c-venue" placeholder="e.g. Kanteerava Indoor Stadium" {...control('venue')}
                                        value={form.venue.name} onChange={e => setVenue({ name: e.target.value })} />
                                </Field>
                                <Field id="c-city" label="City" error={errors.city}>
                                    <input id="c-city" {...control('city')} value={form.venue.city}
                                        onChange={e => { fromMap.current.city = false; setVenue({ city: e.target.value }); }} />
                                </Field>
                                <Field id="c-address" label="Full address">
                                    <input id="c-address" placeholder="Optional" className={INPUT} value={form.venue.address}
                                        onChange={e => { fromMap.current.address = false; setVenue({ address: e.target.value }); }} />
                                </Field>
                                <Field label="Map pin" className="sm:col-span-2"
                                    help={form.pin ? 'Moving the pin updates the city and address if they came from the map.' : 'Optional. Search for the venue or click the map.'}>
                                    <VenueMap pin={form.pin} onChange={placePin} />
                                </Field>
                            </div>
                        </FormSection>

                        <FormSection title="Teams and auction" desc="Limits and defaults used when teams are created and the auction runs. You can change these later in Settings.">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <Field id="c-max" label="Maximum teams" error={errors.maxTeams}>
                                    <input id="c-max" type="number" min={2} inputMode="numeric" {...control('maxTeams')}
                                        value={form.maxTeams} onChange={e => set({ maxTeams: e.target.value })} />
                                </Field>
                                <Field id="c-budget" label="Auction budget per team" error={errors.defaultBudget} help="Default for new teams. You can change it per team.">
                                    <MoneyInput id="c-budget" step={1000} value={form.defaultBudget} invalid={!!errors.defaultBudget}
                                        onChange={v => set({ defaultBudget: v })} />
                                </Field>
                                <Field label="Auction type" className="sm:col-span-2">
                                    <div role="radiogroup" aria-label="Auction type" className="grid gap-2 sm:grid-cols-2">
                                        {([
                                            { value: 'manual', title: 'Manual', text: 'Offline draft. You record each pick.' },
                                            { value: 'live', title: 'Live', text: 'Interactive auction run live on KRIA.' },
                                        ] as const).map(o => (
                                            <label key={o.value} className={CHOICE}>
                                                <input type="radio" name="auctionType" className="mt-0.5 accent-primary"
                                                    checked={form.auctionType === o.value} onChange={() => set({ auctionType: o.value })} />
                                                <span>
                                                    <span className="block text-sm font-medium text-fg">{o.title}</span>
                                                    <span className="mt-0.5 block text-[13px] text-fg-muted">{o.text}</span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                            </div>
                        </FormSection>

                        <FormSection title="Registration" desc="Who can enter, and when.">
                            <div className="grid gap-2">
                                <Switch id="c-late" label="Allow late registration" description="Accept entries after the registration deadline."
                                    checked={form.allowLateRegistration} onChange={v => set({ allowLateRegistration: v })} />
                                <Switch id="c-multi" label="Allow entries in more than one category" description="A player can register for, say, singles and doubles."
                                    checked={form.allowMultiCategoryRegistration} onChange={v => set({ allowMultiCategoryRegistration: v })} />
                            </div>
                        </FormSection>

                        <div role="status" className="sticky bottom-4 z-10 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-raised py-2.5 pl-4 pr-2.5 text-sm shadow-[0_12px_32px_rgba(0,0,0,0.5)] ring-1 ring-line">
                            {discarding ? (
                                <>
                                    <span>Discard this tournament? Nothing has been saved yet.</span>
                                    <div className="flex gap-2">
                                        <button type="button" autoFocus onClick={() => setDiscarding(false)} className={cn(BTN_SECONDARY, BTN_SM)}>Keep editing</button>
                                        <button type="button" onClick={() => navigate('/organizer/home')} className={cn(BTN_DANGER_SOLID, BTN_SM)}>Discard</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <span className={errCount ? 'text-amber-300' : 'text-fg-muted'}>
                                        {errCount
                                            ? `Fix ${errCount} ${errCount === 1 ? 'field' : 'fields'} to create the tournament.`
                                            : "It's saved as a draft. Players can't see it until you open registration."}
                                    </span>
                                    <div className="flex gap-2">
                                        <button type="button" disabled={creating} className={cn(BTN_SECONDARY, BTN_SM)}
                                            onClick={() => (dirty ? setDiscarding(true) : navigate('/organizer/home'))}>Cancel</button>
                                        <button type="submit" disabled={creating || uploading} className={cn(BTN_PRIMARY, BTN_SM)}>
                                            {creating && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}
                                            {creating ? 'Creating…' : 'Create tournament'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </form>
                </main>
            </div>
        </div>
    );
};

export default CreateTournamentPage;
