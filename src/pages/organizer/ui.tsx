// Interactive building blocks for the organizer tournament sections: page header, tabs,
// drawers, dialogs, menus, inline confirmations and form controls. Pair with ./shared.
import { createContext, ReactNode, useContext, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, LucideIcon, MoreHorizontal, Search, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getAppLenis } from '@/context/LenisContext';
import { cn } from '@/lib/utils';
import { BTN_DANGER_SOLID, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, FOCUS, initials, statusOf, Tone, TONE } from './shared';

// ─── Section navigation ───────────────────────────────────────────────────────

/** Lets a section send the organizer to another section of the tournament page (e.g. Brackets → Team league). */
export const SectionNavContext = createContext<(section: string) => void>(() => {});
export const useSectionNav = () => useContext(SectionNavContext);

/** True inside a section of a completed or cancelled tournament: hide every action that changes data. */
export const ReadOnlyContext = createContext(false);
export const useReadOnly = () => useContext(ReadOnlyContext);

// ─── Surfaces & text ──────────────────────────────────────────────────────────

export const PANEL = 'rounded-xl border border-line bg-panel';
/** Responsive list rows: give the row `grid-cols-[...]` per breakpoint; hide cells with `hidden xl:block` etc. */
export const ROW = 'grid items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5';
export const COLHEAD = 'gap-x-4 border-b border-line px-5 py-2 text-xs font-medium text-fg-subtle';

export const PageHead = ({ title, desc, actions }: { title: string; desc?: ReactNode; actions?: ReactNode }) => (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-tight text-fg font-ui!">{title}</h1>
            {desc && <p className="mt-1 max-w-[62ch] text-sm text-fg-muted">{desc}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
);

export const Notice = ({ tone, icon: Icon, children, className }: {
    tone: 'red' | 'amber' | 'blue' | 'neutral'; icon: LucideIcon; children: ReactNode; className?: string;
}) => (
    <div className={cn('flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed ring-1 ring-inset', {
        red: 'bg-red-400/10 text-red-300 ring-red-400/25',
        amber: 'bg-amber-400/10 text-amber-300 ring-amber-400/20',
        blue: 'bg-sky-400/10 text-sky-300 ring-sky-400/20',
        neutral: 'bg-white/[0.04] text-fg-muted ring-white/10',
    }[tone], className)}>
        <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">{children}</div>
    </div>
);

export const EmptyState = ({ title, text, action }: { title: string; text?: ReactNode; action?: ReactNode }) => (
    <div className="px-6 py-12 text-center">
        <p className="text-sm font-medium text-fg">{title}</p>
        {text && <p className="mx-auto mt-1 max-w-[42ch] text-[13.5px] leading-relaxed text-fg-muted">{text}</p>}
        {action && <div className="mt-4 flex justify-center gap-2">{action}</div>}
    </div>
);

export const Spinner = ({ label = 'Loading' }: { label?: string }) => (
    <div role="status" className="flex justify-center py-12">
        <Loader2 aria-hidden className="h-5 w-5 animate-spin text-fg-subtle" />
        <span className="sr-only">{label}</span>
    </div>
);

export const Avatar = ({ name, src, size = 'md' }: { name: string; src?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) => {
    const box = { sm: 'h-6 w-6 text-[10px]', md: 'h-8 w-8 text-xs', lg: 'h-9 w-9 text-[13px]', xl: 'h-14 w-14 text-base' }[size];
    return src
        ? <img src={src} alt="" className={cn('shrink-0 rounded-full object-cover ring-1 ring-line', box)} />
        : <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full bg-raised font-semibold text-fg-muted ring-1 ring-inset ring-line', box)}>{initials(name)}</span>;
};

/** A team's logo, or its initials on the team colour. */
export const TeamLogo = ({ name, logo, color, size = 'md' }: { name: string; logo?: string; color?: string; size?: 'sm' | 'md' | 'lg' }) => {
    const box = { sm: 'h-6 w-6 rounded-md text-[10px]', md: 'h-10 w-10 rounded-[10px] text-[13px]', lg: 'h-13 w-13 rounded-xl text-base' }[size];
    return logo
        ? <img src={logo} alt="" className={cn('shrink-0 object-cover ring-1 ring-line', box)} />
        : <span aria-hidden className={cn('flex shrink-0 items-center justify-center font-bold text-canvas', box)} style={{ background: color || '#71717A' }}>{initials(name)}</span>;
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export type TabItem<K extends string> = { key: K; label: string; count?: number; hot?: boolean };

/** Segmented filter. `hot` tints a non-zero count amber (e.g. items waiting for review). */
export function SegTabs<K extends string>({ items, value, onChange, label, className }: {
    items: TabItem<K>[]; value: K; onChange: (k: K) => void; label: string; className?: string;
}) {
    return (
        <div role="group" aria-label={label}
            className={cn('flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-canvas p-0.5 ring-1 ring-inset ring-line [scrollbar-width:none]', className)}>
            {items.map(it => (
                <button key={it.key} type="button" aria-pressed={value === it.key} onClick={() => onChange(it.key)}
                    className={cn('inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors', FOCUS,
                        value === it.key ? 'bg-white/10 text-fg' : 'text-fg-muted hover:text-fg')}>
                    {it.label}
                    {it.count != null && <span className={cn('text-xs tabular-nums', it.hot && it.count ? 'text-amber-300' : 'text-fg-subtle')}>{it.count}</span>}
                </button>
            ))}
        </div>
    );
}

/** Card-style category switcher used by Brackets, Matches and Team league. */
export const CategoryTabs = ({ categories, value, onChange }: {
    /** `tone` adds a status dot before the meta line (pulsing when `live`). */
    categories: { _id: string; name: string; meta?: string; tone?: Tone; live?: boolean }[]; value: string; onChange: (id: string) => void;
}) => (
    <div role="tablist" aria-label="Category" className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
        {categories.map(c => (
            <button key={c._id} type="button" role="tab" aria-selected={value === c._id} onClick={() => onChange(c._id)}
                className={cn('flex min-w-[150px] shrink-0 flex-col items-start gap-0.5 rounded-[10px] px-3 py-2 text-left ring-1 ring-inset transition-colors', FOCUS,
                    value === c._id ? 'bg-primary/[0.06] ring-primary/60' : 'bg-panel ring-line hover:ring-white/20')}>
                <span className="text-[13px] font-medium text-fg">{c.name}</span>
                {c.meta && (
                    <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
                        {c.tone && <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', TONE[c.tone].dot, c.live && 'animate-pulse')} />}
                        {c.meta}
                    </span>
                )}
            </button>
        ))}
    </div>
);

/** "Knockout · Bracket ready" style meta line for CategoryTabs. */
export const categoryMeta = (format: string | undefined, status: string) =>
    [format ? ({ knockout: 'Knockout', league: 'League', hybrid: 'Groups + knockout', team_league: 'Team league' } as Record<string, string>)[format] ?? format : '', statusOf(status).label]
        .filter(Boolean).join(' · ');

// ─── Confirmations & menus ────────────────────────────────────────────────────

/** Inline yes/no bar shown under the row or panel it affects. Focuses the safe choice. */
export const ConfirmBar = ({ message, confirmLabel, cancelLabel = 'Not now', onConfirm, onCancel, danger, busy, className }: {
    message: ReactNode; confirmLabel: string; cancelLabel?: string; onConfirm: () => void; onCancel: () => void;
    danger?: boolean; busy?: boolean; className?: string;
}) => (
    <div role="alertdialog" aria-label={confirmLabel}
        className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-line bg-raised px-4 py-2.5 text-[13px] text-fg-muted sm:px-5', className)}>
        <span className="mr-auto min-w-0">{message}</span>
        <button type="button" autoFocus onClick={onCancel} disabled={busy} className={cn(BTN_SECONDARY, BTN_SM)}>{cancelLabel}</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={cn(danger ? BTN_DANGER_SOLID : BTN_PRIMARY, BTN_SM)}>
            {busy && <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />}{confirmLabel}
        </button>
    </div>
);

export type MenuItem = { label: string; icon?: LucideIcon; onSelect: () => void; danger?: boolean; disabled?: boolean } | 'separator';

/** "⋯" overflow menu for a row's secondary actions. */
export const MoreMenu = ({ items, label = 'More actions', side = 'bottom' }: { items: MenuItem[]; label?: string; side?: 'top' | 'bottom' }) => {
    const [open, setOpen] = useState(false);
    if (!items.some(i => i !== 'separator')) return null;
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger aria-label={label} className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-white/[0.05] hover:text-fg', FOCUS)}>
                <MoreHorizontal aria-hidden className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent align="end" side={side} sideOffset={4} className="z-[70] w-56 rounded-[10px] border-line bg-raised p-1 font-ui">
                <div role="menu" aria-label={label}>
                    {items.map((it, i) => it === 'separator' ? <div key={i} className="my-1 h-px bg-line" /> : (
                        <button key={it.label} type="button" role="menuitem" disabled={it.disabled}
                            onClick={() => { setOpen(false); it.onSelect(); }}
                            className={cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] text-fg-muted transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.06] focus-visible:outline-none disabled:opacity-50',
                                it.danger ? 'hover:text-red-300 focus-visible:text-red-300' : 'hover:text-fg focus-visible:text-fg')}>
                            {it.icon && <it.icon aria-hidden className="h-3.5 w-3.5 shrink-0" />}{it.label}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
};

// ─── Drawer & dialog ──────────────────────────────────────────────────────────

// Open overlays, innermost last: only the top one handles Escape/Tab, and page scroll
// is paused while any is open (a dialog can open on top of a dialog or drawer).
const overlayStack: object[] = [];
let savedOverflow = '';

/** Escape to close, initial focus, a simple focus trap, focus restore, and paused page scroll. */
function useOverlay(ref: React.RefObject<HTMLElement>, onClose: () => void) {
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        const token = {};
        const previous = document.activeElement as HTMLElement | null;
        const el = ref.current;
        const focusables = () => Array.from(el?.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? []);
        (el?.querySelector<HTMLElement>('[autofocus], [data-autofocus]') ?? focusables().find(f => f.dataset.overlayClose === undefined) ?? el)?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (overlayStack[overlayStack.length - 1] !== token) return;
            // An open "⋯" menu (Radix popper) takes this Escape; the overlay closes on the next one.
            if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('[data-radix-popper-content-wrapper]')) {
                e.preventDefault();
                close.current();
            }
            if (e.key !== 'Tab' || !el) return;
            const f = focusables();
            if (!f.length) return;
            if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
            else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
        };
        if (!overlayStack.length) {
            getAppLenis()?.stop();
            savedOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        overlayStack.push(token);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            overlayStack.splice(overlayStack.indexOf(token), 1);
            if (!overlayStack.length) {
                getAppLenis()?.start();
                document.body.style.overflow = savedOverflow;
            }
            previous?.focus?.();
        };
    }, [ref]);
}

const OverlayHead = ({ id, title, description, onClose }: { id: string; title: ReactNode; description?: ReactNode; onClose: () => void }) => (
    <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
            <h2 id={id} className="text-base font-semibold text-fg">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
        </div>
        <button type="button" data-overlay-close aria-label="Close" onClick={onClose}
            className={cn('-mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-muted hover:bg-white/[0.05] hover:text-fg', FOCUS)}>
            <X aria-hidden className="h-4 w-4" />
        </button>
    </header>
);

type OverlayProps = { title: ReactNode; description?: ReactNode; onClose: () => void; footer?: ReactNode; wide?: boolean; children: ReactNode };

/** Right-hand panel for create/edit forms and detail views. Full width on phones. */
export const Drawer = ({ title, description, onClose, footer, wide, children }: OverlayProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const id = useId();
    useOverlay(ref, onClose);
    return createPortal(
        <div className="fixed inset-0 z-[60] font-ui text-fg">
            <div aria-hidden onClick={onClose} className="absolute inset-0 bg-black/60" />
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
                className={cn('absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-panel shadow-[-24px_0_48px_rgba(0,0,0,0.5)] focus:outline-none', wide ? 'sm:w-[600px]' : 'sm:w-[480px]')}>
                <OverlayHead id={id} title={title} description={description} onClose={onClose} />
                <div data-lenis-prevent className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
                {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
            </div>
        </div>,
        document.body,
    );
};

/** Centered dialog for short decisions and score entry. */
export const Dialog = ({ title, description, onClose, footer, wide, children }: OverlayProps) => {
    const ref = useRef<HTMLDivElement>(null);
    const id = useId();
    useOverlay(ref, onClose);
    return createPortal(
        <div className="fixed inset-0 z-[60] font-ui text-fg">
            <div aria-hidden onClick={onClose} className="absolute inset-0 bg-black/60" />
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
                className={cn('absolute left-1/2 top-[8vh] flex max-h-[84vh] w-[calc(100%-32px)] -translate-x-1/2 flex-col rounded-2xl border border-line bg-panel shadow-[0_24px_64px_rgba(0,0,0,0.6)] focus:outline-none', wide ? 'max-w-[880px]' : 'max-w-[460px]')}>
                <OverlayHead id={id} title={title} description={description} onClose={onClose} />
                <div data-lenis-prevent className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
                {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer>}
            </div>
        </div>,
        document.body,
    );
};

// ─── Form controls ────────────────────────────────────────────────────────────

export const INPUT = cn(
    'h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm text-fg [color-scheme:dark] transition-colors',
    'placeholder:text-fg-subtle hover:border-white/15 focus:border-white/20 disabled:cursor-not-allowed disabled:opacity-60', FOCUS,
);
export const TEXTAREA = cn(INPUT, 'h-auto min-h-24 resize-y py-2.5 leading-relaxed');
/** Compact control for toolbars (search, filter selects). */
export const INPUT_SM = cn('h-8 min-w-0 rounded-lg border border-line bg-canvas px-2.5 text-[13px] text-fg [color-scheme:dark] transition-colors placeholder:text-fg-subtle hover:border-white/15 focus:border-white/20', FOCUS);
/** Selectable card for radio/checkbox choices. */
export const CHOICE = cn(
    'flex cursor-pointer items-start gap-2.5 rounded-[10px] bg-canvas p-3 ring-1 ring-inset ring-line transition-colors',
    'has-[input:checked]:bg-primary/[0.06] has-[input:checked]:ring-primary/55 has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60',
);

export const Field = ({ id, label, help, error, count, className, children }: {
    id?: string; label: ReactNode; help?: ReactNode; error?: ReactNode; count?: string; className?: string; children: ReactNode;
}) => (
    <div className={cn('grid min-w-0 content-start gap-1.5', className)}>
        <div className="flex justify-between gap-2 text-[13px] font-medium text-fg-muted">
            {id ? <label htmlFor={id}>{label}</label> : <span>{label}</span>}
            {count && <span className="font-normal tabular-nums text-fg-subtle">{count}</span>}
        </div>
        {children}
        {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : help && <p className="text-xs text-fg-subtle">{help}</p>}
    </div>
);

/** Titled group of fields inside a drawer form. */
export const FormGroup = ({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) => (
    <section className="grid gap-3 border-t border-line pt-5 first:border-t-0 first:pt-0">
        <div>
            <h3 className="text-sm font-semibold text-fg">{title}</h3>
            {description && <p className="mt-0.5 text-[13px] text-fg-muted">{description}</p>}
        </div>
        {children}
    </section>
);

export const Switch = ({ id, label, description, checked, onChange, disabled }: {
    id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) => (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 rounded-[10px] bg-canvas p-3 ring-1 ring-inset ring-line has-[input:disabled]:cursor-not-allowed has-[input:disabled]:opacity-60">
        <span>
            <span className="block text-sm font-medium text-fg">{label}</span>
            {description && <span className="mt-0.5 block text-[13px] text-fg-muted">{description}</span>}
        </span>
        <span className="relative inline-flex h-5 w-9 shrink-0">
            <input id={id} type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled}
                onChange={e => onChange(e.target.checked)} />
            <span aria-hidden className="absolute inset-0 rounded-full bg-line transition-colors peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary/70" />
            <span aria-hidden className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-fg transition-transform peer-checked:translate-x-4" />
        </span>
    </label>
);

/** Small set of mutually exclusive options shown side by side (radio group). */
export function Segmented<V extends string | number>({ name, label, value, options, onChange, disabled }: {
    name: string; label: string; value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; disabled?: boolean;
}) {
    return (
        <div role="radiogroup" aria-label={label} className="flex rounded-lg bg-canvas p-0.5 ring-1 ring-inset ring-line">
            {options.map(o => (
                <label key={String(o.value)}
                    className="relative flex-1 cursor-pointer rounded-md px-2 py-1.5 text-center text-[13px] text-fg-muted transition-colors has-[input:checked]:bg-white/10 has-[input:checked]:text-fg has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-primary/70 has-[input:disabled]:cursor-not-allowed">
                    <input type="radio" name={name} className="sr-only" checked={value === o.value} disabled={disabled} onChange={() => onChange(o.value)} />
                    {o.label}
                </label>
            ))}
        </div>
    );
}

export const SearchInput = ({ value, onChange, placeholder, label, className }: {
    value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string;
}) => (
    <label className={cn('relative min-w-0 flex-1 sm:w-56 sm:flex-none', className)}>
        <span className="sr-only">{label}</span>
        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
        <input type="search" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cn(INPUT_SM, 'w-full pl-8')} />
    </label>
);

/** Rupee amount input: a ₹ prefix inside a whole-number field. */
export const MoneyInput = ({ id, value, onChange, invalid, className, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
    value: string | number; onChange: (v: string) => void; invalid?: boolean;
}) => (
    <div className={cn('relative', className)}>
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">₹</span>
        <input id={id} type="number" min={0} inputMode="numeric" {...rest} aria-invalid={invalid || undefined}
            className={cn(INPUT, 'pl-7 tabular-nums', invalid && 'border-red-400/50 hover:border-red-400/60')}
            value={value} onChange={e => onChange(e.target.value)} />
    </div>
);

/** Page-level form section: title and description on the left, fields on the right (Details, Settings, Create). */
export const FormSection = ({ title, desc, danger, children }: { title: string; desc: string; danger?: boolean; children: ReactNode }) => (
    <section className="grid gap-4 border-t border-line py-6 first:border-t-0 first:pt-1 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <div>
            <h2 className={cn('text-[15px] font-semibold', danger ? 'text-red-300' : 'text-fg')}>{title}</h2>
            <p className="mt-1 max-w-[32ch] text-[13px] leading-relaxed text-fg-muted">{desc}</p>
        </div>
        <div className="min-w-0">{children}</div>
    </section>
);

/** Toolbar strip at the top of a list panel: tabs on one side, search and filters on the other. */
export const Toolbar = ({ children }: { children: ReactNode }) => (
    <div className="flex flex-col gap-2.5 border-b border-line p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">{children}</div>
);

