import { useState } from 'react';
import { CircleAlert, Radio, RotateCcw, TriangleAlert, Trophy } from 'lucide-react';
import { badmintonMatchApi } from '@/sports/badminton/api/badmintonMatch';
import BadmintonScoringConsole from './teamLeague/BadmintonScoringConsole';
import type { MatchResultSectionProps } from '@/sports/_contracts/SportPlugin';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, BTN_SM } from '@/pages/organizer/shared';
import { ConfirmBar, Dialog, INPUT, Notice } from '@/pages/organizer/ui';
import { cn } from '@/lib/utils';

type Side = { id: string; name: string; isTBD: boolean };

function competitor(match: any, slot: 1 | 2, competitorType: 'player' | 'team'): Side {
    if (competitorType === 'player' && match[`player${slot}`]) {
        const p = match[`player${slot}`];
        return { id: p.registrationId, name: p.name, isTBD: p.registrationId === 'TBD' };
    }
    const id = match.teams?.[`team${slot}Id`] || '';
    const name = match.teams?.[`team${slot}Name`] || 'TBD';
    return { id, name, isTBD: name === 'TBD' };
}

const message = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

// Bars and notices follow whatever buttons the host puts beside this slot, on a line of their own.
const BAR = 'basis-full order-last';

/**
 * Scoring actions for one match. Renders a fragment (buttons, then full-width bars) so the
 * host's flex-wrap container decides the layout: a Matches row or the Brackets match dialog.
 */
export default function BadmintonMatchResultSection({ match, competitorType, onRecorded }: MatchResultSectionProps) {
    const c1 = competitor(match, 1, competitorType);
    const c2 = competitor(match, 2, competitorType);
    const isBye = match.status === 'walkover' && match.winReason === 'bye';
    const isCompleted = match.status === 'completed' || (match.status === 'walkover' && !isBye);
    const canScore = !isCompleted && !isBye && !c1.isTBD && !c2.isTBD;
    const isLive = match.status === 'in_progress';
    // Only a genuinely scored result can be corrected. The server accepts status
    // 'completed' and nothing else, so a walkover — which `isCompleted` above also
    // counts — must NOT offer the door, or the button would always fail with
    // "nothing to reopen". A bye has no result to correct either.
    const canReopen = match.status === 'completed';

    const [confirm, setConfirm] = useState<'live' | 'reopen' | null>(null);
    const [resultOpen, setResultOpen] = useState(false);
    const [liveOpen, setLiveOpen] = useState(false);
    const [reopening, setReopening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    const reopen = async () => {
        setReopening(true);
        setError(null);
        try {
            const out = await badmintonMatchApi.reopenMatch(match._id);
            setConfirm(null);
            // A warning means the reopen SUCCEEDED but the bracket could not be cleared,
            // leaving the organizer manual work. It stays on screen after the refetch.
            setWarning(out?.bracketWarning || null);
            onRecorded();
        } catch (e) {
            // The server's own message names which downstream match is blocking the
            // correction. Never replace it with something generic.
            setError(message(e, 'Failed to reopen match.'));
        } finally {
            setReopening(false);
        }
    };

    if (!canScore && !canReopen && !warning) return null;

    return (
        <>
            {canScore && (
                <>
                    <button type="button" onClick={() => (isLive ? setLiveOpen(true) : setConfirm('live'))} className={cn(BTN_SECONDARY, BTN_SM)}>
                        <Radio aria-hidden className="h-3.5 w-3.5" />{isLive ? 'Continue live' : 'Score live'}
                    </button>
                    <button type="button" onClick={() => { setConfirm(null); setResultOpen(true); }} className={cn(BTN_SECONDARY, BTN_SM)}>
                        Enter result
                    </button>
                </>
            )}
            {canReopen && (
                <button type="button" onClick={() => setConfirm('reopen')} disabled={reopening} className={cn(BTN_GHOST, BTN_SM)}>
                    <RotateCcw aria-hidden className="h-3.5 w-3.5" />Correct result
                </button>
            )}

            {confirm === 'live' && canScore && (
                <ConfirmBar
                    className={cn(BAR, 'rounded-lg border-t-0 text-left ring-1 ring-inset ring-line')}
                    message="Start live scoring? The match shows as Live to players and on the scoreboard."
                    confirmLabel="Start live scoring"
                    onConfirm={() => { setConfirm(null); setLiveOpen(true); }}
                    onCancel={() => setConfirm(null)}
                />
            )}
            {confirm === 'reopen' && canReopen && (
                <ConfirmBar
                    className={cn(BAR, 'rounded-lg border-t-0 text-left ring-1 ring-inset ring-line')}
                    message="Reopen this match to correct it? The result and the stats it credited are removed, and the winner is taken back out of the next round."
                    confirmLabel="Reopen match"
                    cancelLabel="Keep result"
                    danger
                    busy={reopening}
                    onConfirm={reopen}
                    onCancel={() => { setConfirm(null); setError(null); }}
                />
            )}
            {error && <div role="alert" className={cn(BAR, 'text-left')}><Notice tone="red" icon={CircleAlert}>{error}</Notice></div>}
            {warning && <div role="alert" className={cn(BAR, 'text-left')}><Notice tone="amber" icon={TriangleAlert}>{warning}</Notice></div>}

            {liveOpen && (
                <BadmintonScoringConsole
                    match={match}
                    startLiveScoring={badmintonMatchApi.startLiveScoring}
                    recordLivePoint={badmintonMatchApi.recordLivePoint}
                    onClose={() => setLiveOpen(false)}
                    onSaved={onRecorded}
                />
            )}
            {resultOpen && (
                <ResultDialog
                    match={match}
                    sides={[c1, c2]}
                    onClose={() => setResultOpen(false)}
                    onSaved={() => { setResultOpen(false); onRecorded(); }}
                />
            )}
        </>
    );
}

// ─── Result entry ─────────────────────────────────────────────────────────────

function ResultDialog({ match, sides: [c1, c2], onClose, onSaved }: {
    match: any; sides: [Side, Side]; onClose: () => void; onSaved: () => void;
}) {
    const bestOf = match.matchConfig?.bestOf || 1;
    const [scores, setScores] = useState(() => Array.from({ length: bestOf }, () => ['', ''] as [string, string]));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const set = (game: number, side: 0 | 1, raw: string) =>
        setScores(prev => prev.map((s, i) => {
            if (i !== game) return s;
            const next = [...s] as [string, string];
            next[side] = raw === '' ? '' : String(Math.max(0, parseInt(raw, 10) || 0));
            return next;
        }));

    // An unplayed game is left empty and never sent: a 0–0 game would read as played.
    const games = scores
        .map(([a, b], i) => ({ gameNumber: i + 1, a, b }))
        .filter(g => g.a !== '' && g.b !== '')
        .map(g => ({ gameNumber: g.gameNumber, team1Score: Number(g.a), team2Score: Number(g.b) }));
    const halfFilled = scores.some(([a, b]) => (a === '') !== (b === ''));
    const won1 = games.filter(g => g.team1Score > g.team2Score).length;
    const won2 = games.filter(g => g.team2Score > g.team1Score).length;
    const winner = halfFilled ? null : won1 > won2 ? c1 : won2 > won1 ? c2 : null;

    const save = async () => {
        if (!winner) return;
        setSaving(true);
        setError(null);
        try {
            await badmintonMatchApi.recordResult(match._id, winner.id, games);
            onSaved();
        } catch (e) {
            setError(message(e, 'Failed to record result.'));
            setSaving(false);
        }
    };

    return (
        <Dialog
            title={`Enter result${match.matchNumber ? ` · Match ${match.matchNumber}` : ''}`}
            description={`Best of ${bestOf}`}
            onClose={onClose}
            footer={<>
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>Cancel</button>
                <button type="button" onClick={save} disabled={!winner || saving} className={BTN_PRIMARY}>Save result</button>
            </>}
        >
            <div className="grid gap-4">
                <div role="group" aria-label="Game scores" className="grid grid-cols-[4.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2 text-[13px]">
                    <span />
                    <span className="truncate text-center text-xs text-fg-subtle" title={c1.name}>{c1.name}</span>
                    <span className="truncate text-center text-xs text-fg-subtle" title={c2.name}>{c2.name}</span>
                    {scores.map(([a, b], i) => (
                        <div key={i} className="contents">
                            <span className="text-fg-subtle">Game {i + 1}</span>
                            <input type="number" min={0} inputMode="numeric" value={a} aria-label={`Game ${i + 1}, ${c1.name}`}
                                onChange={e => set(i, 0, e.target.value)} className={cn(INPUT, 'text-center tabular-nums')} />
                            <input type="number" min={0} inputMode="numeric" value={b} aria-label={`Game ${i + 1}, ${c2.name}`}
                                onChange={e => set(i, 1, e.target.value)} className={cn(INPUT, 'text-center tabular-nums')} />
                        </div>
                    ))}
                </div>

                <div aria-live="polite">
                    <Notice tone="neutral" icon={Trophy}>
                        {winner
                            ? <><b className="font-medium text-fg">{winner.name}</b> wins {Math.max(won1, won2)}–{Math.min(won1, won2)}. </>
                            : halfFilled ? 'Enter both scores for each game played. ' : 'No winner yet. '}
                        Leave unplayed games empty.
                    </Notice>
                </div>

                {error && <div role="alert"><Notice tone="red" icon={CircleAlert}>{error}</Notice></div>}
            </div>
        </Dialog>
    );
}
