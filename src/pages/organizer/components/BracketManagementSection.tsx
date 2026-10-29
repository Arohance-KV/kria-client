import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Check, CircleAlert, ExternalLink, Info, Lock, RefreshCw, Shuffle, Users } from 'lucide-react';
import API from '../../../api/axios';
import { sportRegistry } from '@/sports/registry';
import type { MatchResultSectionProps } from '@/sports/_contracts/SportPlugin';
import { isDecidedFinal } from '@/lib/champion';
import {
    CARD_H, CARD_W, CONN_W, bracketHeight, computeCardPositions,
    getC1, getC2, isHiddenBye, isPlaceholderSlot, resolveSwapSlot,
    type LayoutMatch, type LayoutRound, type Slot,
} from '@/lib/bracketLayout';
import { cn } from '@/lib/utils';
import { useAppDispatch } from '@/store/hooks';
import { fetchTournamentCategories } from '@/store/slices/registrationSlice';
import { BTN_GHOST, BTN_PRIMARY, BTN_SECONDARY, BTN_SM, FOCUS, MATCH_STATUS, ToneBadge, type Tone } from '../shared';
import { CategoryTabs, ConfirmBar, Dialog, EmptyState, MoreMenu, Notice, PageHead, PANEL, Spinner, categoryMeta, useReadOnly, useSectionNav } from '../ui';
import { drawMatchesPairs, pairSummary, type PairingState } from '@/lib/pairs';
import { getPairs } from '@/api/pairs';
import PairingPanel from './PairingPanel';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & HELPERS (shared with MatchManagementSection)
// ═══════════════════════════════════════════════════════════════════════════════

interface CategoryInfo { _id: string; name: string; status: string; bracketType?: string; sport?: string; matchType?: string }

export type BracketMatch = LayoutMatch & {
    positionInRound?: number;
    competitorType?: 'player' | 'team';
    winnerId?: string;
    result?: { team1Total?: number; team2Total?: number; marginOfVictory?: string };
    gameScores?: { gameNumber: number; team1Score: number; team2Score: number }[];
    matchConfig?: { bestOf?: number; pointsToWin?: number };
};

export type CompetitorType = 'player' | 'team';
export type ResultSlot = React.ComponentType<MatchResultSectionProps>;

export interface MatchesPayload { matches: BracketMatch[]; rounds: Record<string, BracketMatch[]>; competitorType: CompetitorType }

export const errorMessage = (err: any, fallback: string): string =>
    err?.response?.data?.message || err?.response?.data?.data?.message || fallback;

export async function fetchCategoryMatches(categoryId: string): Promise<MatchesPayload> {
    const res = await API.get(`/matches/categories/${categoryId}`);
    const payload = res.data?.data?.data || res.data?.data || {};
    return { matches: payload.matches || [], rounds: payload.rounds || {}, competitorType: payload.competitorType || 'player' };
}

/** Round names in play order. */
export const sortedRounds = (rounds: Record<string, BracketMatch[]>) =>
    Object.keys(rounds).sort((a, b) => (rounds[a]?.[0]?.roundNumber || 0) - (rounds[b]?.[0]?.roundNumber || 0));

/** "21–15, 21–12" */
export const gamesText = (m: BracketMatch) => (m.gameScores || []).map(g => `${g.team1Score}–${g.team2Score}`).join(', ');

/** A scheduled match still missing a competitor reads as "Waiting". */
export function matchStatus(m: BracketMatch, waiting: boolean): { label: string; tone: Tone; live?: boolean } {
    if (waiting && m.status === 'scheduled') return MATCH_STATUS.waiting;
    return MATCH_STATUS[m.status] ?? { label: m.status, tone: 'neutral' };
}

export const isDone = (m: BracketMatch) => m.status === 'completed' || (m.status === 'walkover' && !isHiddenBye(m));

/** The public scoreboard for screens, in a new tab. */
export const ScoreboardLink = ({ matchId, label, className, children }: { matchId: string; label: string; className?: string; children: React.ReactNode }) => (
    <a href={`/live/${matchId}`} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}
        onClick={e => e.stopPropagation()} className={cn('rounded', FOCUS, className)}>
        {children}
    </a>
);

const WinnerMark = () => (
    <><Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-emerald-400" /><span className="sr-only">(winner)</span></>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface Props {
    tournamentId: string;
    sports: string[];
    categories: CategoryInfo[];
}

interface SwapSelection {
    /** The first-round match and slot the swap is actually applied to. */
    matchId: string;
    slot: Slot;
    /** The card the organizer clicked, which for a bye-fed competitor is a later round. */
    clickedMatchId: string;
    clickedSlot: Slot;
    name: string;
}

const BracketManagementSection: React.FC<Props> = ({ tournamentId, sports, categories }) => {
    const goTo = useSectionNav();
    const readOnly = useReadOnly();
    const dispatch = useAppDispatch();

    const [selectedCat, setSelectedCat] = useState('');
    const [data, setData] = useState<MatchesPayload>({ matches: [], rounds: {}, competitorType: 'player' });
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<'generate' | 'reshuffle' | 'redo' | null>(null);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [openMatchId, setOpenMatchId] = useState<string | null>(null);

    // Doubles: the last pairing state gates Generate, names who sits out, and
    // tells a draw that no longer matches its pairs. `pairsKey` remounts the
    // panel after a redraw so it reloads the draw's sides.
    const [pairs, setPairs] = useState<PairingState | null>(null);
    const [editPairs, setEditPairs] = useState(false);
    const [pairsKey, setPairsKey] = useState(0);

    const [swapMode, setSwapMode] = useState(false);
    const [swapSelection, setSwapSelection] = useState<SwapSelection | null>(null);
    const [swapping, setSwapping] = useState(false);
    const [swapError, setSwapError] = useState<string | null>(null);

    // Categories can arrive after mount, and the selected one can disappear; either way
    // fall back to the first category with a draw to show (team leagues live elsewhere).
    useEffect(() => {
        if (categories.some(c => c._id === selectedCat)) return;
        setSelectedCat((categories.find(c => c.bracketType !== 'team_league') ?? categories[0])?._id ?? '');
    }, [categories, selectedCat]);

    const category = categories.find(c => c._id === selectedCat);
    const isTeamLeague = category?.bracketType === 'team_league';
    const isDoubles = category?.matchType === 'doubles';
    const pairCount = pairs ? pairSummary(pairs) : null;
    // The selected category's own sport picks the plugin; the tournament's first sport
    // is only a fallback for a category that doesn't say. Every scoring path (and cricket's
    // "View match", whose page can correct a result) goes through it, so a locked tournament gets none.
    const ResultSection = readOnly ? undefined : sportRegistry.get(category?.sport || sports[0])?.matchResultSection;

    const { matches, rounds, competitorType } = data;
    const hasBracket = matches.length > 0;
    const hasResults = matches.some(m => m.status === 'completed');

    // A slow response for a category the organizer has already left must not land.
    const current = useRef(selectedCat);
    current.current = selectedCat;

    const load = useCallback(async (quiet = false) => {
        const cat = selectedCat;
        if (!cat || isTeamLeague) return;
        if (!quiet) { setLoading(true); setData({ matches: [], rounds: {}, competitorType: 'player' }); }
        try {
            const next = await fetchCategoryMatches(cat);
            if (current.current !== cat) return;
            setData(next);
            setLoadError(null);
        } catch (err) {
            if (current.current === cat) setLoadError(errorMessage(err, 'Could not load the bracket.'));
        } finally {
            if (current.current === cat && !quiet) setLoading(false);
        }
    }, [selectedCat, isTeamLeague]);

    useEffect(() => {
        setPairs(null); setEditPairs(false);
        setSwapMode(false); setSwapSelection(null); setSwapError(null);
        setConfirm(null); setActionError(null); setOpenMatchId(null); setLoadError(null);
        setLoading(false); // a team league never loads; don't inherit a spinner from the last category
        load();
    }, [load]);

    const refresh = useCallback(() => load(true), [load]);

    // A drawn doubles category still open to edits: know its pairs even with the
    // panel closed, so a draw left stale by an unpair or a team change says so.
    const drawnOpenDoubles = isDoubles && hasBracket && !hasResults;
    useEffect(() => {
        if (!drawnOpenDoubles) return;
        const cat = selectedCat;
        getPairs(cat).then(s => { if (current.current === cat) setPairs(s); }, () => undefined);
    }, [drawnOpenDoubles, selectedCat, data]);
    const stale = drawnOpenDoubles && !!pairs && !drawMatchesPairs(pairs);

    const redo = async () => {
        setBusy(true); setActionError(null);
        try {
            // generate rebuilds over a draw nobody has played, from the current pairs.
            await API.post(`/matches/generate/${selectedCat}`);
            setConfirm(null);
            setPairsKey(k => k + 1);
            dispatch(fetchTournamentCategories(tournamentId)); // as generate: the server owns the status
            await refresh();
        } catch (err) {
            setActionError(errorMessage(err, 'Could not redo the draw.'));
        } finally { setBusy(false); }
    };

    const generate = async () => {
        setBusy(true); setActionError(null);
        try {
            // One draw, one consistent status. Out of auction, configure-bracket is the
            // lifecycle step: it builds the draw itself and moves the category to "Bracket
            // ready" (it accepts auction only). Anywhere else, generate builds the draw alone.
            // Both refuse to rebuild over played matches, and this button only shows when
            // there is no draw at all.
            if (category?.status === 'auction') await API.post(`/categories/${selectedCat}/configure-bracket`);
            else await API.post(`/matches/generate/${selectedCat}`);
            setConfirm(null);
            dispatch(fetchTournamentCategories(tournamentId)); // the category's status may have moved
            await refresh();
        } catch (err) {
            setActionError(errorMessage(err, 'Could not generate the bracket.'));
        } finally { setBusy(false); }
    };

    const reshuffle = async () => {
        setBusy(true); setActionError(null);
        try {
            await API.post(`/matches/reshuffle/${selectedCat}`);
            setConfirm(null);
            setSwapSelection(null);
            await refresh();
        } catch (err) {
            setActionError(errorMessage(err, 'Could not reshuffle round 1.'));
        } finally { setBusy(false); }
    };

    const handleSwapClick = (match: BracketMatch, slot: Slot, name: string) => {
        // The clicked slot may be a later round showing a competitor who had a
        // bye. The swap is applied to the first-round slot that really holds them.
        const target = resolveSwapSlot(match, slot, matches, competitorType);
        if (!target || swapping) return;
        setSwapError(null);
        if (!swapSelection) {
            setSwapSelection({ ...target, clickedMatchId: match._id, clickedSlot: slot, name });
        } else if (swapSelection.matchId === target.matchId && swapSelection.slot === target.slot) {
            setSwapSelection(null);
        } else {
            executeSwap(swapSelection.matchId, swapSelection.slot, target.matchId, target.slot);
        }
    };

    const executeSwap = async (matchId1: string, slot1: Slot, matchId2: string, slot2: Slot) => {
        setSwapping(true);
        try {
            await API.put('/matches/swap', { matchId1, slot1, matchId2, slot2 });
            setSwapSelection(null);
            await refresh();
        } catch (err) {
            setSwapError(errorMessage(err, 'Swap failed.'));
        } finally { setSwapping(false); }
    };

    const toggleSwap = () => { setSwapMode(on => !on); setSwapSelection(null); setSwapError(null); setConfirm(null); };

    const layout: LayoutRound[] = sortedRounds(rounds)
        .map(name => ({
            name,
            matches: (rounds[name] || []).slice()
                .sort((a, b) => (a.positionInRound ?? a.matchNumber) - (b.positionInRound ?? b.matchNumber)),
        }))
        .filter(r => r.matches.length > 0);
    const league = layout.filter(r => r.name === 'League');
    const knockout = layout.filter(r => r.name !== 'League');
    const openMatch = matches.find(m => m._id === openMatchId) ?? null;

    const cardProps: CardContext = {
        competitorType, swapMode, swapSelection, allMatches: matches,
        onSwapClick: handleSwapClick, onOpen: id => setOpenMatchId(id),
    };

    const ready = !!category && !isTeamLeague && !loading && !loadError;
    const editable = ready && !readOnly;
    const actions = (
        <>
            {selectedCat && (
                <a href={`/bracket/${tournamentId}/${selectedCat}`} target="_blank" rel="noopener noreferrer" className={BTN_GHOST}>
                    <ExternalLink aria-hidden className="h-4 w-4" />Public bracket
                </a>
            )}
            {editable && !hasBracket && (
                <button type="button" onClick={() => setConfirm('generate')} className={BTN_PRIMARY}
                    disabled={isDoubles && (pairCount?.pairs ?? 0) < 2}>Generate bracket</button>
            )}
            {editable && hasBracket && !hasResults && (
                <>
                    {isDoubles && (
                        <button type="button" onClick={() => setEditPairs(on => !on)} className={editPairs ? BTN_PRIMARY : BTN_SECONDARY}>
                            <Users aria-hidden className="h-4 w-4" />{editPairs ? 'Done editing pairs' : 'Edit pairs'}
                        </button>
                    )}
                    <button type="button" onClick={toggleSwap} className={swapMode ? BTN_PRIMARY : BTN_SECONDARY}>
                        <ArrowLeftRight aria-hidden className="h-4 w-4" />{swapMode ? 'Done swapping' : isDoubles ? 'Swap pairs' : 'Swap players'}
                    </button>
                    <MoreMenu label="More bracket actions" items={[
                        { label: 'Reshuffle round 1', icon: Shuffle, onSelect: () => setConfirm('reshuffle') },
                        ...(isDoubles ? [{ label: 'Redo draw', icon: RefreshCw, onSelect: () => setConfirm('redo') }] : []),
                    ]} />
                </>
            )}
            {ready && hasResults && (
                <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-subtle">
                    <Lock aria-hidden className="h-3.5 w-3.5" />Draw locked: results are in
                </span>
            )}
        </>
    );

    const body = () => {
        if (!category) {
            return (
                <section className={PANEL}>
                    <EmptyState title="No categories yet" text="Add a category first. Its draw appears here once generated."
                        action={<button type="button" onClick={() => goTo('categories')} className={BTN_SECONDARY}>Open Categories</button>} />
                </section>
            );
        }
        if (isTeamLeague) {
            return (
                <Notice tone="blue" icon={Info}>
                    Team league categories are run from{' '}
                    <button type="button" onClick={() => goTo('team_league')} className={cn('rounded underline underline-offset-2 hover:text-sky-200', FOCUS)}>Team league</button>
                    , where you set up groups, ties and lineups.
                </Notice>
            );
        }
        if (loading) return <section className={PANEL}><Spinner label="Loading bracket" /></section>;
        if (loadError && !hasBracket) {
            return (
                <section className={cn(PANEL, 'p-4')}>
                    <div role="alert"><Notice tone="red" icon={CircleAlert}>Couldn't load the bracket. {loadError}</Notice></div>
                    <button type="button" onClick={() => load()} className={cn(BTN_SECONDARY, 'mt-3')}>Try again</button>
                </section>
            );
        }
        if (!hasBracket && isDoubles) {
            return <PairingPanel categoryId={selectedCat} readOnly={readOnly} onChange={setPairs} />;
        }
        if (!hasBracket) {
            return (
                <section className={PANEL}>
                    <EmptyState title="No bracket yet" text="Generate the draw once entries are final. Players are placed at random."
                        action={!readOnly && <button type="button" onClick={() => setConfirm('generate')} className={BTN_PRIMARY}>Generate bracket</button>} />
                </section>
            );
        }
        const hint = !swapMode && !readOnly && <span className="text-[12.5px] text-fg-subtle">Click a match to score it</span>;
        const entrants = (knockout[0]?.matches ?? []).reduce((n, m) =>
            n + [getC1(m, competitorType), getC2(m, competitorType)].filter(c => !isPlaceholderSlot(c)).length, 0);
        return (
            <>
                {loadError && <div role="alert"><Notice tone="red" icon={CircleAlert}>Couldn't refresh the bracket. {loadError}</Notice></div>}
                {stale && !readOnly && (
                    <Notice tone="amber" icon={CircleAlert}>
                        <span>The draw doesn't match the pairs any more. Redo draw to rebuild it.</span>{' '}
                        <button type="button" onClick={() => setConfirm('redo')} className={cn(BTN_SECONDARY, BTN_SM, 'ml-1')}>Redo draw</button>
                    </Notice>
                )}
                {editPairs && (
                    <PairingPanel key={pairsKey} categoryId={selectedCat} readOnly={readOnly} onChange={setPairs} onWrite={refresh} />
                )}
                {league.length > 0 && (
                    <section className={PANEL} aria-label="League fixtures">
                        <PanelHead title="League fixtures" meta={`${league[0].matches.filter(m => !isHiddenBye(m)).length} matches`} hint={hint} />
                        <div className="grid grid-cols-1 gap-2.5 p-4 sm:grid-cols-2 xl:grid-cols-3">
                            {league[0].matches.filter(m => !isHiddenBye(m)).map(m => <MatchCard key={m._id} match={m} ctx={cardProps} />)}
                        </div>
                    </section>
                )}
                {knockout.length > 0 && (
                    <section className={PANEL} aria-label="Knockout draw">
                        <PanelHead
                            title="Knockout draw"
                            meta={`${league.length ? '' : `${entrants} ${competitorType === 'team' ? 'teams' : 'players'} · `}${knockout.length} round${knockout.length === 1 ? '' : 's'}`}
                            hint={hint}
                        />
                        {/* A real, visible scrollbar: wide draws scroll sideways. */}
                        <div className="overflow-x-auto p-4 [scrollbar-width:thin]">
                            <KnockoutTree rounds={knockout} ctx={cardProps} />
                        </div>
                    </section>
                )}
            </>
        );
    };

    return (
        <div className="flex flex-col gap-5">
            <PageHead
                title="Brackets"
                desc="The draw for each category. Click a match to score it, or swap players before results come in."
                actions={actions}
            />

            {categories.length > 0 && (
                <CategoryTabs
                    categories={categories.map(c => ({ _id: c._id, name: c.name, meta: categoryMeta(c.bracketType, c.status) }))}
                    value={selectedCat}
                    onChange={setSelectedCat}
                />
            )}

            {swapMode && (
                <Notice tone="blue" icon={ArrowLeftRight}>
                    <b className="font-medium">Swap mode.</b>{' '}
                    {swapping ? 'Swapping…' : swapSelection ? (
                        <>Picked <b className="font-medium">{swapSelection.name}</b>. Now click the player to swap with, or{' '}
                            <button type="button" onClick={() => setSwapSelection(null)} className={cn('rounded underline underline-offset-2 hover:text-sky-200', FOCUS)}>cancel</button>.</>
                    ) : 'Click a highlighted player, then click another to swap them. Players placed by a played result can\'t be moved.'}
                </Notice>
            )}
            {swapError && <div role="alert"><Notice tone="red" icon={CircleAlert}>{swapError}</Notice></div>}

            {confirm === 'generate' && (
                <div className={cn(PANEL, 'overflow-hidden')}>
                    <ConfirmBar
                        className="border-t-0"
                        message={`Generate the draw for ${category?.name}? ${isDoubles
                            ? `${pairCount?.pairs ?? 0} pairs are placed at random.${pairCount?.unpaired.length ? ` Unpaired, so not in the draw: ${pairCount.unpaired.join(', ')}.` : ''}`
                            : 'Players are placed randomly. You can swap or reshuffle until the first result.'}${category?.status === 'auction' ? ' The category moves to Bracket ready.' : ''}`}
                        confirmLabel="Generate bracket"
                        busy={busy}
                        onConfirm={generate}
                        onCancel={() => { setConfirm(null); setActionError(null); }}
                    />
                </div>
            )}
            {confirm === 'redo' && (
                <div className={cn(PANEL, 'overflow-hidden')}>
                    <ConfirmBar
                        className="border-t-0"
                        message={`Redo the draw for ${category?.name}? It's rebuilt from the current pairs and placed at random.`}
                        confirmLabel="Redo draw"
                        danger
                        busy={busy}
                        onConfirm={redo}
                        onCancel={() => { setConfirm(null); setActionError(null); }}
                    />
                </div>
            )}
            {confirm === 'reshuffle' && (
                <div className={cn(PANEL, 'overflow-hidden')}>
                    <ConfirmBar
                        className="border-t-0"
                        message="Reshuffle round 1? Every first-round pairing is redrawn at random."
                        confirmLabel="Reshuffle"
                        danger
                        busy={busy}
                        onConfirm={reshuffle}
                        onCancel={() => { setConfirm(null); setActionError(null); }}
                    />
                </div>
            )}
            {actionError && <div role="alert"><Notice tone="red" icon={CircleAlert}>{actionError}</Notice></div>}

            {body()}

            {openMatch && !swapMode && (
                <MatchDialog
                    match={openMatch}
                    competitorType={competitorType}
                    ResultSection={ResultSection}
                    onRecorded={refresh}
                    onClose={() => setOpenMatchId(null)}
                />
            )}
        </div>
    );
};

const PanelHead = ({ title, meta, hint }: { title: string; meta: string; hint: React.ReactNode }) => (
    <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-4 py-3">
        <h2 className="flex items-baseline gap-2 text-sm font-semibold text-fg">
            {title} <span className="text-[13px] font-normal text-fg-subtle">{meta}</span>
        </h2>
        {hint}
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// KNOCKOUT TREE — absolutely positioned cards with SVG elbow connectors
// ═══════════════════════════════════════════════════════════════════════════════

const HEAD_H = 32; // room for the round headers above the first card

interface CardContext {
    competitorType: CompetitorType;
    swapMode: boolean;
    swapSelection: SwapSelection | null;
    allMatches: BracketMatch[];
    onSwapClick: (match: BracketMatch, slot: Slot, name: string) => void;
    onOpen: (matchId: string) => void;
}

const KnockoutTree = ({ rounds, ctx }: { rounds: LayoutRound[]; ctx: CardContext }) => {
    // Byes stay in the layout — they hold the geometry every later card centres
    // on — but they are never rendered, because a bye card only ever repeats the
    // name already shown on the card it feeds.
    const pos = computeCardPositions(rounds);
    const width = rounds.length * CARD_W + (rounds.length - 1) * CONN_W;
    const height = HEAD_H + bracketHeight(pos);
    const left = (ri: number) => ri * (CARD_W + CONN_W);
    const mid = (id: string) => HEAD_H + (pos.get(id) ?? 0) + CARD_H / 2;

    // One elbow per visible card into the card it feeds. A hidden bye has no card to
    // leave from; its sibling's elbow still lands on the next card's centre, because
    // the bye's reserved slot was counted there.
    const links = rounds.slice(0, -1).flatMap((round, ri) => round.matches
        .filter(m => m.nextMatchId && !isHiddenBye(m) && rounds[ri + 1].matches.some(n => n._id === m.nextMatchId))
        .map(m => {
            const x1 = left(ri) + CARD_W;
            return <path key={m._id} d={`M${x1} ${mid(m._id)} H${x1 + CONN_W / 2} V${mid(m.nextMatchId!)} H${left(ri + 1)}`} />;
        }));

    return (
        <div className="relative" style={{ width, height }}>
            <svg aria-hidden className="pointer-events-none absolute inset-0" width={width} height={height}
                fill="none" stroke="var(--color-line)" strokeWidth={1.5}>
                {links}
            </svg>
            {rounds.map((round, ri) => {
                // A bye is not a match, so the two are reported separately.
                const byes = round.matches.filter(isHiddenBye).length;
                const playable = round.matches.length - byes;
                return (
                    <React.Fragment key={round.name}>
                        <p className="absolute top-0 truncate text-xs text-fg-subtle" style={{ left: left(ri), width: CARD_W }}>
                            <span className="font-medium text-fg-muted">{round.name}</span>
                            {` · ${playable} match${playable === 1 ? '' : 'es'}`}
                            {byes > 0 && ` · ${byes} bye${byes === 1 ? '' : 's'}`}
                        </p>
                        {round.matches.filter(m => !isHiddenBye(m)).map(m => (
                            <MatchCard key={m._id} match={m as BracketMatch} ctx={ctx}
                                style={{ position: 'absolute', left: left(ri), top: HEAD_H + (pos.get(m._id) ?? 0), width: CARD_W, height: CARD_H }} />
                        ))}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MATCH CARD — opens the match dialog; in swap mode its sides are the controls
// ═══════════════════════════════════════════════════════════════════════════════

const MatchCard = ({ match, ctx, style }: { match: BracketMatch; ctx: CardContext; style?: React.CSSProperties }) => {
    const { competitorType, swapMode, swapSelection, allMatches, onSwapClick, onOpen } = ctx;
    const c1 = getC1(match, competitorType);
    const c2 = getC2(match, competitorType);
    const live = match.status === 'in_progress';
    const done = isDone(match);
    // Winning the final wins the whole category, so that card says so.
    const champions = isDecidedFinal(match);
    const status = champions ? { label: 'Champions', tone: 'amber' as Tone } : matchStatus(match, c1.isTBD || c2.isTBD);
    const name = (c: typeof c1) => (c.isTBD ? 'to be decided' : c.name);

    const side = (slot: Slot, c: typeof c1, score?: number) => {
        const win = done && !!match.winnerId && match.winnerId === c.id;
        // A name is movable where it is shown; resolveSwapSlot finds the first-round
        // slot behind it, and null means it is not the organizer's to move.
        const canSwap = swapMode && !!resolveSwapSlot(match, slot, allMatches, competitorType);
        const picked = swapSelection?.clickedMatchId === match._id && swapSelection.clickedSlot === slot;
        const cls = cn('flex h-8 w-full items-center gap-2 px-2.5 text-left text-[13px]', slot === 'player2' && 'border-t border-line');
        const content = (
            <>
                <span title={c.teamName ? `${c.name} · ${c.teamName}` : undefined}
                    className={cn('min-w-0 flex-1 truncate', c.isTBD ? 'italic text-fg-subtle' : win ? 'font-semibold text-fg' : 'text-fg-muted')}>
                    {c.isTBD ? 'To be decided' : c.name}
                </span>
                {win && <WinnerMark />}
                <span className={cn('min-w-3 text-right tabular-nums', win ? 'font-semibold text-fg' : 'text-fg-subtle')}>{score ?? ''}</span>
            </>
        );
        if (!canSwap) return <span className={cls}>{content}</span>;
        return (
            <button type="button" aria-pressed={picked} aria-label={`${picked ? 'Picked' : 'Swap'} ${c.name}`}
                onClick={() => onSwapClick(match, slot, c.name)}
                className={cn(cls, FOCUS, picked ? 'bg-sky-400/[0.18] ring-1 ring-inset ring-sky-400/70' : 'bg-sky-400/[0.06] hover:bg-sky-400/[0.12]')}>
                {content}
            </button>
        );
    };

    const sides = <>{side('player1', c1, match.result?.team1Total)}{side('player2', c2, match.result?.team2Total)}</>;
    const open = swapMode ? undefined : () => onOpen(match._id);

    return (
        <div style={style}
            className={cn('overflow-hidden rounded-[10px] border bg-canvas transition-colors',
                live ? 'border-red-400/30' : champions ? 'border-amber-400/40' : 'border-line',
                !swapMode && 'hover:border-white/20')}>
            <div onClick={open} className={cn('flex h-8 items-center justify-between gap-2 border-b border-line px-2.5 text-[11.5px] text-fg-subtle', open && 'cursor-pointer')}>
                <span className="truncate">Match {match.matchNumber}</span>
                <span className="flex shrink-0 items-center gap-1.5">
                    <ToneBadge label={status.label} tone={status.tone} live={status.live} />
                    {(live || done) && (
                        <ScoreboardLink matchId={match._id} label={`${live ? 'Live scoreboard' : 'Scorecard'}, match ${match.matchNumber}`} className="text-fg-subtle hover:text-fg">
                            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
                        </ScoreboardLink>
                    )}
                </span>
            </div>
            {open ? (
                <button type="button" onClick={open} aria-label={`Match ${match.matchNumber}: ${name(c1)} vs ${name(c2)}, ${status.label}. Open match`}
                    className={cn('block w-full text-left', FOCUS, 'focus-visible:ring-inset')}>
                    {sides}
                </button>
            ) : sides}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MATCH DIALOG — the sport's scoring slot, plus the scoreboard link
// ═══════════════════════════════════════════════════════════════════════════════

const MatchDialog = ({ match, competitorType, ResultSection, onRecorded, onClose }: {
    match: BracketMatch; competitorType: CompetitorType; ResultSection?: ResultSlot; onRecorded: () => void; onClose: () => void;
}) => {
    const c1 = getC1(match, competitorType);
    const c2 = getC2(match, competitorType);
    const waiting = c1.isTBD || c2.isTBD;
    const done = isDone(match);
    const status = isDecidedFinal(match) ? { label: 'Champions', tone: 'amber' as Tone } : matchStatus(match, waiting);
    const games = gamesText(match);

    const row = (c: typeof c1, score?: number) => {
        const win = done && !!match.winnerId && match.winnerId === c.id;
        return (
            <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0">
                    <p className={cn('flex items-center gap-1.5 truncate text-sm', c.isTBD ? 'italic text-fg-subtle' : win ? 'font-semibold text-fg' : 'text-fg-muted')}>
                        {c.isTBD ? 'To be decided' : c.name}{win && <WinnerMark />}
                    </p>
                    {competitorType === 'player' && c.teamName && !c.isTBD && <p className="truncate text-xs text-fg-subtle">{c.teamName}</p>}
                </div>
                <span className={cn('tabular-nums', win ? 'font-semibold text-fg' : 'text-fg-subtle')}>{score ?? ''}</span>
            </div>
        );
    };

    return (
        <Dialog title={`Match ${match.matchNumber} · ${match.bracketRound}`} onClose={onClose}>
            <div className="grid gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    <ToneBadge label={status.label} tone={status.tone} live={status.live} />
                    {games && <span className="text-[12.5px] tabular-nums text-fg-subtle">{games}</span>}
                    {!games && done && match.result?.marginOfVictory && <span className="text-[12.5px] text-fg-subtle">{match.result.marginOfVictory}</span>}
                </div>
                <div className="divide-y divide-line">
                    {row(c1, match.result?.team1Total)}
                    {row(c2, match.result?.team2Total)}
                </div>
                {waiting ? (
                    <p className="text-[13px] text-fg-muted">Waiting for players. Scoring opens once both sides are known.</p>
                ) : ResultSection && (
                    <div className="flex flex-wrap items-center gap-2">
                        <ResultSection match={match} competitorType={competitorType} onRecorded={onRecorded} />
                    </div>
                )}
                <ScoreboardLink matchId={match._id} label="Open live scoreboard" className="inline-flex w-fit items-center gap-1 text-[13px] text-fg-muted hover:text-fg">
                    <ExternalLink aria-hidden className="h-3.5 w-3.5" />Open live scoreboard
                </ScoreboardLink>
            </div>
        </Dialog>
    );
};

export default BracketManagementSection;
