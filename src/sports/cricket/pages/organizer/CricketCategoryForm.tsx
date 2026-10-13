import { FormEvent, useRef, useState } from 'react';
import CategoryCommonFields, {
    CategoryFormFooter, CommonFieldsErrors, CommonFieldsValue, focusFirstInvalid, FormatChoice, notInt, num, validateCommonFields,
} from '@/components/CategoryCommonFields';
import { cricketCategoryApi } from '@/sports/cricket/api/cricketCategory';
import { Field, FormGroup, INPUT } from '@/pages/organizer/ui';
import type { CategoryFormProps } from '@/sports/_contracts/SportPlugin';

type N = number | '';

interface CricketFormState extends CommonFieldsValue {
    bracketType: string;
    hybridConfig: { leagueSize: N; topN: N };
    cricketConfig: {
        overs: N;
        maxOversPerBowler: N;
        playersPerTeam: N;
        reservesAllowed: N;
        powerplayOvers: N;
        tieBreaker: string;
    };
}

const initialState: CricketFormState = {
    name: '', description: '', gender: 'male',
    ageGroup: { label: '', min: '', max: '' },
    maxRegistrations: '', isPaidRegistration: false, registrationFee: '',
    bracketType: 'knockout',
    hybridConfig: { leagueSize: 4, topN: 2 },
    cricketConfig: { overs: 20, maxOversPerBowler: 4, playersPerTeam: 11, reservesAllowed: 2, powerplayOvers: 6, tieBreaker: 'super_over' },
};

function fromCategory(c: any): CricketFormState {
    return {
        name: c.name, description: c.description || '', gender: c.gender || 'male',
        ageGroup: { label: c.ageGroup?.label || '', min: c.ageGroup?.min ?? '', max: c.ageGroup?.max ?? '' },
        maxRegistrations: c.maxRegistrations ?? '', isPaidRegistration: c.isPaidRegistration || false,
        registrationFee: c.registrationFee || '',
        bracketType: c.bracketType || 'knockout',
        hybridConfig: { leagueSize: c.hybridConfig?.leagueSize || 4, topN: c.hybridConfig?.topN || 2 },
        cricketConfig: {
            overs: c.cricketConfig?.overs ?? 20,
            maxOversPerBowler: c.cricketConfig?.maxOversPerBowler ?? 4,
            playersPerTeam: c.cricketConfig?.playersPerTeam ?? 11,
            reservesAllowed: c.cricketConfig?.reservesAllowed ?? 2,
            powerplayOvers: c.cricketConfig?.powerplayOvers ?? 6,
            tieBreaker: c.cricketConfig?.tieBreaker || 'super_over',
        },
    };
}

type CricketKey = 'overs' | 'maxOversPerBowler' | 'playersPerTeam' | 'reservesAllowed' | 'powerplayOvers';
type Errors = CommonFieldsErrors & Partial<Record<CricketKey | 'leagueSize' | 'topN', string>>;

// Same limits the server enforces, checked on save so fields can be cleared while typing.
const LIMITS: Record<CricketKey, { label: string; min: number; max?: number; error: string }> = {
    overs: { label: 'Overs', min: 1, max: 50, error: 'Enter 1 to 50 overs.' },
    maxOversPerBowler: { label: 'Max overs per bowler', min: 1, error: 'Allow each bowler at least 1 over.' },
    playersPerTeam: { label: 'Players per team', min: 5, max: 11, error: 'Teams need 5 to 11 players.' },
    reservesAllowed: { label: 'Reserves allowed', min: 0, error: 'Enter 0 or more reserves.' },
    powerplayOvers: { label: 'Powerplay overs', min: 0, error: 'Enter 0 or more powerplay overs.' },
};

function validate(f: CricketFormState): Errors {
    const e: Errors = validateCommonFields(f);
    (Object.keys(LIMITS) as CricketKey[]).forEach(k => {
        if (notInt(f.cricketConfig[k], LIMITS[k].min, LIMITS[k].max)) e[k] = LIMITS[k].error;
    });
    if (f.bracketType === 'hybrid') {
        if (notInt(f.hybridConfig.leagueSize, 2)) e.leagueSize = 'Groups need at least 2 teams.';
        if (notInt(f.hybridConfig.topN, 1)) e.topN = 'At least 1 team must qualify from each group.';
    }
    return e;
}

export default function CricketCategoryForm({ tournamentId, category, onSuccess, onCancel }: CategoryFormProps) {
    const isEdit = !!category;
    const [formData, setFormData] = useState<CricketFormState>(category ? fromCategory(category) : initialState);
    const [tried, setTried] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const formRef = useRef<HTMLFormElement>(null);
    const errors: Errors = tried ? validate(formData) : {};

    const setField = (patch: Partial<CricketFormState>) => setFormData(prev => ({ ...prev, ...patch }));
    const setCricket = (patch: Partial<CricketFormState['cricketConfig']>) =>
        setFormData(prev => ({ ...prev, cricketConfig: { ...prev.cricketConfig, ...patch } }));
    const setHybrid = (patch: Partial<CricketFormState['hybridConfig']>) =>
        setFormData(prev => ({ ...prev, hybridConfig: { ...prev.hybridConfig, ...patch } }));

    const buildPayload = () => {
        const p: any = JSON.parse(JSON.stringify(formData));
        p.tournamentId = tournamentId;
        if (p.ageGroup.min === '') delete p.ageGroup.min;
        if (p.ageGroup.max === '') delete p.ageGroup.max;
        if (p.bracketType !== 'hybrid') delete p.hybridConfig;
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
        try {
            const payload = buildPayload();
            if (isEdit) await cricketCategoryApi.update((category as { _id: string })._id, payload);
            else await cricketCategoryApi.create(payload);
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Couldn’t save this category. Try again.');
            setSaving(false);
        }
    };

    const numInput = (id: string, value: N, onChange: (v: N) => void, min: number, invalid?: string) => (
        <input id={id} type="number" min={min} className={INPUT} aria-invalid={!!invalid}
            value={value} onChange={e => onChange(num(e.target.value))} />
    );

    return (
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-5">
            <CategoryCommonFields value={formData} errors={errors} onChange={patch => setField(patch as Partial<CricketFormState>)} />

            <FormGroup title="Match settings">
                <div className="grid gap-3 sm:grid-cols-3">
                    {(Object.keys(LIMITS) as CricketKey[]).map(k => (
                        <Field key={k} id={`ck-${k}`} label={LIMITS[k].label} error={errors[k]}>
                            {numInput(`ck-${k}`, formData.cricketConfig[k], v => setCricket({ [k]: v }), LIMITS[k].min, errors[k])}
                        </Field>
                    ))}
                    <Field id="ck-tie" label="Tie breaker">
                        <select id="ck-tie" className={INPUT} value={formData.cricketConfig.tieBreaker} onChange={e => setCricket({ tieBreaker: e.target.value })}>
                            <option value="super_over">Super over</option>
                            <option value="bowl_out">Bowl out</option>
                            <option value="shared">Shared</option>
                        </select>
                    </Field>
                </div>
            </FormGroup>

            <FormGroup title="Format">
                <FormatChoice value={formData.bracketType} onChange={bracketType => setField({ bracketType })} formats={['knockout', 'league', 'hybrid']} />
                {formData.bracketType === 'hybrid' && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field id="ck-group-size" label="Teams per group" error={errors.leagueSize}>
                            {numInput('ck-group-size', formData.hybridConfig.leagueSize, leagueSize => setHybrid({ leagueSize }), 2, errors.leagueSize)}
                        </Field>
                        <Field id="ck-top-n" label="Qualify from each group" error={errors.topN}>
                            {numInput('ck-top-n', formData.hybridConfig.topN, topN => setHybrid({ topN }), 1, errors.topN)}
                        </Field>
                    </div>
                )}
            </FormGroup>

            <CategoryFormFooter isEdit={isEdit} saving={saving} error={error} invalid={Object.keys(errors).length > 0} onCancel={onCancel} />
        </form>
    );
}
