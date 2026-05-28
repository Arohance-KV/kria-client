import React from 'react';
import { IndianRupee } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface CommonFieldsValue {
    name: string;
    description: string;
    gender: string;
    ageGroup: { label: string; min: number | ''; max: number | '' };
    maxRegistrations: number | '';
    isPaidRegistration: boolean;
    registrationFee: number | '';
}

interface Props {
    value: CommonFieldsValue;
    onChange: (patch: Partial<CommonFieldsValue>) => void;
}

export default function CategoryCommonFields({ value, onChange }: Props) {
    const setAge = (patch: Partial<CommonFieldsValue['ageGroup']>) =>
        onChange({ ageGroup: { ...value.ageGroup, ...patch } });

    const num = (raw: string): number | '' => (raw === '' ? '' : Number(raw));

    return (
        <>
            {/* Basic Info */}
            <div className="space-y-4 md:col-span-2 p-4 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Basic Info</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label className="text-gray-400">Category Name *</Label>
                        <Input value={value.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Men's Singles Open" className="bg-black/50 border-white/10 text-white" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-gray-400">Gender *</Label>
                        <select value={value.gender} onChange={(e) => onChange({ gender: e.target.value })} className="flex h-10 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white">
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="mixed">Mixed</option>
                        </select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                        <Label className="text-gray-400">Description</Label>
                        <textarea value={value.description} onChange={(e) => onChange({ description: e.target.value })} className="flex min-h-[60px] w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm text-white" />
                    </div>
                </div>
            </div>

            {/* Age Group */}
            <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Age Group</h4>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-gray-400">Age Group Label *</Label>
                        <Input value={value.ageGroup.label} onChange={(e) => setAge({ label: e.target.value })} placeholder="e.g. Under 19, Seniors" className="bg-black/50 border-white/10 text-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-gray-400">Min Age</Label>
                            <Input type="number" min="0" placeholder="Optional" value={value.ageGroup.min} onChange={(e) => setAge({ min: num(e.target.value) })} className="bg-black/50 border-white/10 text-white" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-gray-400">Max Age</Label>
                            <Input type="number" min="0" placeholder="Optional" value={value.ageGroup.max} onChange={(e) => setAge({ max: num(e.target.value) })} className="bg-black/50 border-white/10 text-white" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Registration Limit */}
            <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Registration Limit</h4>
                <div className="space-y-2">
                    <Label className="text-gray-400">Max Registrations (optional)</Label>
                    <Input type="number" min="1" placeholder="Unlimited" value={value.maxRegistrations} onChange={(e) => onChange({ maxRegistrations: num(e.target.value) })} className="bg-black/50 border-white/10 text-white" />
                    <p className="text-xs text-gray-500">Leave empty for unlimited registrations.</p>
                </div>
            </div>

            {/* Registration Fee */}
            <div className="space-y-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                <h4 className="text-sm font-semibold text-primary uppercase tracking-wider mb-2">Registration Fee</h4>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <div
                            onClick={() => onChange({ isPaidRegistration: !value.isPaidRegistration, registrationFee: !value.isPaidRegistration ? value.registrationFee : '' })}
                            className={`relative w-11 h-6 rounded-full transition-colors ${value.isPaidRegistration ? 'bg-primary' : 'bg-white/20'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${value.isPaidRegistration ? 'translate-x-5' : ''}`} />
                        </div>
                        <span className="text-gray-300 text-sm font-medium">
                            {value.isPaidRegistration ? 'Paid Registration' : 'Free Registration'}
                        </span>
                    </label>
                </div>
                {value.isPaidRegistration && (
                    <div className="space-y-2 max-w-xs animate-in fade-in">
                        <Label className="text-gray-400">Fee Amount (₹) *</Label>
                        <div className="relative">
                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                            <Input type="number" min="1" placeholder="e.g. 500" value={value.registrationFee} onChange={(e) => onChange({ registrationFee: num(e.target.value) })} className="bg-black/50 border-white/10 text-white pl-9" />
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
