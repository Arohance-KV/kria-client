import { ReactNode, useState } from 'react';
import { CircleDot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PANEL, SegTabs, TeamLogo } from '@/pages/organizer/ui';
import { buildPlayerNameMap, nameOf, oversDisplay, xiSlots } from '@/sports/cricket/lib/lineup';

/**
 * Batting and bowling team ids. The live state's once the innings is under way;
 * before the first ball (no live state yet) they are read off the toss, so the
 * fielding XI is known on ball one.
 */
export function sidesOf(match: any, live: any): { batting: string; bowling: string } {
    const t1 = String(match?.teams?.team1Id ?? '');
    const t2 = String(match?.teams?.team2Id ?? '');
    const toss = match?.cricketSetup?.toss;
    const winner = toss?.winnerTeamId != null ? String(toss.winnerTeamId) : '';
    const fromToss = !winner ? t1 : toss.decision === 'bat' ? winner : winner === t1 ? t2 : t1;
    const batting = live?.battingTeamId ? String(live.battingTeamId) : fromToss;
    return { batting, bowling: batting === t1 ? t2 : t1 };
}

export const teamName = (match: any, id?: string) =>
    String(id) === String(match?.teams?.team1Id) ? (match?.teams?.team1Name || 'Team 1')
        : String(id) === String(match?.teams?.team2Id) ? (match?.teams?.team2Name || 'Team 2') : '—';

const isExtra = (label: string) => /^(wd|nb)/.test(label);

const ballChip =(label: string, i: number) => {
    const tone = label === 'W' ? 'bg-red-500/20 text-red-300 ring-red-400/30'
        : label === '4' ? 'bg-sky-400/15 text-sky-300 ring-sky-400/25'
            : label === '6' ? 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/25'
                : /^(wd|nb|b|lb)/.test(label) ? 'bg-amber-400/10 text-amber-300 ring-amber-400/20'
                    : label === '0' ? 'bg-white/[0.03] text-fg-subtle ring-line' : 'bg-raised text-fg ring-line';
    return (
        <span key={i} className={cn('flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-[13px] font-semibold tabular-nums ring-1 ring-inset', tone, label.length > 2 && 'text-[11px]')}>
            {label === '0' ? '·' : label}
        </span>
    );
};

// Phones drop 4s/6s (batting) and maidens (bowling) so names aren't cut to a few letters.
const GRID = 'grid grid-cols-[minmax(0,1fr)_repeat(3,36px)] gap-x-1 px-4 sm:grid-cols-[minmax(0,1fr)_repeat(5,44px)] sm:px-5';
const BOWL_GRID = 'grid grid-cols-[minmax(0,1fr)_repeat(3,40px)_52px] gap-x-1 px-4 sm:grid-cols-[minmax(0,1fr)_repeat(4,40px)_52px] sm:px-5';
const WIDE_ONLY = 'hidden text-right sm:block';

interface Props {
    match: any;
    live: any;
    scorecard?: any;
    /** The ends and bowler as the scorer has them, including picks not yet posted. */
    strikerId?: string;
    nonStrikerId?: string;
    bowlerId?: string;
    maxOvers?: number;
    /** The ball pad. Sits under the batters on a phone, sticky on the right on desktop. */
    pad?: ReactNode;
}

export default function LiveScoreboardPanel({ match, live, scorecard, strikerId, nonStrikerId, bowlerId, maxOvers: maxOversProp, pad }: Props) {
    const [tab, setTab] = useState<'bat' | 'bowl' | 'fow'>('bat');
    const names = buildPlayerNameMap(match);
    const { batting } = sidesOf(match, live);
    const battingName = teamName(match, batting);

    const innings = live?.currentInnings ?? 1;
    const card: any = innings === 2 ? scorecard?.innings2 : scorecard?.innings1;
    const battingCard: any[] = card?.battingCard ?? [];
    const bowlingCard: any[] = card?.bowlingCard ?? [];
    const fow: any[] = card?.fallOfWickets ?? [];

    const runs = live?.runs ?? 0;
    const wickets = live?.wickets ?? 0;
    const maxOvers = maxOversProp ?? match?.matchConfig?.maxOvers ?? 20;
    const balls = (live?.completedOvers ?? 0) * 6 + (live?.ballsInCurrentOver ?? 0);
    const left = maxOvers * 6 - balls;
    const target = live?.target;
    const need = target != null ? Math.max(0, target - runs) : null;

    // Right after an over ends the pad asks for the next bowler; keep the over
    // just bowled on screen until then.
    const overDone = !!live?.nextBowlerNeeded && (live?.completedOvers ?? 0) > 0;
    const overNo = overDone ? live.completedOvers : (live?.completedOvers ?? 0) + 1;
    const over = card?.oversTimeline?.find((o: any) => o.overNumber === overNo);
    const labels: string[] = (over?.balls ?? []).map((b: any) => b.label);
    const legal = labels.filter(l => !isExtra(l)).length;

    const scoreHead = (
        <section className={cn(PANEL, 'p-4 sm:p-5')}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-2 text-[13px] text-fg-muted">
                        <TeamLogo size="sm" name={battingName} />{battingName} · {innings === 2 ? '2nd' : '1st'} innings
                    </p>
                    <p className="mt-2 flex items-baseline gap-2">
                        <span className="text-[44px] font-semibold leading-none tracking-tight tabular-nums">{runs}/{wickets}</span>
                        <span className="text-sm tabular-nums text-fg-muted">{oversDisplay(live)} ov</span>
                    </p>
                </div>
                <dl className="grid gap-0.5 text-right text-[13px]">
                    <div><dt className="inline text-fg-subtle">CRR </dt><dd className="inline tabular-nums">{balls ? (runs * 6 / balls).toFixed(2) : '0.00'}</dd></div>
                    {need != null ? (
                        <>
                            <div><dt className="inline text-fg-subtle">RRR </dt><dd className="inline tabular-nums">{left > 0 ? (need * 6 / left).toFixed(2) : '–'}</dd></div>
                            <div><dt className="inline text-fg-subtle">Target </dt><dd className="inline tabular-nums">{target}</dd></div>
                        </>
                    ) : (
                        <div><dt className="inline text-fg-subtle">Overs </dt><dd className="inline tabular-nums">{maxOvers}</dd></div>
                    )}
                </dl>
            </div>
            {need != null && (
                <p className="mt-3 rounded-lg bg-white/[0.04] px-3 py-2 text-sm">
                    {battingName} need <span className="font-semibold tabular-nums">{need}</span> from <span className="font-semibold tabular-nums">{left}</span> balls
                </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 w-16 text-xs text-fg-subtle">Over {overNo}</span>
                {labels.map(ballChip)}
                {!overDone && Array.from({ length: Math.max(0, 6 - legal) }, (_, i) => (
                    <span key={`e${i}`} aria-hidden className="h-8 w-8 rounded-md ring-1 ring-inset ring-line/70" />
                ))}
                {overDone && <span className="ml-1 text-xs text-fg-muted">{over?.runs ?? 0} runs</span>}
            </div>
        </section>
    );

    const batRow = (id: string, onStrike: boolean) => {
        const b = battingCard.find(x => x.registrationId === id) ?? { runs: 0, ballsFaced: 0, fours: 0, sixes: 0 };
        return (
            <div className={cn(GRID, 'relative items-center py-2.5 text-[13px] tabular-nums', onStrike && 'bg-primary/[0.05]')}>
                {onStrike && <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />}
                <span className="flex min-w-0 items-center gap-1.5">
                    <span className={cn('truncate', onStrike ? 'font-semibold text-fg' : 'text-fg-muted')}>{nameOf(names, id)}</span>
                    {onStrike && <span className="shrink-0 rounded bg-primary/15 px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-primary">On strike</span>}
                </span>
                <span className="text-right font-semibold text-fg">{b.runs}</span>
                <span className="text-right text-fg-muted">{b.ballsFaced}</span>
                <span className={cn(WIDE_ONLY, 'text-fg-muted')}>{b.fours}</span>
                <span className={cn(WIDE_ONLY, 'text-fg-muted')}>{b.sixes}</span>
                <span className="text-right text-fg-muted">{b.ballsFaced ? (b.runs / b.ballsFaced * 100).toFixed(0) : '–'}</span>
            </div>
        );
    };
    const needed = (label: string) => <div className="px-4 py-2.5 text-[13px] text-amber-300 sm:px-5">{label}</div>;
    const bowler = bowlingCard.find(x => x.registrationId === bowlerId);
    // The server's partnership falls back to the whole innings when the last
    // ball was a wicket, so a fresh pair would show the innings total.
    const part = live?.nextBatsmanNeeded ? { runs: 0, balls: 0 } : card?.currentPartnership;
    const lastWicket = fow[fow.length - 1];

    const crease = (
        <section className={cn(PANEL, 'overflow-hidden')}>
            <div className={cn(GRID, 'border-b border-line py-2 text-xs text-fg-subtle')}>
                <span>Batter</span><span className="text-right">R</span><span className="text-right">B</span>
                <span className={WIDE_ONLY}>4s</span><span className={WIDE_ONLY}>6s</span><span className="text-right">SR</span>
            </div>
            {strikerId ? batRow(strikerId, true) : needed('New batter needed')}
            {nonStrikerId ? batRow(nonStrikerId, false) : needed('New batter needed')}
            <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[13px] sm:px-5">
                <span className="flex min-w-0 items-center gap-2">
                    <CircleDot aria-hidden className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
                    {bowlerId ? <span className="truncate font-medium">{nameOf(names, bowlerId)}</span> : <span className="text-amber-300">Next bowler needed</span>}
                </span>
                {bowlerId && <span className="tabular-nums text-fg-muted">{bowler ? `${bowler.overs}-${bowler.maidens}-${bowler.runs}-${bowler.wickets}` : '0-0-0-0'}</span>}
            </div>
            <p className="border-t border-line px-4 py-2 text-xs text-fg-subtle sm:px-5">
                Partnership <span className="tabular-nums text-fg-muted">{part ? `${part.runs} (${part.balls})` : '0 (0)'}</span>
                {' · '}Last wicket <span className="text-fg-muted">{lastWicket ? `${lastWicket.batterName} at ${lastWicket.score}` : '–'}</span>
            </p>
        </section>
    );

    const ex = live?.extras ?? {};
    const exTotal = (ex.wides ?? 0) + (ex.noBalls ?? 0) + (ex.byes ?? 0) + (ex.legByes ?? 0);
    const lineOf = new Map<string, string>(fow.map(w => [w.batterId, w.dismissalLine]));
    const batted = new Set(battingCard.map(b => b.registrationId));
    const yetToBat = xiSlots(match, batting).filter(p => !batted.has(p.registrationId) && p.registrationId !== strikerId && p.registrationId !== nonStrikerId);
    const empty = (text: string) => <p className="px-4 py-6 text-center text-[13px] text-fg-subtle sm:px-5">{text}</p>;

    const scorecardTabs = (
        <section className={cn(PANEL, 'overflow-hidden')}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line p-2.5">
                <SegTabs<'bat' | 'bowl' | 'fow'> label="Scorecard" value={tab} onChange={setTab}
                    items={[{ key: 'bat', label: 'Batting' }, { key: 'bowl', label: 'Bowling' }, { key: 'fow', label: 'Fall of wickets' }]} />
                <span className="px-1 text-xs text-fg-subtle">
                    Extras {exTotal} (wd {ex.wides ?? 0}, nb {ex.noBalls ?? 0}, b {ex.byes ?? 0}, lb {ex.legByes ?? 0})
                </span>
            </div>
            {tab === 'bat' && (
                <ul className="divide-y divide-line">
                    {battingCard.map(b => (
                        <li key={b.registrationId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 px-4 py-2.5 text-[13px] sm:px-5">
                            <div className="min-w-0">
                                <p className={cn('truncate', b.dismissal ? 'text-fg-muted' : 'font-medium text-fg')}>{b.name}{!b.dismissal && ' *'}</p>
                                <p className="truncate text-xs text-fg-subtle">{b.dismissal ? (lineOf.get(b.registrationId) ?? b.dismissal.type.replace(/_/g, ' ')) : 'not out'}</p>
                            </div>
                            <span className="tabular-nums"><span className="font-semibold">{b.runs}</span> <span className="text-fg-subtle">({b.ballsFaced})</span></span>
                        </li>
                    ))}
                    {!battingCard.length && <li>{empty('No balls bowled yet.')}</li>}
                    {yetToBat.length > 0 && <li className="px-4 py-2.5 text-xs text-fg-subtle sm:px-5">Yet to bat: {yetToBat.map(p => p.name).join(', ')}</li>}
                </ul>
            )}
            {tab === 'bowl' && (bowlingCard.length ? (
                <div>
                    <div className={cn(BOWL_GRID, 'border-b border-line py-2 text-xs text-fg-subtle')}>
                        <span>Bowler</span><span className="text-right">O</span><span className={WIDE_ONLY}>M</span>
                        <span className="text-right">R</span><span className="text-right">W</span><span className="text-right">Econ</span>
                    </div>
                    <ul className="divide-y divide-line">
                        {bowlingCard.map(b => (
                            <li key={b.registrationId} className={cn(BOWL_GRID, 'py-2.5 text-[13px] tabular-nums')}>
                                <span className={cn('truncate', b.registrationId === bowlerId ? 'font-medium text-fg' : 'text-fg-muted')}>{b.name}</span>
                                <span className="text-right">{b.overs}</span><span className={WIDE_ONLY}>{b.maidens}</span>
                                <span className="text-right">{b.runs}</span><span className="text-right font-semibold">{b.wickets}</span>
                                <span className="text-right text-fg-muted">{Number(b.economy).toFixed(2)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : empty('No overs bowled yet.'))}
            {tab === 'fow' && (fow.length ? (
                <ol className="divide-y divide-line">
                    {fow.map(w => (
                        <li key={w.wicketNumber} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px] sm:px-5">
                            <span><span className="font-semibold tabular-nums">{w.score}/{w.wicketNumber}</span> <span className="text-fg-muted">{w.batterName}</span></span>
                            <span className="tabular-nums text-fg-subtle">{w.overs} ov</span>
                        </li>
                    ))}
                </ol>
            ) : empty('No wickets yet.'))}
        </section>
    );

    // Phone order: score, batters, pad, scorecard. Desktop: two columns, pad sticky on the right.
    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start lg:gap-5">
            <div className="lg:col-start-1 lg:row-start-1">{scoreHead}</div>
            <div className="lg:col-start-1 lg:row-start-2">{crease}</div>
            {pad && <div className="lg:sticky lg:top-[116px] lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:self-start">{pad}</div>}
            <div className="lg:col-start-1 lg:row-start-3">{scorecardTabs}</div>
        </div>
    );
}
