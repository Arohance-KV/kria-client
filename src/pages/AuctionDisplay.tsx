import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { auctionApi } from '../api/auction';
import { AuctionStatus, Player, Team } from '../types';
import SpinTheWheel from '../components/SpinTheWheel';
import { socket } from '../lib/socket';

// ============================================================================
// CONSTANTS
// ============================================================================
const ACCENT = '#FF7A00';
const CONFETTI_COLORS = [ACCENT, '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#fff'];

// ============================================================================
// HELPER: Skill level badge styling
// ============================================================================
const getSkillBadge = (level: string) => {
    switch (level?.toLowerCase()) {
        case 'beginner':     return { bg: 'rgba(37,99,235,0.15)',  color: '#60a5fa', border: 'rgba(37,99,235,0.4)' };
        case 'intermediate': return { bg: 'rgba(217,119,6,0.15)',  color: '#fbbf24', border: 'rgba(217,119,6,0.4)' };
        case 'advanced':     return { bg: 'rgba(255,122,0,0.15)',  color: ACCENT,    border: 'rgba(255,122,0,0.4)' };
        case 'expert':       return { bg: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: 'rgba(124,58,237,0.4)' };
        default:             return { bg: 'rgba(75,85,99,0.15)',   color: '#9ca3af', border: 'rgba(75,85,99,0.4)' };
    }
};

// ============================================================================
// CONFETTI OVERLAY
// ============================================================================
const ConfettiOverlay: React.FC<{ show: boolean }> = ({ show }) => {
    if (!show) return null;
    return (
        <div className="confetti-container">
            {Array.from({ length: 80 }).map((_, i) => (
                <div
                    key={i}
                    className="confetti-piece"
                    style={{
                        left: `${Math.random() * 100}%`,
                        backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                        animationDelay: `${Math.random() * 2.5}s`,
                        animationDuration: `${2.5 + Math.random() * 2}s`,
                        width: `${10 + Math.random() * 10}px`,
                        height: `${16 + Math.random() * 14}px`,
                        transform: `rotate(${Math.random() * 360}deg)`,
                    }}
                />
            ))}
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const AuctionDisplay: React.FC = () => {
    const { tournamentId, categoryId } = useParams<{ tournamentId: string; categoryId: string }>();
    const [status, setStatus]           = useState<AuctionStatus | null>(null);
    const [player, setPlayer]           = useState<Player | null>(null);
    const [teams, setTeams]             = useState<Team[]>([]);
    const [loading, setLoading]         = useState(true);
    const [tournamentName, setTournamentName] = useState('');
    const [categoryName, setCategoryName]     = useState('');
    const [soldLog, setSoldLog]         = useState<any[]>([]);
    const [showConfetti, setShowConfetti] = useState(false);
    const [bidFlash, setBidFlash]       = useState(false);

    const prevStatusRef   = useRef<string | null>(null);
    const prevBidPriceRef = useRef<number>(0);

    // ── Apply auction data update (shared between initial load and socket) ─────
    const applyUpdate = (data: any) => {
        setStatus(data.auction);
        setPlayer(data.currentPlayer);
        setTeams(data.teams);
        setTournamentName(data.tournament?.name || '');
        setCategoryName(data.category?.name || '');
        setLoading(false);

        if (data.auction.status === 'sold' && prevStatusRef.current !== 'sold') {
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4500);
        }
        prevStatusRef.current = data.auction.status;
    };

    // ── Initial load + socket connection ─────────────────────────────────────
    useEffect(() => {
        if (!tournamentId || !categoryId) return;

        // Load initial state immediately
        auctionApi.getStatus(tournamentId, categoryId)
            .then(applyUpdate)
            .catch((err) => console.error('Initial auction load error', err));

        // Connect and join socket room
        socket.connect();
        socket.emit('join:auction', { tournamentId, categoryId });
        socket.on('auction:update', applyUpdate);

        return () => {
            socket.off('auction:update', applyUpdate);
            socket.emit('leave:auction', { tournamentId, categoryId });
            socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tournamentId, categoryId]);

    // ── Fetch sold log ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!tournamentId || !categoryId) return;
        auctionApi.getSoldLog(tournamentId, categoryId)
            .then((data: any) => setSoldLog(data.logs || []))
            .catch(() => {});
    }, [tournamentId, categoryId, status?.logsCount]);

    // ── Bid flash animation ───────────────────────────────────────────────────
    useEffect(() => {
        const currentBid = status?.liveBid?.currentPrice || 0;
        if (currentBid > prevBidPriceRef.current && prevBidPriceRef.current > 0) {
            setBidFlash(true);
            const t = setTimeout(() => setBidFlash(false), 700);
            prevBidPriceRef.current = currentBid;
            return () => clearTimeout(t);
        }
        prevBidPriceRef.current = currentBid;
    }, [status?.liveBid?.currentPrice]);

    // ── LOADING ───────────────────────────────────────────────────────────────
    if (loading) return (
        <div style={{ background: '#0B0B0B' }} className="min-h-screen flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div style={{ width: '48px', height: '48px', border: `3px solid ${ACCENT}30`, borderTop: `3px solid ${ACCENT}`, borderRadius: '50%' }} className="animate-spin" />
                <span style={{ color: '#4b5563', fontFamily: 'Oswald, sans-serif', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.25em' }}>
                    Loading Auction
                </span>
            </div>
        </div>
    );

    if (!status) return (
        <div style={{ background: '#0B0B0B' }} className="min-h-screen flex items-center justify-center text-red-500 text-2xl font-oswald font-bold">
            Auction Not Found
        </div>
    );

    // ── NOT STARTED ───────────────────────────────────────────────────────────
    if (status.status === 'not_started') {
        return (
            <div style={{ background: '#0B0B0B' }} className="min-h-screen flex flex-col items-center justify-center text-white overflow-hidden relative">
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at center, ${ACCENT}07 0%, transparent 65%)`, pointerEvents: 'none' }} />
                <div className="z-10 text-center px-8">
                    <div style={{ color: ACCENT, fontSize: '11px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '20px' }}>
                        Badminton League Auction
                    </div>
                    <h1 className="font-oswald font-black text-white uppercase leading-none tracking-tight" style={{ fontSize: 'clamp(56px, 9vw, 96px)' }}>
                        {tournamentName || 'TOURNAMENT'}
                    </h1>
                    {categoryName && (
                        <h2 className="font-oswald uppercase tracking-widest" style={{ fontSize: '22px', color: '#6b7280', marginTop: '10px' }}>
                            {categoryName} — Auction
                        </h2>
                    )}
                    <div style={{ width: '56px', height: '3px', background: ACCENT, margin: '28px auto 36px', borderRadius: '999px' }} />
                    <div className="flex items-center justify-center gap-3">
                        <div style={{ width: '10px', height: '10px', background: ACCENT, borderRadius: '50%', boxShadow: `0 0 14px ${ACCENT}` }} className="animate-ping" />
                        <span style={{ color: '#6b7280', fontFamily: 'Oswald, sans-serif', fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
                            Starting Soon
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ── SOLD CELEBRATION ──────────────────────────────────────────────────────
    if (status.status === 'sold' && status.lastSoldResult) {
        return (
            <div style={{ background: '#0B0B0B' }} className="min-h-screen flex flex-col items-center justify-center text-white relative overflow-hidden">
                <ConfettiOverlay show={showConfetti} />
                <style>{`
                    @keyframes soldIn {
                        0%   { opacity: 0; transform: scale(0.88) translateY(24px); }
                        100% { opacity: 1; transform: scale(1)    translateY(0); }
                    }
                    .sold-anim { animation: soldIn 0.65s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
                `}</style>
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(34,197,94,0.07) 0%, transparent 60%)', pointerEvents: 'none' }} />
                <div className="z-10 text-center sold-anim px-8">
                    <div style={{ color: '#6b7280', fontSize: '12px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '12px' }}>
                        Sold To
                    </div>
                    <div className="font-oswald font-black uppercase leading-none tracking-tight"
                         style={{ fontSize: 'clamp(52px, 10vw, 108px)', color: status.lastSoldResult.teamColor || ACCENT, textShadow: `0 0 60px ${status.lastSoldResult.teamColor || ACCENT}50` }}>
                        {status.lastSoldResult.teamName}
                    </div>
                    <div style={{ width: '72px', height: '4px', background: ACCENT, margin: '18px auto 20px', borderRadius: '999px' }} />
                    <div className="font-oswald font-black uppercase" style={{ fontSize: 'clamp(28px, 4vw, 44px)', color: '#e5e7eb', marginBottom: '24px' }}>
                        {status.lastSoldResult.playerName}
                    </div>
                    <div style={{
                        display: 'inline-block',
                        background: 'rgba(34,197,94,0.12)',
                        border: '2px solid rgba(34,197,94,0.3)',
                        color: '#4ade80',
                        padding: '14px 40px',
                        borderRadius: '999px',
                        fontSize: 'clamp(36px, 4vw, 52px)',
                        fontFamily: 'monospace',
                        fontWeight: 900,
                    }}>
                        ₹{status.lastSoldResult.soldPrice.toLocaleString()}
                    </div>
                </div>
            </div>
        );
    }

    // ── COMPLETED ─────────────────────────────────────────────────────────────
    if (status.status === 'completed') {
        return (
            <div style={{ background: '#0B0B0B' }} className="min-h-screen text-white p-10 flex flex-col items-center font-montserrat">
                <div className="text-center mb-12">
                    <div style={{ color: ACCENT, fontSize: '11px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.4em', marginBottom: '12px' }}>
                        Final Results
                    </div>
                    <h1 className="font-oswald font-black text-white uppercase tracking-tight" style={{ fontSize: 'clamp(42px, 6vw, 72px)' }}>
                        Auction Complete
                    </h1>
                    <p style={{ color: '#6b7280', fontSize: '16px', marginTop: '10px', fontWeight: 300 }}>
                        {tournamentName} — {categoryName}
                    </p>
                    <div style={{ width: '56px', height: '3px', background: ACCENT, margin: '16px auto 0', borderRadius: '999px' }} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-6xl">
                    {teams.map(team => (
                        <div key={team._id} style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
                            <div style={{ height: '4px', background: team.primaryColor || ACCENT }} />
                            <div style={{ padding: '20px 24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: team.primaryColor || ACCENT, boxShadow: `0 0 8px ${team.primaryColor || ACCENT}60` }} />
                                    <h3 className="font-oswald font-bold uppercase text-white" style={{ fontSize: '20px' }}>{team.name}</h3>
                                </div>
                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#6b7280', fontSize: '14px' }}>Total Spent</span>
                                        <span style={{ color: ACCENT, fontFamily: 'monospace', fontWeight: 700 }}>₹{team.totalSpent.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#6b7280', fontSize: '14px' }}>Budget Left</span>
                                        <span style={{ color: '#4ade80', fontFamily: 'monospace', fontWeight: 700 }}>₹{team.budget.toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: '#6b7280', fontSize: '14px' }}>Players</span>
                                        <span style={{ color: '#ffffff', fontWeight: 700 }}>{team.playersCount}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ── MAIN AUCTION BROADCAST ────────────────────────────────────────────────
    const currentBid  = status.liveBid?.currentPrice || (player?.auctionData?.basePrice ?? 0);
    const basePrice   = player?.auctionData?.basePrice ?? 0;
    const hardLimit   = status.settings?.hardLimit ?? 0;
    const bidProgress = hardLimit > basePrice
        ? Math.min(100, ((currentBid - basePrice) / (hardLimit - basePrice)) * 100)
        : 0;

    return (
        <div style={{ background: '#0B0B0B' }} className="h-screen text-white overflow-hidden flex flex-col font-montserrat">
            <ConfettiOverlay show={showConfetti} />

            {/* ── GLOBAL ANIMATION STYLES ────────────────────────────────── */}
            <style>{`
                @keyframes bidPulse {
                    0%   { transform: scale(1);    filter: drop-shadow(0 0  0px ${ACCENT}); }
                    35%  { transform: scale(1.07); filter: drop-shadow(0 0 28px ${ACCENT}); }
                    100% { transform: scale(1);    filter: drop-shadow(0 0  0px ${ACCENT}); }
                }
                .bid-flash { animation: bidPulse 0.65s cubic-bezier(0.34, 1.56, 0.64, 1); }

                @keyframes livePulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.25; }
                }
                .live-dot { animation: livePulse 1.4s ease-in-out infinite; }

                #teams-panel::-webkit-scrollbar { display: none; }
                #teams-panel { -ms-overflow-style: none; scrollbar-width: none; }

                #sold-log::-webkit-scrollbar { width: 3px; }
                #sold-log::-webkit-scrollbar-track { background: transparent; }
                #sold-log::-webkit-scrollbar-thumb { background: rgba(255,122,0,0.25); border-radius: 999px; }

                #bid-history::-webkit-scrollbar { display: none; }
                #bid-history { -ms-overflow-style: none; scrollbar-width: none; }
            `}</style>

            {/* ══════════════════════════════════════════════════════════════
                TOP BAR
            ══════════════════════════════════════════════════════════════ */}
            <div style={{
                background: '#121212',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                height: '64px',
                flexShrink: 0,
                zIndex: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 28px',
            }}>
                {/* Left: League title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '22px', userSelect: 'none' }}>🏸</span>
                    <div>
                        <div style={{ color: '#ffffff', fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: '17px', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
                            {tournamentName || 'Premier League'}
                        </div>
                        {categoryName && (
                            <div style={{ color: ACCENT, fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.2em', opacity: 0.85 }}>
                                {categoryName}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center: Auction progress */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#4b5563', fontSize: '9px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.25em', marginBottom: '2px' }}>
                        Auction Progress
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', justifyContent: 'center', fontFamily: 'Oswald, sans-serif', fontWeight: 900 }}>
                        <span style={{ color: ACCENT, fontSize: '26px', lineHeight: 1 }}>{status.currentPlayerIndex + 1}</span>
                        <span style={{ color: '#4b5563', fontSize: '18px' }}>/</span>
                        <span style={{ color: '#d1d5db', fontSize: '18px' }}>{status.totalPlayers}</span>
                        <span style={{ color: '#4b5563', fontSize: '11px', fontWeight: 400, marginLeft: '2px' }}>players</span>
                    </div>
                </div>

                {/* Right: LIVE indicator */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {status.status === 'paused' && (
                        <div style={{
                            background: 'rgba(234,179,8,0.12)',
                            border: '1px solid rgba(234,179,8,0.3)',
                            color: '#eab308',
                            padding: '4px 14px',
                            borderRadius: '999px',
                            fontSize: '11px',
                            fontFamily: 'Oswald, sans-serif',
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                        }}>
                            Paused
                        </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="live-dot" style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 10px #ef4444' }} />
                        <span style={{ color: '#ef4444', fontFamily: 'Oswald, sans-serif', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '14px' }}>
                            LIVE
                        </span>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                THREE-COLUMN BODY
            ══════════════════════════════════════════════════════════════ */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* ── LEFT PANEL: TEAMS ───────────────────────────────────── */}
                <div id="teams-panel" style={{
                    width: '21%',
                    background: '#121212',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    padding: '20px 14px',
                    flexShrink: 0,
                    overflowY: 'auto',
                }}>
                    <div style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: '14px', paddingLeft: '2px' }}>
                        Participating Teams
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {teams.map(team => (
                            <div key={team._id} style={{
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: '12px',
                                padding: '12px 13px',
                            }}>
                                {/* Team name row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '9px' }}>
                                    <div style={{
                                        width: '9px', height: '9px', borderRadius: '50%', flexShrink: 0,
                                        background: team.primaryColor || ACCENT,
                                        boxShadow: `0 0 8px ${team.primaryColor || ACCENT}55`,
                                    }} />
                                    <span style={{
                                        color: '#f3f4f6', fontFamily: 'Oswald, sans-serif', fontWeight: 700,
                                        fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {team.name}
                                    </span>
                                </div>
                                {/* Stats */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Purse Left</span>
                                        <span style={{ color: '#4ade80', fontFamily: 'monospace', fontWeight: 700, fontSize: '12px' }}>
                                            ₹{team.budget >= 100000 ? (team.budget / 100000).toFixed(1) + 'L' : team.budget.toLocaleString()}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Players</span>
                                        <span style={{ color: '#e5e7eb', fontWeight: 700, fontSize: '12px' }}>{team.playersCount}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── CENTER PANEL: CURRENT PLAYER (DOMINANT) ─────────────── */}
                <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px 28px',
                    position: 'relative',
                    overflow: 'hidden',
                }}>
                    {/* Ambient glow */}
                    <div style={{
                        position: 'absolute', top: '50%', left: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '560px', height: '560px',
                        background: `radial-gradient(circle, ${ACCENT}07 0%, transparent 65%)`,
                        pointerEvents: 'none',
                    }} />

                    {/* Tie-breaker spin wheel */}
                    {status.liveBid?.tieBreakerActive && (status.liveBid?.tiedTeams?.length ?? 0) >= 2 ? (
                        <div className="animate-in fade-in zoom-in-95 duration-500">
                            <SpinTheWheel
                                tiedTeams={status.liveBid.tiedTeams.map(id => {
                                    const t = teams.find(tm => tm._id === id);
                                    return { id, name: t?.name || 'Unknown', color: t?.primaryColor || '#64748b' };
                                })}
                                hardLimit={status.settings?.hardLimit || 0}
                                interactive={false}
                                externalWinnerId={status.liveBid?.spinWinnerId}
                                externalSpinStartedAt={status.liveBid?.spinStartedAt}
                            />
                        </div>
                    ) : player ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '460px', zIndex: 10, gap: '18px' }}>

                            {/* ── AVATAR ── */}
                            <div style={{ position: 'relative', marginBottom: '4px' }}>
                                <div style={{
                                    width: '148px', height: '148px',
                                    borderRadius: '50%',
                                    border: `3px solid ${ACCENT}38`,
                                    boxShadow: `0 0 0 8px ${ACCENT}08, 0 0 50px ${ACCENT}16, 0 16px 40px rgba(0,0,0,0.55)`,
                                    background: 'linear-gradient(145deg, #1e1e1e 0%, #0f0f0f 100%)',
                                    overflow: 'hidden',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0,
                                }}>
                                    {player.profile.photo ? (
                                        <img
                                            src={player.profile.photo}
                                            alt={`${player.profile.firstName} ${player.profile.lastName}`}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: '56px', lineHeight: 1, userSelect: 'none' }}>👤</span>
                                    )}
                                </div>

                                {/* Skill level badge */}
                                {player.profile.skillLevel && (() => {
                                    const badge = getSkillBadge(player.profile.skillLevel);
                                    return (
                                        <div style={{
                                            position: 'absolute', bottom: '-11px', left: '50%', transform: 'translateX(-50%)',
                                            background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`,
                                            padding: '3px 16px', borderRadius: '999px',
                                            fontSize: '10px', fontWeight: 700, fontFamily: 'Oswald, sans-serif',
                                            textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap',
                                        }}>
                                            {player.profile.skillLevel}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* ── PLAYER NAME ── */}
                            <div style={{ textAlign: 'center', marginTop: '6px' }}>
                                <h2 style={{
                                    fontFamily: 'Oswald, sans-serif', fontWeight: 900,
                                    textTransform: 'uppercase', color: '#ffffff',
                                    fontSize: 'clamp(34px, 3.6vw, 48px)',
                                    lineHeight: 1, letterSpacing: '-0.01em',
                                }}>
                                    {player.profile.firstName} {player.profile.lastName}
                                </h2>
                                <div style={{ width: '44px', height: '3px', background: ACCENT, margin: '10px auto 0', borderRadius: '999px' }} />
                            </div>

                            {/* ── ATTRIBUTE CARDS ── */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px 14px' }}>
                                    <div style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Age</div>
                                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '18px' }}>
                                        {player.profile.age}
                                        <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '13px', marginLeft: '3px' }}>yrs</span>
                                    </div>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '10px 14px' }}>
                                    <div style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Gender</div>
                                    <div style={{ color: '#ffffff', fontWeight: 700, fontSize: '18px', textTransform: 'capitalize' }}>{player.profile.gender}</div>
                                </div>
                            </div>

                            {/* ── PRICE BOX ── */}
                            <div style={{
                                width: '100%',
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.07)',
                                borderRadius: '16px',
                                overflow: 'hidden',
                            }}>
                                {/* Base price */}
                                <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                                        Base Price
                                    </div>
                                    <div style={{ color: '#9ca3af', fontFamily: 'monospace', fontWeight: 700, fontSize: '18px' }}>
                                        ₹{basePrice.toLocaleString()}
                                    </div>
                                </div>

                                {/* Current bid — LARGEST element */}
                                <div style={{ padding: '18px 22px', textAlign: 'center', background: `${ACCENT}06` }}>
                                    <div style={{ color: '#6b7280', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: '8px' }}>
                                        Current Bid
                                    </div>
                                    <div
                                        className={bidFlash ? 'bid-flash' : ''}
                                        style={{
                                            fontFamily: 'Oswald, sans-serif',
                                            fontWeight: 900,
                                            fontSize: 'clamp(52px, 5.8vw, 68px)',
                                            color: ACCENT,
                                            lineHeight: 1,
                                            letterSpacing: '-0.02em',
                                            display: 'inline-block',
                                        }}
                                    >
                                        ₹{currentBid.toLocaleString()}
                                    </div>
                                    {status.liveBid?.highestBidderName && (
                                        <div style={{ color: '#4b5563', fontSize: '11px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '6px' }}>
                                            by <span style={{ color: ACCENT, fontWeight: 700 }}>{status.liveBid.highestBidderName}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: '#4b5563', fontSize: '22px', fontStyle: 'italic', fontWeight: 300 }}>
                            Preparing next player...
                        </div>
                    )}
                </div>

                {/* ── RIGHT PANEL: AUCTION STATUS ─────────────────────────── */}
                <div style={{
                    width: '30%',
                    background: '#121212',
                    borderLeft: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    flexShrink: 0,
                    overflow: 'hidden',
                }}>

                    {/* Bid Progress Bar */}
                    {player && hardLimit > basePrice && (
                        <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <div style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: '10px' }}>
                                Current Bid Progress
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ color: '#6b7280', fontSize: '12px', fontFamily: 'monospace' }}>₹{basePrice.toLocaleString()}</span>
                                <span style={{ color: ACCENT, fontSize: '13px', fontFamily: 'monospace', fontWeight: 700 }}>₹{currentBid.toLocaleString()}</span>
                                <span style={{ color: '#6b7280', fontSize: '12px', fontFamily: 'monospace' }}>₹{hardLimit.toLocaleString()}</span>
                            </div>
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: `${bidProgress}%`,
                                    background: `linear-gradient(90deg, ${ACCENT}, #ffaa4a)`,
                                    borderRadius: '999px',
                                    transition: 'width 0.5s ease',
                                    boxShadow: `0 0 8px ${ACCENT}55`,
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Bid History */}
                    {status.liveBid?.bidHistory && status.liveBid.bidHistory.length > 0 && (
                        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <div style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: '8px' }}>
                                Bid History
                            </div>
                            <div id="bid-history" style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '116px', overflowY: 'auto' }}>
                                {[...status.liveBid.bidHistory].reverse().slice(0, 6).map((bid, i) => {
                                    const team = teams.find(t => t._id === bid.teamId);
                                    return (
                                        <div key={i} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '6px 10px', borderRadius: '8px',
                                            background: i === 0 ? `${ACCENT}12` : 'rgba(255,255,255,0.025)',
                                            border: `1px solid ${i === 0 ? `${ACCENT}28` : 'transparent'}`,
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: team?.primaryColor || '#64748b', flexShrink: 0 }} />
                                                <span style={{ color: i === 0 ? ACCENT : '#9ca3af', fontSize: '12px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {bid.teamName}
                                                </span>
                                            </div>
                                            <span style={{ color: i === 0 ? '#ffffff' : '#6b7280', fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', flexShrink: 0 }}>
                                                ₹{bid.amount.toLocaleString()}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Tie-breaker warning */}
                    {(status.liveBid?.tiedTeams?.length ?? 0) >= 2 && !status.liveBid?.tieBreakerActive && (
                        <div style={{ padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(251,191,36,0.07)', flexShrink: 0 }}>
                            <div className="animate-pulse" style={{ color: '#fbbf24', fontSize: '12px', fontFamily: 'Oswald, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                ⚡ {status.liveBid!.tiedTeams.length} Teams Tied — Tie-Breaker Pending
                            </div>
                        </div>
                    )}

                    {/* Sold Players header */}
                    <div style={{ padding: '14px 20px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                        <div style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.22em' }}>
                            Sold Players <span style={{ color: '#374151' }}>({soldLog.length})</span>
                        </div>
                    </div>

                    {/* Sold Players list */}
                    <div id="sold-log" style={{ flex: 1, overflowY: 'auto', padding: '10px 14px' }}>
                        {soldLog.length === 0 ? (
                            <div style={{ color: '#374151', fontSize: '11px', textAlign: 'center', paddingTop: '28px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                                No players sold yet
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                {[...soldLog].reverse().map((log, i) => (
                                    <div key={log._id || i} style={{
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        borderRadius: '10px',
                                        padding: '9px 12px',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                        gap: '8px',
                                    }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {log.playerName}
                                            </div>
                                            <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
                                                Sold to <span style={{ color: '#9ca3af' }}>{log.teamName}</span>
                                            </div>
                                        </div>
                                        <div style={{ color: ACCENT, fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', flexShrink: 0 }}>
                                            ₹{log.finalPrice?.toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Auction status */}
                    {player && (
                        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                            <div style={{ color: '#4b5563', fontSize: '10px', fontFamily: 'Oswald, sans-serif', textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: '6px' }}>
                                Auction Status
                            </div>
                            <div
                                className={status.status !== 'paused' ? 'animate-pulse' : ''}
                                style={{
                                    fontFamily: 'Oswald, sans-serif',
                                    fontWeight: 800,
                                    letterSpacing: '0.06em',
                                    fontSize: '22px',
                                    color: status.status === 'paused' ? '#f59e0b' : '#22c55e',
                                }}
                            >
                                {status.status === 'paused' ? 'PAUSED' : 'OPEN FOR BIDS'}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuctionDisplay;
