// Generic category inputs (basics, eligibility, registration) plus the format picker and
// footer that every sport's category form composes. Sport forms own the rest.
import { AlertCircle, Loader2 } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/pages/organizer/shared';
import { CHOICE, Field, FormGroup, INPUT, Notice, Segmented, Switch, TEXTAREA } from '@/pages/organizer/ui';
import { cn } from '@/lib/utils';

export interface CommonFieldsValue {
    name: string;
    description: string;
    gender: string;
    ageGroup: { label: string; min: number | ''; max: number | '' };
    maxRegistrations: number | '';
    isPaidRegistration: boolean;
    registrationFee: number | '';
}

export type CommonFieldsErrors = Partial<Record<'name' | 'ageLabel' | 'age' | 'maxRegistrations' | 'fee', string>>;

/** Number inputs keep '' while the field is cleared, so typing never snaps back to a default. */
export const num = (raw: string): number | '' => (raw === '' ? '' : Number(raw));

/** True when a number field is empty, fractional or below `min`. */
export const notInt = (v: number | '', min: number, max = Infinity) => v === '' || !Number.isInteger(v) || v < min || v > max;

export function validateCommonFields(v: CommonFieldsValue): CommonFieldsErrors {
    const e: CommonFieldsErrors = {};
    if (!v.name.trim()) e.name = 'Enter a category name.';
    if (!v.ageGroup.label.trim()) e.ageLabel = 'Enter an age group label, like Open or Under 19.';
    const { min, max } = v.ageGroup;
    if ((min !== '' && notInt(min, 0)) || (max !== '' && notInt(max, 0))) e.age = 'Enter ages as whole numbers, 0 or more.';
    else if (min !== '' && max !== '' && min > max) e.age = 'The minimum age can’t be higher than the maximum age.';
    if (v.maxRegistrations !== '' && notInt(v.maxRegistrations, 1)) e.maxRegistrations = 'Allow at least 1 registration, or leave it empty for no limit.';
    if (v.isPaidRegistration && (v.registrationFee === '' || v.registrationFee < 1)) e.fee = 'Paid categories need a fee of at least ₹1.';
    return e;
}

/** After a failed save, move focus to the first field that needs fixing. */
export const focusFirstInvalid = (form: HTMLFormElement | null) =>
    setTimeout(() => form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);

const GENDERS = [{ value: 'male', label: 'Men' }, { value: 'female', label: 'Women' }, { value: 'mixed', label: 'Mixed' }];

interface Props {
    value: CommonFieldsValue;
    onChange: (patch: Partial<CommonFieldsValue>) => void;
    errors?: CommonFieldsErrors;
}

export default function CategoryCommonFields({ value, onChange, errors = {} }: Props) {
    const setAge = (patch: Partial<CommonFieldsValue['ageGroup']>) =>
        onChange({ ageGroup: { ...value.ageGroup, ...patch } });

    return (
        <>
            <FormGroup title="Basics">
                <Field id="cat-name" label="Category name" error={errors.name}>
                    <input id="cat-name" className={INPUT} maxLength={100} placeholder="e.g. Men's Singles Open" aria-invalid={!!errors.name}
                        value={value.name} onChange={e => onChange({ name: e.target.value })} />
                </Field>
                <Field label="Gender">
                    <Segmented name="cat-gender" label="Gender" value={value.gender} options={GENDERS} onChange={gender => onChange({ gender })} />
                </Field>
                <Field id="cat-desc" label="Description">
                    <textarea id="cat-desc" className={TEXTAREA} rows={3} placeholder="Optional"
                        value={value.description} onChange={e => onChange({ description: e.target.value })} />
                </Field>
            </FormGroup>

            <FormGroup title="Eligibility">
                <div className="grid gap-3 sm:grid-cols-3">
                    <Field id="cat-age-label" label="Age group label" error={errors.ageLabel}>
                        <input id="cat-age-label" className={INPUT} placeholder="e.g. Under 19" aria-invalid={!!errors.ageLabel}
                            value={value.ageGroup.label} onChange={e => setAge({ label: e.target.value })} />
                    </Field>
                    <Field id="cat-age-min" label="Minimum age">
                        <input id="cat-age-min" type="number" min={0} className={INPUT} placeholder="Any" aria-invalid={!!errors.age}
                            value={value.ageGroup.min} onChange={e => setAge({ min: num(e.target.value) })} />
                    </Field>
                    <Field id="cat-age-max" label="Maximum age" error={errors.age}>
                        <input id="cat-age-max" type="number" min={0} className={INPUT} placeholder="Any" aria-invalid={!!errors.age}
                            value={value.ageGroup.max} onChange={e => setAge({ max: num(e.target.value) })} />
                    </Field>
                </div>
            </FormGroup>

            <FormGroup title="Registration">
                <div className="grid gap-3 sm:grid-cols-2">
                    <Field id="cat-slots" label="Maximum registrations" help="Leave empty for no limit." error={errors.maxRegistrations}>
                        <input id="cat-slots" type="number" min={1} className={INPUT} placeholder="Unlimited" aria-invalid={!!errors.maxRegistrations}
                            value={value.maxRegistrations} onChange={e => onChange({ maxRegistrations: num(e.target.value) })} />
                    </Field>
                    {value.isPaidRegistration && (
                        <Field id="cat-fee" label="Entry fee" help="Players pay this when they register." error={errors.fee}>
                            <div className="relative">
                                <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-fg-subtle">₹</span>
                                <input id="cat-fee" type="number" min={1} className={cn(INPUT, 'pl-7')} placeholder="e.g. 500" aria-invalid={!!errors.fee}
                                    value={value.registrationFee} onChange={e => onChange({ registrationFee: num(e.target.value) })} />
                            </div>
                        </Field>
                    )}
                    <div className="sm:col-span-2">
                        <Switch id="cat-paid" label="Paid registration" description="Turn off to make this category free."
                            checked={value.isPaidRegistration}
                            onChange={paid => onChange({ isPaidRegistration: paid, registrationFee: paid ? value.registrationFee : '' })} />
                    </div>
                </div>
            </FormGroup>
        </>
    );
}

const FORMATS: Record<string, { label: string; text: string }> = {
    knockout: { label: 'Knockout', text: 'Single elimination. Losers are out.' },
    league: { label: 'League', text: 'Everyone plays everyone once.' },
    hybrid: { label: 'Groups + knockout', text: 'Groups first, then the top players go to a knockout.' },
    team_league: { label: 'Team league', text: 'Teams play ties made of several sub-matches.' },
};

/** Bracket format as radio cards. Each sport passes the formats it supports. */
export function FormatChoice({ value, onChange, formats }: { value: string; onChange: (v: string) => void; formats: string[] }) {
    return (
        <div role="radiogroup" aria-label="Format" className="grid gap-2 sm:grid-cols-2">
            {formats.map(k => (
                <label key={k} className={CHOICE}>
                    <input type="radio" name="cat-format" className="mt-0.5 accent-primary" checked={value === k} onChange={() => onChange(k)} />
                    <span>
                        <span className="block text-sm font-medium text-fg">{FORMATS[k]?.label ?? k}</span>
                        <span className="mt-0.5 block text-[13px] text-fg-muted">{FORMATS[k]?.text}</span>
                    </span>
                </label>
            ))}
        </div>
    );
}

/** Cancel / Save bar pinned to the bottom of the drawer body, with the save error above it. */
export function CategoryFormFooter({ isEdit, saving, error, invalid, onCancel }: {
    isEdit: boolean; saving: boolean; error: string | null; invalid: boolean; onCancel: () => void;
}) {
    return (
        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 grid gap-3 border-t border-line bg-panel px-5 py-3">
            {error && <Notice tone="red" icon={AlertCircle}><span role="alert">{error}</span></Notice>}
            {!error && invalid && <p className="text-[13px] text-red-300">Fix the highlighted fields to save.</p>}
            <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel} className={BTN_SECONDARY}>Cancel</button>
                <button type="submit" disabled={saving} className={BTN_PRIMARY}>
                    {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
                    {isEdit ? 'Save changes' : 'Create category'}
                </button>
            </div>
        </div>
    );
}
