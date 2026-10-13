import { FormEvent, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useAppDispatch } from '@/store/hooks';
import { createCategory, updateCategory } from '@/store/slices/categorySlice';
import CategoryCommonFields, {
    CategoryFormFooter, CommonFieldsErrors, CommonFieldsValue, focusFirstInvalid, FormatChoice, notInt, num, validateCommonFields,
} from '@/components/CategoryCommonFields';
import { cn } from '@/lib/utils';
import { BTN_GHOST, BTN_SM, FOCUS } from '@/pages/organizer/shared';
import { Field, FormGroup, INPUT, Segmented } from '@/pages/organizer/ui';
import type { CategoryFormProps } from '@/sports/_contracts/SportPlugin';

type N = number | '';
interface Slot { slotNumber: number; matchType: string; label: string }

interface BadmintonFormState extends CommonFieldsValue {
    matchType: string;
    matchFormat: { bestOf: number; pointsPerGame: N; tieBreakPoints: N };
    bracketType: string;
    hybridConfig: { leagueSize: N; topN: N };
    teamLeagueConfig: {
        subTeamSlots: Slot[];
        numberOfGroups: N;
        topNPerGroup: N;
        pointsForWin: N;
        pointsForLoss: N;
        pointsForDraw: N;
    };
}

const SLOT_TYPES = [
    { value: 'singles', label: 'Singles' },
    { value: 'doubles', label: 'Doubles' },
    { value: 'mixed_doubles', label: 'Mixed doubles' },
];
const defaultLabel = (matchType: string, n: number) => `${SLOT_TYPES.find(t => t.value === matchType)?.label ?? 'Singles'} ${n}`;
// A label is still "ours" if it's empty or looks like "<Type> n"; anything else the organizer typed.
const isDefaultLabel = (label: string) => !label.trim() || /^(singles|doubles|mixed doubles) \d+$/i.test(label.trim());

const initialState: BadmintonFormState = {
    name: '', description: '', gender: 'male',
    ageGroup: { label: '', min: '', max: '' },
    maxRegistrations: '', isPaidRegistration: false, registrationFee: '',
    matchType: 'singles',
    matchFormat: { bestOf: 3, pointsPerGame: 21, tieBreakPoints: '' },
    bracketType: 'knockout',
    hybridConfig: { leagueSize: 4, topN: 2 },
    teamLeagueConfig: {
        subTeamSlots: [{ slotNumber: 1, matchType: 'singles', label: 'Singles 1' }],
        numberOfGroups: 2, topNPerGroup: 1, pointsForWin: 2, pointsForLoss: 0, pointsForDraw: 1,
    },
};

function fromCategory(c: any): BadmintonFormState {
    return {
        name: c.name, description: c.description || '', gender: c.gender || 'male',
        ageGroup: { label: c.ageGroup?.label || '', min: c.ageGroup?.min ?? '', max: c.ageGroup?.max ?? '' },
        maxRegistrations: c.maxRegistrations ?? '', isPaidRegistration: c.isPaidRegistration || false,
        registrationFee: c.registrationFee || '',
        matchType: c.matchType || 'singles',
        matchFormat: { bestOf: c.matchFormat?.bestOf || 3, pointsPerGame: c.matchFormat?.pointsPerGame || 21, tieBreakPoints: c.matchFormat?.tieBreakPoints ?? '' },
        bracketType: c.bracketType || 'knockout',
        hybridConfig: { leagueSize: c.hybridConfig?.leagueSize || 4, topN: c.hybridConfig?.topN || 2 },
        teamLeagueConfig: {
            subTeamSlots: (c.teamLeagueConfig?.subTeamSlots?.length ? c.teamLeagueConfig.subTeamSlots : [{ slotNumber: 1, matchType: 'singles', label: 'Singles 1' }])
                .map((s: Slot) => ({ ...s, label: s.label ?? '' })),
            numberOfGroups: c.teamLeagueConfig?.numberOfGroups || 2,
            topNPerGroup: c.teamLeagueConfig?.topNPerGroup || 1,
            pointsForWin: c.teamLeagueConfig?.pointsForWin ?? 2,
            pointsForLoss: c.teamLeagueConfig?.pointsForLoss ?? 0,
            pointsForDraw: c.teamLeagueConfig?.pointsForDraw ?? 1,
        },
    };
}

type Errors = CommonFieldsErrors & Partial<Record<'pointsPerGame' | 'leagueSize' | 'topN' | 'numberOfGroups' | 'topNPerGroup' | 'points', string>>;

function validate(f: BadmintonFormState): Errors {
    const e: Errors = validateCommonFields(f);
    if (notInt(f.matchFormat.pointsPerGame, 1)) e.pointsPerGame = 'Enter at least 1 point per game.';
    if (f.bracketType === 'hybrid') {
        if (notInt(f.hybridConfig.leagueSize, 2)) e.leagueSize = 'Groups need at least 2 entries.';
        if (notInt(f.hybridConfig.topN, 1)) e.topN = 'At least 1 must qualify from each group.';
    }
    if (f.bracketType === 'team_league') {
        const t = f.teamLeagueConfig;
        if (notInt(t.numberOfGroups, 1)) e.numberOfGroups = 'Enter at least 1 group.';
        if (notInt(t.topNPerGroup, 1)) e.topNPerGroup = 'At least 1 team must qualify.';
        if ([t.pointsForWin, t.pointsForDraw, t.pointsForLoss].some(v => notInt(v, 0))) e.points = 'Enter points as whole numbers, 0 or more.';
    }
    return e;
}

export default function BadmintonCategoryForm({ tournamentId, category, onSuccess, onCancel, sport }: CategoryFormProps) {
    const dispatch = useAppDispatch();
    const isEdit = !!category;
    const [formData, setFormData] = useState<BadmintonFormState>(category ? fromCategory(category) : initialState);
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const errors: Errors = tried ? validate(formData) : {};
    const tl = formData.bracketType === 'team_league';

    const setField = (patch: Partial<BadmintonFormState>) => setFormData(prev => ({ ...prev, ...patch }));
    const setFormat = (patch: Partial<BadmintonFormState['matchFormat']>) => setFormData(prev => ({ ...prev, matchFormat: { ...prev.matchFormat, ...patch } }));
    const setHybrid = (patch: Partial<BadmintonFormState['hybridConfig']>) => setFormData(prev => ({ ...prev, hybridConfig: { ...prev.hybridConfig, ...patch } }));
    const setLeague = (patch: Partial<BadmintonFormState['teamLeagueConfig']>) =>
        setFormData(prev => ({ ...prev, teamLeagueConfig: { ...prev.teamLeagueConfig, ...patch } }));
    const slots = formData.teamLeagueConfig.subTeamSlots;
    const setSlot = (idx: number, patch: Partial<Slot>) => setLeague({ subTeamSlots: slots.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });

    const buildPayload = () => {
        const p: any = JSON.parse(JSON.stringify(formData));
        if (p.ageGroup.min === '') delete p.ageGroup.min;
        if (p.ageGroup.max === '') delete p.ageGroup.max;
        if (p.matchFormat.tieBreakPoints === '') delete p.matchFormat.tieBreakPoints;
        if (p.bracketType !== 'hybrid') delete p.hybridConfig;
        if (p.bracketType !== 'team_league') delete p.teamLeagueConfig;
        if (!p.isPaidRegistration) p.registrationFee = 0;
        if (p.maxRegistrations === '' || p.maxRegistrations === null) delete p.maxRegistrations;
        return p;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setTried(true);
        if (Object.keys(validate(formData)).length) { focusFirstInvalid(formRef.current); return; }
        setSaving(true);
        setError(null);
        const payload = buildPayload();
        const result = isEdit
            ? await dispatch(updateCategory({ id: (category as { _id: string })._id, data: payload }))
            : await dispatch(createCategory({ tournamentId, data: { ...payload, ...(sport ? { sport } : {}) } }));
        if (updateCategory.fulfilled.match(result) || createCategory.fulfilled.match(result)) { onSuccess(); return; }
        setError((result.payload as string) || 'Couldn’t save this category. Try again.');
        setSaving(false);
    };

    const numInput = (id: string, value: N, onChange: (v: N) => void, min: number, invalid?: string, label?: string) => (
        <input id={id} type="number" min={min} className={INPUT} aria-invalid={!!invalid} aria-label={label}
            value={value} onChange={e => onChange(num(e.target.value))} />
    );

    return (
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-5">
            <CategoryCommonFields value={formData} errors={errors} onChange={patch => setField(patch as Partial<BadmintonFormState>)} />

            <FormGroup title={tl ? 'Sub-match settings' : 'Match settings'}
                description={tl ? 'Applies to every sub-match in a tie. Each slot sets its own match type below.' : undefined}>
                <div className="grid gap-3 sm:grid-cols-2">
                    {!tl && (
                        <Field label="Match type">
                            <Segmented name="bd-match-type" label="Match type" value={formData.matchType} onChange={matchType => setField({ matchType })}
                                options={[{ value: 'singles', label: 'Singles' }, { value: 'doubles', label: 'Doubles' }]} />
                        </Field>
                    )}
                    <Field label="Best of">
                        <Segmented name="bd-best-of" label="Best of" value={formData.matchFormat.bestOf} onChange={bestOf => setFormat({ bestOf })}
                            options={[{ value: 1, label: '1 game' }, { value: 3, label: '3 games' }, { value: 5, label: '5 games' }]} />
                    </Field>
                    <Field id="bd-points" label="Points per game" error={errors.pointsPerGame}>
                        {numInput('bd-points', formData.matchFormat.pointsPerGame, pointsPerGame => setFormat({ pointsPerGame }), 1, errors.pointsPerGame)}
                    </Field>
                </div>
            </FormGroup>

            <FormGroup title="Format">
                <FormatChoice value={formData.bracketType} onChange={bracketType => setField({ bracketType })}
                    formats={['knockout', 'league', 'hybrid', 'team_league']} />

                {formData.bracketType === 'hybrid' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field id="bd-group-size" label="Group size" help="Entries in each group." error={errors.leagueSize}>
                            {numInput('bd-group-size', formData.hybridConfig.leagueSize, leagueSize => setHybrid({ leagueSize }), 2, errors.leagueSize)}
                        </Field>
                        <Field id="bd-top-n" label="Qualify from each group" error={errors.topN}>
                            {numInput('bd-top-n', formData.hybridConfig.topN, topN => setHybrid({ topN }), 1, errors.topN)}
                        </Field>
                    </div>
                )}

                {tl && (
                    <>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <Field id="bd-groups" label="Groups" error={errors.numberOfGroups}>
                                {numInput('bd-groups', formData.teamLeagueConfig.numberOfGroups, numberOfGroups => setLeague({ numberOfGroups }), 1, errors.numberOfGroups)}
                            </Field>
                            <Field id="bd-qualify" label="Qualify per group" error={errors.topNPerGroup}>
                                {numInput('bd-qualify', formData.teamLeagueConfig.topNPerGroup, topNPerGroup => setLeague({ topNPerGroup }), 1, errors.topNPerGroup)}
                            </Field>
                            <Field label="Points: win / draw / loss" error={errors.points}>
                                <div className="flex gap-1.5">
                                    {numInput('bd-pts-win', formData.teamLeagueConfig.pointsForWin, pointsForWin => setLeague({ pointsForWin }), 0, errors.points, 'Points for a win')}
                                    {numInput('bd-pts-draw', formData.teamLeagueConfig.pointsForDraw, pointsForDraw => setLeague({ pointsForDraw }), 0, errors.points, 'Points for a draw')}
                                    {numInput('bd-pts-loss', formData.teamLeagueConfig.pointsForLoss, pointsForLoss => setLeague({ pointsForLoss }), 0, errors.points, 'Points for a loss')}
                                </div>
                            </Field>
                        </div>

                        <div className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-[13px] font-medium text-fg-muted">Sub-matches in each tie</span>
                                <button type="button" className={cn(BTN_GHOST, BTN_SM)}
                                    onClick={() => setLeague({ subTeamSlots: [...slots, { slotNumber: slots.length + 1, matchType: 'singles', label: defaultLabel('singles', slots.length + 1) }] })}>
                                    <Plus aria-hidden className="h-3.5 w-3.5" />Add slot
                                </button>
                            </div>
                            <ul className="grid gap-2">
                                {slots.map((slot, idx) => (
                                    <li key={idx} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-2">
                                        <span className="text-xs tabular-nums text-fg-subtle">#{slot.slotNumber}</span>
                                        <select aria-label={`Slot ${idx + 1} type`} className={INPUT} value={slot.matchType}
                                            onChange={e => setSlot(idx, {
                                                matchType: e.target.value,
                                                // Only replace labels we generated; keep anything the organizer typed.
                                                ...(isDefaultLabel(slot.label) ? { label: defaultLabel(e.target.value, idx + 1) } : {}),
                                            })}>
                                            {SLOT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                        </select>
                                        <input aria-label={`Slot ${idx + 1} label`} className={INPUT} placeholder="Label" value={slot.label}
                                            onChange={e => setSlot(idx, { label: e.target.value })} />
                                        {slots.length > 1 ? (
                                            <button type="button" aria-label={`Remove slot ${idx + 1}`}
                                                onClick={() => setLeague({ subTeamSlots: slots.filter((_, i) => i !== idx).map((s, i) => ({ ...s, slotNumber: i + 1 })) })}
                                                className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-fg-muted hover:bg-white/[0.05] hover:text-red-300', FOCUS)}>
                                                <X aria-hidden className="h-4 w-4" />
                                            </button>
                                        ) : <span />}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </>
                )}
            </FormGroup>

            <CategoryFormFooter isEdit={isEdit} saving={saving} error={error} invalid={Object.keys(errors).length > 0} onCancel={onCancel} />
        </form>
    );
}
