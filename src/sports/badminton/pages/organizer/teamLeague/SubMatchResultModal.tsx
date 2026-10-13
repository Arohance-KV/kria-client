import { Fragment, useState } from 'react';
import { AlertTriangle, Loader2, Plus, Trophy, X } from 'lucide-react';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';
import { CHOICE, Dialog, INPUT, Notice } from '@/pages/organizer/ui';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, BTN_SM } from '@/pages/organizer/shared';
import { cn } from '@/lib/utils';

interface Props {
    match: any;
    onClose: () => void;
    onSaved: () => void;
}

type Game = { a: string; b: string };

const num = (v: string) => (v.trim() === '' ? null : Number(v));

/** Reads the entered games: unplayed (blank) games are skipped; a played game needs two whole, unequal scores. */
export function readGames(games: Game[]) {
    const played = games.map((g, i) => ({ n: i + 1, a: num(g.a), b: num(g.b) })).filter(g => g.a !== null || g.b !== null);
    const bad = played.find(g => g.a === null || g.b === null || !Number.isInteger(g.a) || !Number.isInteger(g.b) || g.a < 0 || g.b < 0 || g.a === g.b);
    const problem = !bad ? null
        : bad.a === null || bad.b === null ? `Game ${bad.n} needs both scores.`
        : bad.a === bad.b ? `Game ${bad.n} can't end level.`
        : `Game ${bad.n} needs whole numbers of 0 or more.`;
    const won1 = played.filter(g => g.a > g.b).length;
    const won2 = played.filter(g => g.b > g.a).length;
    return { played, problem, won1, won2, leader: problem || won1 === won2 ? 0 : won1 > won2 ? 1 : 2 };
}

export default function SubMatchResultModal({ match, onClose, onSaved }: Props) {
    // For sub-matches, player1.teamId is the clean team ObjectId (player1.registrationId
    // is unreliable for doubles — it's stored as "id1,id2" joined by comma).
    const sides = [
        { id: match.player1?.teamId || match.teams?.team1Id, name: match.player1?.teamName || match.teams?.team1Name || 'Team 1', players: match.player1?.name },
        { id: match.player2?.teamId || match.teams?.team2Id, name: match.player2?.teamName || match.teams?.team2Name || 'Team 2', players: match.player2?.name },
    ];

    // One blank row per game of the format; unplayed games stay blank.
    const [games, setGames] = useState<Game[]>(() =>
        Array.from({ length: Math.max(1, match.matchConfig?.bestOf ?? 3) }, () => ({ a: '', b: '' })));
    const [picked, setPicked] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const { played, problem, won1, won2, leader } = readGames(games);
    const fromScores = leader ? sides[leader - 1] : null;
    const winnerId = picked ?? fromScores?.id ?? null;
    const winner = sides.find(s => s.id === winnerId);
    const contradicts = !!picked && !!fromScores && picked !== fromScores.id;

    const setScore = (i: number, key: keyof Game, v: string) => setGames(gs => gs.map((g, j) => (j === i ? { ...g, [key]: v } : g)));

    const save = async () => {
        if (problem || !winnerId) return;
        setSaving(true);
        setError(null);
        try {
            await teamLeagueApi.recordSubMatchResult(match._id, {
                winnerId,
                gameScores: played.map((g, i) => ({
                    gameNumber: i + 1, team1Score: g.a, team2Score: g.b, winnerId: g.a > g.b ? sides[0].id : sides[1].id,
                })),
            });
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to record result');
            setSaving(false);
        }
    };

    return (
        <Dialog title="Enter result" onClose={onClose}
            description={[match.slotLabel, sides[0].players && sides[1].players && `${sides[0].players} vs ${sides[1].players}`].filter(Boolean).join(' · ') || undefined}
            footer={<>
                {error && <p role="alert" className="mr-auto min-w-0 text-[13px] text-red-300">{error}</p>}
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="button" onClick={save} disabled={saving || !!problem || !winnerId} className={BTN_PRIMARY}>
                    {saving && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}Save result
                </button>
            </>}>
            <div className="grid gap-5">
                <div className="grid gap-2">
                    <div role="group" aria-label="Game scores" className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)_2rem] items-center gap-x-2.5 gap-y-2 text-[13px]">
                        <span />
                        {sides.map((s, i) => <span key={i} title={s.name} className="truncate text-center text-xs font-medium text-fg-muted">{s.name}</span>)}
                        <span />
                        {games.map((g, i) => (
                            <Fragment key={i}>
                                <span className="text-fg-subtle">Game {i + 1}</span>
                                {(['a', 'b'] as const).map((k, side) => (
                                    <input key={k} type="number" min={0} inputMode="numeric" aria-label={`Game ${i + 1}, ${sides[side].name}`}
                                        value={g[k]} onChange={e => setScore(i, k, e.target.value)} className={cn(INPUT, 'px-1.5 text-center tabular-nums')} />
                                ))}
                                <button type="button" aria-label={`Remove game ${i + 1}`} disabled={games.length === 1}
                                    onClick={() => setGames(gs => gs.filter((_, j) => j !== i))} className={cn(BTN_GHOST, BTN_SM, 'w-8 px-0')}>
                                    <X aria-hidden className="h-3.5 w-3.5" />
                                </button>
                            </Fragment>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p aria-live="polite" className={cn('text-xs', problem ? 'text-amber-300' : 'text-fg-subtle')}>
                            {problem ?? 'Leave unplayed games empty.'}
                        </p>
                        <button type="button" onClick={() => setGames(gs => [...gs, { a: '', b: '' }])} className={cn(BTN_GHOST, BTN_SM)}>
                            <Plus aria-hidden className="h-3.5 w-3.5" />Add game
                        </button>
                    </div>
                </div>

                <fieldset className="grid gap-2">
                    <legend className="mb-2 text-[13px] font-medium text-fg-muted">Winner</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                        {sides.map((s, i) => (
                            <label key={i} className={CHOICE}>
                                <input type="radio" name="sub-match-winner" className="mt-0.5 accent-primary"
                                    checked={!!winnerId && winnerId === s.id} onChange={() => setPicked(s.id)} />
                                <span className="min-w-0">
                                    <span className="block truncate text-sm font-medium text-fg">{s.name}</span>
                                    {s.players && <span className="mt-0.5 block truncate text-[13px] text-fg-muted">{s.players}</span>}
                                </span>
                            </label>
                        ))}
                    </div>
                </fieldset>

                {contradicts ? (
                    <Notice tone="amber" icon={AlertTriangle}>
                        The scores say {fromScores!.name} won {Math.max(won1, won2)}–{Math.min(won1, won2)}. Saving records {winner?.name} as the winner.
                        <button type="button" onClick={() => setPicked(null)} className="ml-1 font-medium underline underline-offset-2 hover:text-amber-200">
                            Use the scores
                        </button>
                    </Notice>
                ) : winner ? (
                    <Notice tone="neutral" icon={Trophy}>
                        <b className="font-medium text-fg">{winner.name}</b> {fromScores ? `wins ${Math.max(won1, won2)}–${Math.min(won1, won2)}.` : 'wins.'}
                    </Notice>
                ) : !problem && (
                    <p className="text-[13px] text-fg-subtle">Enter the game scores, or choose the winner.</p>
                )}
            </div>
        </Dialog>
    );
}
