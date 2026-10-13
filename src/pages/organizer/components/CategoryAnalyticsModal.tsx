// Category leaderboard with award granting: the leaderboard on the left, the award
// form for the selected player on the right.
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, Trophy } from 'lucide-react';
import API from '../../../api/axios';
import { useAppDispatch } from '../../../store/hooks';
import { fetchTournament } from '../../../store/slices/tournamentSlice';
import { cn } from '@/lib/utils';
import { BTN_PRIMARY, BTN_SECONDARY, BTN_SM, FOCUS } from '../shared';
import { Avatar, Dialog, EmptyState, Field, INPUT, Notice, PANEL, Spinner } from '../ui';
import { BADGES, BadgeArt } from './badges';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    category: any;
    tournamentId: string;
}

interface Entry {
    _id: string;
    playerId?: string;
    teamId?: string;
    profile?: { firstName?: string; lastName?: string; name?: string; avatar?: string };
    team?: { name?: string; logo?: string };
    stats?: { matchesPlayed?: number; matchesWon?: number; pointsContributed?: number };
}

const nameOf = (e: Entry) =>
    (e.profile ? `${e.profile.firstName || ''} ${e.profile.lastName || ''}`.trim() || e.profile.name : e.team?.name) || 'Unknown';
const subOf = (e: Entry) => (e.profile ? e.team?.name || 'Player' : 'Team');
const errText = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

export default function CategoryAnalyticsModal({ isOpen, onClose, category, tournamentId }: Props) {
    const dispatch = useAppDispatch();
    const [analytics, setAnalytics] = useState<Entry[]>([]);
    const [loadState, setLoadState] = useState<'loading' | 'ok' | 'error'>('loading');
    const [loadError, setLoadError] = useState('');

    const [selected, setSelected] = useState<Entry | null>(null);
    const [awardBadge, setAwardBadge] = useState<string | null>(null);
    const [awardTitle, setAwardTitle] = useState('');
    const [isGranting, setIsGranting] = useState(false);
    const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
    const canGrant = !!awardBadge && awardTitle.trim().length > 0 && !isGranting;

    const categoryId = category?._id;
    const fetchAnalytics = useCallback(async () => {
        setLoadState('loading');
        try {
            const res = await API.get(`/categories/${categoryId}/analytics`);
            // The endpoint wraps the list as { category, analytics, teamMap }; older servers returned the array.
            const payload = res.data?.data?.data ?? res.data?.data ?? [];
            const list = Array.isArray(payload) ? payload : (payload?.analytics ?? []);
            setAnalytics(Array.isArray(list) ? list : []);
            setLoadState('ok');
        } catch (e) {
            setLoadError(errText(e, 'The server didn’t respond.'));
            setLoadState('error');
        }
    }, [categoryId]);

    useEffect(() => {
        if (isOpen && categoryId) fetchAnalytics();
    }, [isOpen, categoryId, fetchAnalytics]);

    // Each player starts with an empty award form.
    const select = (entry: Entry) => {
        setSelected(entry);
        setAwardBadge(null);
        setAwardTitle('');
        setResult(null);
    };

    const handleGrantAward = async () => {
        if (!selected || !canGrant) return;
        setIsGranting(true);
        setResult(null);
        const title = awardTitle.trim();
        try {
            await API.post(`/tournament/${tournamentId}/awards`, {
                title,
                badge: awardBadge,
                playerId: selected.playerId || null,
                teamId: selected.teamId || null,
                categoryId: category._id,
                description: `Awarded during ${category.name}`,
            });
            setResult({ ok: true, text: `“${title}” given to ${nameOf(selected)}.` });
            setAwardBadge(null);
            setAwardTitle('');
            // Refresh the tournament so its awards list updates straight away.
            dispatch(fetchTournament(tournamentId));
        } catch (e) {
            setResult({ ok: false, text: errText(e, 'Couldn’t give this award. Try again.') });
        } finally {
            setIsGranting(false);
        }
    };

    if (!isOpen) return null;

    const champion = category?.status === 'completed' ? analytics[0] : undefined;

    return (
        <Dialog wide title={`${category?.name ?? 'Category'}: analytics & awards`} onClose={onClose}>
            {loadState === 'loading' ? <Spinner label="Loading analytics" /> : loadState === 'error' ? (
                <div role="alert">
                    <EmptyState title="Couldn’t load analytics" text={loadError}
                        action={<button type="button" onClick={fetchAnalytics} className={BTN_SECONDARY}>Try again</button>} />
                </div>
            ) : analytics.length === 0 ? (
                <EmptyState title="No results yet" text="Statistics appear here once matches in this category have been played." />
            ) : (
                <div className="grid gap-4">
                    {champion && (
                        <div className="flex items-center gap-3 rounded-xl bg-amber-400/[0.07] p-4 ring-1 ring-inset ring-amber-400/25">
                            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-300">
                                <Trophy className="h-5 w-5" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-medium text-amber-300">Category champion</p>
                                <p className="truncate text-lg font-semibold text-fg">{nameOf(champion)}</p>
                                <p className="text-[13px] text-fg-muted">{champion.stats?.matchesWon || 0} wins · {champion.stats?.pointsContributed || 0} points</p>
                            </div>
                        </div>
                    )}

                    <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_300px]">
                        <div className={cn(PANEL, 'overflow-x-auto')}>
                            <table className="w-full min-w-[520px] text-left text-sm">
                                <caption className="sr-only">Leaderboard</caption>
                                <thead>
                                    <tr className="border-b border-line text-xs font-medium text-fg-subtle">
                                        <th scope="col" className="w-10 px-4 py-2 font-medium">#</th>
                                        <th scope="col" className="px-2 py-2 font-medium">Player</th>
                                        <th scope="col" className="px-2 py-2 text-right font-medium">Played</th>
                                        <th scope="col" className="px-2 py-2 text-right font-medium">Won</th>
                                        <th scope="col" className="px-2 py-2 text-right font-medium">Points</th>
                                        <th scope="col" className="px-4 py-2"><span className="sr-only">Award</span></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-line">
                                    {analytics.map((entry, idx) => {
                                        const name = nameOf(entry);
                                        const isSel = selected?._id === entry._id;
                                        return (
                                            <tr key={entry._id} className={cn(isSel && 'bg-white/[0.025]')}>
                                                <td className={cn('px-4 py-2.5 font-semibold tabular-nums', idx < 3 ? 'text-fg' : 'text-fg-subtle')}>{idx + 1}</td>
                                                <td className="px-2 py-2.5">
                                                    <div className="flex min-w-0 items-center gap-2.5">
                                                        <Avatar name={name} src={entry.profile?.avatar || (!entry.profile ? entry.team?.logo : undefined)} />
                                                        <div className="min-w-0">
                                                            <p className="max-w-[180px] truncate font-medium text-fg">{name}</p>
                                                            <p className="max-w-[180px] truncate text-[13px] text-fg-subtle">{subOf(entry)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2.5 text-right tabular-nums text-fg-muted">{entry.stats?.matchesPlayed || 0}</td>
                                                <td className="px-2 py-2.5 text-right tabular-nums text-fg-muted">{entry.stats?.matchesWon || 0}</td>
                                                <td className="px-2 py-2.5 text-right font-medium tabular-nums text-fg">{entry.stats?.pointsContributed || 0}</td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <button type="button" aria-pressed={isSel} onClick={() => select(entry)}
                                                        className={cn(isSel ? BTN_PRIMARY : BTN_SECONDARY, BTN_SM)}>
                                                        {isSel ? 'Selected' : 'Give award'}<span className="sr-only"> {isSel ? '·' : 'to'} {name}</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <section aria-label="Award" className={cn(PANEL, 'grid content-start gap-3 p-4')}>
                            {!selected ? (
                                <p className="text-[13.5px] leading-relaxed text-fg-muted">Choose a player to give an award. Awards appear on the player’s public profile.</p>
                            ) : (
                                <>
                                    <div>
                                        <p className="font-medium text-fg">{nameOf(selected)}</p>
                                        <p className="text-[13px] text-fg-subtle">{subOf(selected)}</p>
                                    </div>
                                    {/* Picking a badge prefills the title, which stays editable. */}
                                    <div role="group" aria-label="Badge" className="grid grid-cols-4 gap-1.5">
                                        {BADGES.map(b => (
                                            <button key={b.key} type="button" title={`${b.name} · ${b.tier}`} aria-label={b.name}
                                                aria-pressed={awardBadge === b.key}
                                                onClick={() => { setAwardBadge(b.key); setAwardTitle(b.name); }}
                                                className={cn('flex flex-col items-center gap-1 rounded-[10px] bg-canvas px-1 py-1.5 text-[10.5px] leading-tight text-fg-muted ring-1 ring-inset ring-line transition-colors hover:ring-white/20',
                                                    'aria-pressed:bg-primary/[0.06] aria-pressed:text-fg aria-pressed:ring-primary/60', FOCUS)}>
                                                <BadgeArt badge={b} size={32} />
                                                <span aria-hidden className="line-clamp-2 text-center">{b.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <Field id="award-title" label="Award title" count={`${awardTitle.length}/60`}>
                                        <input id="award-title" className={INPUT} maxLength={60} placeholder="Pick a badge first" value={awardTitle}
                                            onChange={e => setAwardTitle(e.target.value)} />
                                    </Field>
                                    <button type="button" onClick={handleGrantAward} disabled={!canGrant} className={BTN_PRIMARY}>
                                        {isGranting && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}Give award
                                    </button>
                                </>
                            )}
                            {result && (
                                <Notice tone={result.ok ? 'blue' : 'red'} icon={result.ok ? Check : AlertCircle}>
                                    <span role={result.ok ? 'status' : 'alert'}>{result.text}</span>
                                </Notice>
                            )}
                        </section>
                    </div>
                </div>
            )}
        </Dialog>
    );
}
