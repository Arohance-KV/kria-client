import React, { useEffect, useState, useCallback, useRef } from 'react';
import { auctionApi } from '../../../api/auction';
import API from '../../../api/axios';
import { AuctionStatus, Player, Team } from '../../../types';
import {
    Gavel, Play, SkipForward, Undo2, Pause, PlayCircle, CheckCircle,
    Loader2, Users, DollarSign, ChevronDown, X, AlertCircle, Trophy,
    TrendingUp, Zap, RotateCcw, StopCircle, Target
} from 'lucide-react';
import SpinTheWheel from '../../../components/SpinTheWheel';
import { socket } from '../../../lib/socket';

// ============================================================================
// CONFETTI
// ============================================================================
const CONFETTI_COLORS = ['#F97316', '#FBBF24', '#34D399', '#60A5FA', '#A78BFA', '#F472B6', '#fff'];

const ConfettiOverlay: React.FC<{ show: boolean }> = ({ show }) => {
    if (!show) return null;
    return (
        <div className="confetti-container">
            {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="confetti-piece" style={{
                    left: `${Math.random() * 100}%`,
                    backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                    width: `${8 + Math.random() * 8}px`,
                    height: `${14 + Math.random() * 12}px`,
                    transform: `rotate(${Math.random() * 360}deg)`,
                }} />
            ))}
        </div>
    );
};

// ============================================================================
// TYPES
// ============================================================================
interface AuctionSectionProps {
    tournamentId: string;
    categories: { _id: string; name: string; status?: string }[];
}

interface AuctionFullState {
    auction: AuctionStatus;
    currentPlayer: Player | null;
    teams: Team[];
    category?: { _id: string; name: string } | null;
    tournament?: { _id: string; name: string } | null;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================
const AuctionSection: React.FC<AuctionSectionProps> = ({ tournamentId, categories }) => {
    const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
    const [auctionState, setAuctionState] = useState<AuctionFullState | null>(null);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [showSpinWheel, setShowSpinWheel] = useState(false);
    const [soldLog, setSoldLog] = useState<any[]>([]);
    const prevStatusRef = useRef<string | null>(null);

    // Start auction settings
    const [showStartSettings, setShowStartSettings] = useState(false);
    const [startSettings, setStartSettings] = useState({ bidIncrement: '1000', hardLimit: '0' });

    // Manual sell fallback modal
    const [showSellModal, setShowSellModal] = useState(false);
    const [sellForm, setSellForm] = useState({ teamId: '', soldPrice: '' });



    // ========================================================================
    // STATUS FETCH (used for initial load and as fallback after actions)
    // ========================================================================
    const fetchStatus = useCallback(async () => {
        if (!selectedCategoryId) return;
        try {
            const data = await auctionApi.getStatus(tournamentId, selectedCategoryId);
            setAuctionState(data);
            setError(null);

            if (data.auction.status === 'sold' && prevStatusRef.current !== 'sold') {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 3500);
            }
            prevStatusRef.current = data.auction.status;
        } catch (err: any) {
            if (err?.response?.status === 404) {
                setAuctionState(null);
                prevStatusRef.current = null;
            } else {
                setError(err?.response?.data?.message || 'Failed to fetch auction status');
            }
        }
    }, [tournamentId, selectedCategoryId]);

    // Initial load + socket subscription
    useEffect(() => {
        if (!selectedCategoryId) { setAuctionState(null); return; }

        setLoading(true);
        fetchStatus().finally(() => setLoading(false));

        socket.connect();
        socket.emit('join:auction', { tournamentId, categoryId: selectedCategoryId });

        const handleUpdate = (data: any) => {
            setAuctionState(data);
            setError(null);
            if (data.auction?.status === 'sold' && prevStatusRef.current !== 'sold') {
                setShowConfetti(true);
                setTimeout(() => setShowConfetti(false), 3500);
            }
            prevStatusRef.current = data.auction?.status ?? null;
        };

        socket.on('auction:update', handleUpdate);

        return () => {
            socket.off('auction:update', handleUpdate);
            socket.emit('leave:auction', { tournamentId, categoryId: selectedCategoryId });
            socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCategoryId]);

    useEffect(() => {
        if (!selectedCategoryId) return;
        auctionApi.getSoldLog(tournamentId, selectedCategoryId)
            .then((data: any) => setSoldLog(data.logs || []))
            .catch(() => setSoldLog([]));
    }, [selectedCategoryId, tournamentId, auctionState?.auction?.logsCount]);

    // ========================================================================
    // ACTIONS
    // ========================================================================
    const handleStartAuction = async () => {
        setActionLoading('start'); setError(null);
        try {
            try { await API.post(`/categories/${selectedCategoryId}/start-auction`); }
            catch (e: any) { const msg = e?.response?.data?.data?.message || ''; if (!msg.toLowerCase().includes('already')) throw e; }

            await auctionApi.start(tournamentId, selectedCategoryId, {
                bidIncrement: Number(startSettings.bidIncrement) || 1000,
                hardLimit: Number(startSettings.hardLimit) || 0,
            });
            setShowStartSettings(false);
            await fetchStatus();
        } catch (err: any) {
            setError(err?.response?.data?.data?.message || err?.response?.data?.message || 'Failed to start auction');
        }
        setActionLoading(null);
    };

    const handleBid = async (teamId: string) => {
        setActionLoading(`bid-${teamId}`); setError(null);
        try {
            await auctionApi.bid(tournamentId, selectedCategoryId, teamId);
            await fetchStatus();
        } catch (err: any) {
            setError(err?.response?.data?.data?.message || err?.response?.data?.message || 'Bid failed');
        }
        setActionLoading(null);
    };

    const handleSellAtCurrentBid = async () => {
        const auction = auctionState?.auction;
        if (!auction?.liveBid?.highestBidderId) return;
        setActionLoading('sell-bid'); setError(null);
        try {
            await auctionApi.sell(tournamentId, selectedCategoryId, auction.liveBid.highestBidderId, auction.liveBid.currentPrice);
            await fetchStatus();
        } catch (err: any) {
            setError(err?.response?.data?.data?.message || 'Failed to sell');
        }
        setActionLoading(null);
    };

    const handleStartTieBreaker = async () => {
        setActionLoading('start-tie-breaker'); setError(null);
        try {
            await auctionApi.startTieBreaker(tournamentId, selectedCategoryId);
            setShowSpinWheel(true);
            await fetchStatus();
        } catch (err: any) {
            setError(err?.response?.data?.data?.message || 'Failed to start tie-breaker');
        }
        setActionLoading(null);
    };

    const handleTriggerSpinWheel = async () => {
        try {
            const res = await auctionApi.triggerSpinWheel(tournamentId, selectedCategoryId);
            return res.data?.data?.winnerId || null;
        } catch (err: any) {
            setError(err?.response?.data?.data?.message || 'Failed to trigger spin wheel');
            return null;
        }
    };

    const handleResolveHardLimit = async (winnerId: string) => {
        if (!winnerId) return;
        setActionLoading('resolve'); setError(null);
        try {
            await auctionApi.resolveHardLimit(tournamentId, selectedCategoryId, winnerId);
            setShowSpinWheel(false);
            await fetchStatus();
        } catch (err: any) {
            setError(err?.response?.data?.data?.message || 'Failed to resolve');
        }
        setActionLoading(null);
    };

    const handleSellPlayer = async () => {
        if (!sellForm.teamId || !sellForm.soldPrice) return;
        setActionLoading('sell'); setError(null);
        try {
            await auctionApi.sell(tournamentId, selectedCategoryId, sellForm.teamId, Number(sellForm.soldPrice));
            setShowSellModal(false); setSellForm({ teamId: '', soldPrice: '' });
            setShowSpinWheel(false);
            await fetchStatus();
        } catch (err: any) {
            setError(err?.response?.data?.data?.message || 'Failed to sell player');
        }
        setActionLoading(null);
    };

    const handleNext = async () => {
        setActionLoading('next'); setError(null);
        try { await auctionApi.next(tournamentId, selectedCategoryId); setShowSpinWheel(false); await fetchStatus(); }
        catch (err: any) { setError(err?.response?.data?.data?.message || 'Failed to move to next'); }
        setActionLoading(null);
    };

    const handleSkip = async () => {
        setActionLoading('skip'); setError(null);
        try { await auctionApi.skip(tournamentId, selectedCategoryId); setShowSpinWheel(false); await fetchStatus(); }
        catch (err: any) { setError(err?.response?.data?.data?.message || 'Failed to skip'); }
        setActionLoading(null);
    };

    const handleUndo = async () => {
        setActionLoading('undo'); setError(null);
        try { await auctionApi.undo(tournamentId, selectedCategoryId); await fetchStatus(); }
        catch (err: any) { setError(err?.response?.data?.data?.message || 'Failed to undo'); }
        setActionLoading(null);
    };

    const handlePause = async () => {
        setActionLoading('pause'); setError(null);
        try { await auctionApi.pause(tournamentId, selectedCategoryId); await fetchStatus(); }
        catch (err: any) { setError(err?.response?.data?.data?.message || 'Failed to pause/resume'); }
        setActionLoading(null);
    };

    const handleEndAuction = async () => {
        if (!window.confirm('End auction? Unsold players will remain unassigned.')) return;
        setActionLoading('end'); setError(null);
        try { await auctionApi.end(tournamentId, selectedCategoryId); await fetchStatus(); }
        catch (err: any) { setError(err?.response?.data?.data?.message || 'Failed to end auction'); }
        setActionLoading(null);
    };

    // ========================================================================
    // RENDER
    // ========================================================================
    const auction = auctionState?.auction;
    const currentPlayer = auctionState?.currentPlayer;
    const teams = auctionState?.teams || [];
    const isActive = auction && ['in_progress', 'paused', 'sold'].includes(auction.status);
    const liveBid = auction?.liveBid;
    const hardLimit = auction?.settings?.hardLimit || 0;
    const increment = auction?.settings?.minBidIncrement || 1000;
    const nextBidPrice = (liveBid?.currentPrice || 0) + increment;
    const isAtHardLimit = hardLimit > 0 && (liveBid?.currentPrice || 0) >= hardLimit;
    const hasTiedTeams = (liveBid?.tiedTeams?.length || 0) >= 2;

    return (
        <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
            <ConfettiOverlay show={showConfetti} />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary"><Gavel className="h-5 w-5" /></div>
                    <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Auction Control</h2>
                </div>
                <div className="relative">
                    <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)}
                        className="appearance-none bg-black/50 border border-white/10 text-white rounded-xl px-5 py-2.5 pr-10 text-sm font-medium focus:outline-none focus:border-primary transition-colors cursor-pointer">
                        <option value="">Select Category</option>
                        {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-4 bg-red-900/20 border border-red-900/50 rounded-xl text-red-300 text-sm">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" /> {error}
                </div>
            )}

            {/* No category */}
            {!selectedCategoryId && (
                <div className="p-10 text-center text-gray-500">
                    <Gavel className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">Select a category to manage its auction</p>
                </div>
            )}

            {/* Loading */}
            {selectedCategoryId && loading && (
                <div className="flex justify-center p-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            )}

            {/* Not Started — with settings */}
            {selectedCategoryId && !loading && !auctionState && (
                <div className="p-10 text-center flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"><Play className="h-10 w-10 text-primary" /></div>
                    <div>
                        <p className="text-xl font-bold text-white mb-2">Auction Not Started</p>
                        <p className="text-gray-400 text-sm max-w-md">Configure bidding settings and start the auction.</p>
                    </div>

                    {!showStartSettings ? (
                        <button onClick={() => setShowStartSettings(true)} className="flex items-center gap-2 px-8 py-3 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-sm transition-all shadow-lg shadow-primary/20">
                            <Gavel className="h-5 w-5" /> Configure & Start
                        </button>
                    ) : (
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
                            <h3 className="text-lg font-oswald font-bold text-white">Auction Settings</h3>
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Bid Increment (₹)</label>
                                <input type="number" min="1" value={startSettings.bidIncrement}
                                    onChange={e => setStartSettings({ ...startSettings, bidIncrement: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-lg focus:outline-none focus:border-primary" placeholder="1000" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Hard Limit (₹) <span className="text-gray-600">0 = no limit</span></label>
                                <input type="number" min="0" value={startSettings.hardLimit}
                                    onChange={e => setStartSettings({ ...startSettings, hardLimit: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white font-mono text-lg focus:outline-none focus:border-primary" placeholder="20000" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowStartSettings(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 font-medium">Cancel</button>
                                <button onClick={handleStartAuction} disabled={actionLoading === 'start'}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold disabled:opacity-50">
                                    {actionLoading === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
                                    Start
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ACTIVE AUCTION */}
            {selectedCategoryId && !loading && auctionState && isActive && (
                <div className="flex flex-col gap-6">
                    {/* Status Row */}
                    <div className="flex items-center flex-wrap gap-3">
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${auction!.status === 'paused' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30'
                            : auction!.status === 'sold' ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'}`}>
                            <div className={`w-2 h-2 rounded-full ${auction!.status === 'paused' ? 'bg-yellow-400' : auction!.status === 'sold' ? 'bg-green-400' : 'bg-blue-400 animate-pulse'}`} />
                            {auction!.status === 'sold' ? 'Player Sold!' : auction!.status === 'paused' ? 'Paused' : 'Live'}
                        </div>
                        <span className="text-gray-400 text-sm">Player <span className="text-white font-bold">{auction!.currentPlayerIndex + 1}</span> / {auction!.totalPlayers}</span>
                        {(auction!.rotationCount || 0) > 0 && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-bold border border-amber-500/20">
                                <RotateCcw className="h-3 w-3" /> Rotation {auction!.rotationCount}
                            </span>
                        )}
                        {(auction!.unsoldCount || 0) > 0 && (
                            <span className="text-xs text-gray-500">{auction!.unsoldCount} unsold queued</span>
                        )}
                        {hardLimit > 0 && (
                            <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20">
                                <Target className="h-3 w-3" /> Hard Limit: ₹{hardLimit.toLocaleString()}
                            </span>
                        )}
                    </div>

                    {/* SOLD CELEBRATION */}
                    {auction!.status === 'sold' && auction!.lastSoldResult && (
                        <div className="bg-gradient-to-br from-green-900/30 to-emerald-900/10 border border-green-500/30 rounded-2xl p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                            <h3 className="text-5xl font-oswald font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mb-4">SOLD!</h3>
                            <p className="text-3xl font-bold text-white mb-2">{auction!.lastSoldResult.playerName}</p>
                            <p className="text-gray-400 text-lg mb-3">sold to</p>
                            <p className="text-4xl font-oswald font-black text-primary mb-4">{auction!.lastSoldResult.teamName}</p>
                            <div className="inline-block bg-green-600 px-6 py-2 rounded-full text-2xl font-mono font-bold text-white">₹{auction!.lastSoldResult.soldPrice.toLocaleString()}</div>
                            <div className="mt-6">
                                <button onClick={handleNext} disabled={!!actionLoading}
                                    className="flex items-center gap-2 mx-auto px-6 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-white font-bold text-sm disabled:opacity-50">
                                    {actionLoading === 'next' ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
                                    Next Player
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MAIN AUCTION VIEW (not sold) */}
                    {auction!.status !== 'sold' && (
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* LEFT: Player + Bidding */}
                            <div className="flex-1 flex flex-col gap-6">
                                {/* Current Player Card */}
                                {currentPlayer && (
                                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col sm:flex-row gap-6">
                                        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-gradient-to-b from-slate-700 to-slate-800 border-2 border-primary/50 flex items-center justify-center overflow-hidden shrink-0 shadow-lg shadow-primary/10">
                                            {currentPlayer.profile.photo ? (
                                                <img src={currentPlayer.profile.photo} alt="" className="w-full h-full object-cover" />
                                            ) : <span className="text-6xl select-none">👤</span>}
                                        </div>
                                        <div className="flex-1 flex flex-col justify-center gap-4">
                                            <div>
                                                <h3 className="text-3xl font-oswald font-black text-white uppercase tracking-tight">
                                                    {currentPlayer.profile.firstName} {currentPlayer.profile.lastName}
                                                </h3>
                                                <div className="h-1 w-16 bg-primary rounded-full mt-2" />
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-black/30 rounded-xl p-3">
                                                    <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Age</div>
                                                    <div className="text-lg font-bold text-white">{currentPlayer.profile.age}</div>
                                                </div>
                                                <div className="bg-black/30 rounded-xl p-3">
                                                    <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Gender</div>
                                                    <div className="text-lg font-bold text-white capitalize">{currentPlayer.profile.gender}</div>
                                                </div>
                                                <div className="bg-black/30 rounded-xl p-3">
                                                    <div className="text-gray-500 text-xs uppercase tracking-widest mb-1">Base Price</div>
                                                    <div className="text-lg font-bold text-primary font-mono">₹{currentPlayer.auctionData.basePrice.toLocaleString()}</div>
                                                </div>
                                            </div>
                                            {currentPlayer.profile.skillLevel && (
                                                <span className="inline-block w-fit text-xs bg-blue-500/10 text-blue-400 px-3 py-1 rounded-full border border-blue-500/20 uppercase tracking-widest font-bold">{currentPlayer.profile.skillLevel}</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Live Bid Display */}
                                {currentPlayer && liveBid && (
                                    <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/50 border border-white/10 rounded-2xl p-6">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2">
                                                <TrendingUp className="h-5 w-5 text-primary" />
                                                <h4 className="text-sm font-oswald font-bold text-gray-400 uppercase tracking-widest">Current Bid</h4>
                                            </div>
                                            <span className="text-xs text-gray-500">Increment: ₹{increment.toLocaleString()}</span>
                                        </div>

                                        <div className="text-center mb-6">
                                            <div className="text-6xl font-mono font-black text-white mb-2 tracking-tight">
                                                ₹{(liveBid.currentPrice || 0).toLocaleString()}
                                            </div>
                                            {liveBid.highestBidderName && (
                                                <p className="text-gray-400 text-sm">Highest: <span className="text-primary font-bold">{liveBid.highestBidderName}</span></p>
                                            )}
                                        </div>

                                        {/* Hard limit progress bar */}
                                        {hardLimit > 0 && (
                                            <div className="mb-4">
                                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                    <span>₹{currentPlayer?.auctionData?.basePrice.toLocaleString()}</span>
                                                    <span className="text-red-400 font-bold">₹{hardLimit.toLocaleString()} (limit)</span>
                                                </div>
                                                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                    <div className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.min(100, ((liveBid.currentPrice || 0) / hardLimit) * 100)}%`,
                                                            background: isAtHardLimit
                                                                ? 'linear-gradient(90deg, #ef4444, #f59e0b)'
                                                                : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                                                        }} />
                                                </div>
                                            </div>
                                        )}

                                        {/* BID HISTORY FEED */}
                                        {liveBid.bidHistory && liveBid.bidHistory.length > 0 && (
                                            <div className="mb-4 bg-black/30 border border-white/5 rounded-xl p-3">
                                                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                                    <TrendingUp className="h-3 w-3" /> Bid History
                                                </h4>
                                                <div className="space-y-1 max-h-[140px] overflow-y-auto">
                                                    {[...liveBid.bidHistory].reverse().map((bid, i) => {
                                                        const team = teams.find(t => t._id === bid.teamId);
                                                        return (
                                                            <div key={i} className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg text-xs ${i === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-white/[0.02]'}`}>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: team?.primaryColor || '#64748b' }} />
                                                                    <span className={`font-semibold ${i === 0 ? 'text-primary' : 'text-gray-300'}`}>{bid.teamName}</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <span className={`font-mono font-bold ${i === 0 ? 'text-white' : 'text-gray-400'}`}>₹{bid.amount.toLocaleString()}</span>
                                                                    <span className="text-gray-600 text-[9px] font-mono w-14 text-right">{new Date(bid.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* TEAM BIDDING CARDS — works for normal bids AND hard limit matching */}
                                        {!showSpinWheel && (
                                            <>
                                                {isAtHardLimit && (
                                                    <div className="flex items-center justify-between mb-3 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                                        <div className="flex items-center gap-3">
                                                            <Zap className="h-5 w-5 text-amber-400 shrink-0" />
                                                            <div>
                                                                <p className="text-sm text-amber-300 font-bold">Hard limit reached! (₹{hardLimit.toLocaleString()})</p>
                                                                <p className="text-xs text-amber-300/80">Click teams willing to match this price.</p>
                                                            </div>
                                                        </div>
                                                        {hasTiedTeams && (
                                                            <button
                                                                onClick={handleStartTieBreaker}
                                                                disabled={!!actionLoading}
                                                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-bold rounded-lg shadow uppercase tracking-wider whitespace-nowrap disabled:opacity-50"
                                                            >
                                                                {actionLoading === 'start-tie-breaker' ? <Loader2 className="h-4 w-4 animate-spin inline mr-1" /> : null}
                                                                Start Tie-Breaker ({liveBid.tiedTeams.length} Teams) →
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                                                    {isAtHardLimit ? `Click teams to match at ₹${hardLimit.toLocaleString()}` : `Click a team to bid ₹${nextBidPrice.toLocaleString()}`}
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {teams.map(team => {
                                                        const isTied = liveBid.tiedTeams?.includes(team._id);
                                                        const canAfford = isAtHardLimit ? team.budget >= hardLimit : team.budget >= nextBidPrice;
                                                        const isHighest = liveBid.highestBidderId === team._id;
                                                        const isBidding = actionLoading === `bid-${team._id}`;

                                                        return (
                                                            <button key={team._id}
                                                                onClick={() => handleBid(team._id)}
                                                                disabled={!canAfford || (isAtHardLimit && isTied) || (isAtHardLimit && !canAfford) || !!actionLoading || auction!.status === 'paused'}
                                                                className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed ${isTied
                                                                    ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20'
                                                                    : isHighest
                                                                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-105'
                                                                        : 'border-white/10 bg-white/5 hover:border-primary/50 hover:bg-primary/5 hover:scale-[1.02]'}`}
                                                            >
                                                                {isBidding && <Loader2 className="h-5 w-5 animate-spin text-primary absolute top-2 right-2" />}
                                                                <div className="w-10 h-10 rounded-full border-2 shadow" style={{ backgroundColor: team.primaryColor || '#64748b', borderColor: team.secondaryColor || '#fff' }} />
                                                                <span className={`font-bold text-sm truncate max-w-full ${isTied ? 'text-amber-400' : isHighest ? 'text-primary' : 'text-white'}`}>{team.name}</span>
                                                                <span className="text-green-400 font-mono text-xs font-bold">₹{team.budget.toLocaleString()}</span>
                                                                {isTied && (
                                                                    <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">Matched</span>
                                                                )}
                                                                {!isTied && isHighest && (
                                                                    <span className="absolute -top-2 -right-2 bg-primary text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase">Highest</span>
                                                                )}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </>
                                        )}

                                        {/* SPIN THE WHEEL */}
                                        {showSpinWheel && hasTiedTeams && (
                                            <div className="animate-in fade-in zoom-in-95 duration-300">
                                                <div className="flex justify-between items-center mb-4">
                                                    <button onClick={() => setShowSpinWheel(false)} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                                                        ← Back to Matching
                                                    </button>
                                                </div>
                                                <SpinTheWheel
                                                    tiedTeams={liveBid!.tiedTeams.map(id => {
                                                        const t = teams.find(tm => tm._id === id);
                                                        return { id, name: t?.name || 'Unknown', color: t?.primaryColor || '#64748b' };
                                                    })}
                                                    hardLimit={hardLimit}
                                                    interactive={true}
                                                    onConfirm={handleResolveHardLimit}
                                                    onSpin={handleTriggerSpinWheel}
                                                    actionLoading={actionLoading}
                                                />
                                            </div>
                                        )}

                                        {/* Sell at current bid */}
                                        {!hasTiedTeams && !isAtHardLimit && liveBid.highestBidderId && (
                                            <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-white/10">
                                                <button onClick={handleSellAtCurrentBid} disabled={!!actionLoading || auction!.status === 'paused'}
                                                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-green-600 hover:bg-green-700 text-white font-bold text-sm disabled:opacity-50 shadow-lg shadow-green-600/20">
                                                    {actionLoading === 'sell-bid' ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                                                    Sell at ₹{liveBid.currentPrice.toLocaleString()} to {liveBid.highestBidderName}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* WAITING */}
                                {!currentPlayer && (
                                    <div className="p-10 text-center text-gray-500">
                                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                                        <p>Loading player...</p>
                                    </div>
                                )}

                                {/* ACTION BUTTONS */}
                                {currentPlayer && (
                                    <div className="flex flex-wrap gap-3">
                                        <button onClick={() => { setShowSellModal(true); setSellForm({ teamId: '', soldPrice: String(liveBid?.currentPrice || currentPlayer.auctionData.basePrice) }); }}
                                            disabled={!!actionLoading || auction!.status === 'paused'}
                                            className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-sm disabled:opacity-50">
                                            <DollarSign className="h-4 w-4" /> Manual Sell
                                        </button>
                                        <button onClick={handleSkip} disabled={!!actionLoading || auction!.status === 'paused'}
                                            className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-sm disabled:opacity-50">
                                            {actionLoading === 'skip' ? <Loader2 className="h-4 w-4 animate-spin" /> : <SkipForward className="h-4 w-4" />}
                                            Skip (Unsold)
                                        </button>
                                        <button onClick={handleUndo} disabled={!!actionLoading || auction!.logsCount === 0}
                                            className="flex items-center gap-2 px-5 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-sm disabled:opacity-50">
                                            {actionLoading === 'undo' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                                            Undo
                                        </button>
                                        <button onClick={handlePause} disabled={!!actionLoading}
                                            className={`flex items-center gap-2 px-5 py-2 rounded-full font-medium text-sm disabled:opacity-50 ${auction!.status === 'paused' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-yellow-600/80 hover:bg-yellow-700 text-white'}`}>
                                            {actionLoading === 'pause' ? <Loader2 className="h-4 w-4 animate-spin" /> : auction!.status === 'paused' ? <PlayCircle className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                                            {auction!.status === 'paused' ? 'Resume' : 'Pause'}
                                        </button>
                                        <button onClick={handleEndAuction} disabled={!!actionLoading}
                                            className="flex items-center gap-2 px-5 py-2 rounded-full bg-red-600/80 hover:bg-red-700 text-white font-medium text-sm disabled:opacity-50">
                                            {actionLoading === 'end' ? <Loader2 className="h-4 w-4 animate-spin" /> : <StopCircle className="h-4 w-4" />}
                                            End Auction
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* RIGHT: Teams + Sold Log */}
                            <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-4">
                                <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
                                    <h4 className="text-sm font-oswald font-bold text-gray-400 uppercase tracking-widest mb-3">Team Budgets</h4>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                                        {teams.map(team => (
                                            <div key={team._id} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-xl">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.primaryColor || '#64748b' }} />
                                                    <span className="text-sm text-white font-medium truncate max-w-[120px]">{team.name}</span>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-sm font-mono font-bold text-green-400">₹{team.budget.toLocaleString()}</div>
                                                    <div className="text-[10px] text-gray-500">{team.playersCount} players</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-black/30 border border-white/5 rounded-2xl p-4 flex-1">
                                    <h4 className="text-sm font-oswald font-bold text-gray-400 uppercase tracking-widest mb-3">Sold Log ({soldLog.length})</h4>
                                    {soldLog.length === 0 ? (
                                        <p className="text-gray-600 text-sm text-center py-4">No players sold yet</p>
                                    ) : (
                                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                            {[...soldLog].reverse().map((log, i) => (
                                                <div key={log._id || i} className="flex items-center justify-between py-2 px-3 bg-white/5 rounded-xl">
                                                    <div>
                                                        <p className="text-sm text-white font-medium">{log.playerName}</p>
                                                        <p className="text-xs text-gray-500">→ {log.teamName}</p>
                                                    </div>
                                                    <div className="text-sm font-mono font-bold text-primary">₹{log.finalPrice?.toLocaleString()}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* COMPLETED */}
            {selectedCategoryId && !loading && auction?.status === 'completed' && (
                <div className="p-8 text-center flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center"><Trophy className="h-10 w-10 text-emerald-400" /></div>
                    <div>
                        <h3 className="text-3xl font-oswald font-bold text-white mb-2">Auction Complete!</h3>
                        <p className="text-gray-400">All {auction.totalPlayers} players have been processed.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-3xl mt-4">
                        {teams.map(team => (
                            <div key={team._id} className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.primaryColor || '#64748b' }} />
                                    <h4 className="font-bold text-white truncate">{team.name}</h4>
                                </div>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-gray-400">Players</span><span className="text-white font-bold">{team.playersCount}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Spent</span><span className="text-primary font-mono font-bold">₹{team.totalSpent.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span className="text-gray-400">Budget Left</span><span className="text-green-400 font-mono font-bold">₹{team.budget.toLocaleString()}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* MANUAL SELL MODAL */}
            {showSellModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-[#1a1a1a] border border-white/10 p-8 rounded-3xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-300">
                        <button onClick={() => setShowSellModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                        <h3 className="text-2xl font-oswald font-bold mb-2">Manual Sell</h3>
                        <p className="text-gray-400 text-sm mb-6">Assign <span className="text-white font-bold">{currentPlayer?.profile.firstName} {currentPlayer?.profile.lastName}</span> to a team</p>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Select Team *</label>
                                <select value={sellForm.teamId} onChange={e => setSellForm({ ...sellForm, teamId: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-primary">
                                    <option value="">Choose team...</option>
                                    {teams.map(team => <option key={team._id} value={team._id}>{team.name} — ₹{team.budget.toLocaleString()} left</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm text-gray-400">Sold Price (₹) *</label>
                                <input type="number" min="0" value={sellForm.soldPrice} onChange={e => setSellForm({ ...sellForm, soldPrice: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl bg-black/50 border border-white/10 text-white focus:outline-none focus:border-primary font-mono text-lg" placeholder="Enter final bid amount" />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-8">
                            <button onClick={() => setShowSellModal(false)} className="px-5 py-2.5 rounded-xl border border-white/10 text-white hover:bg-white/5 font-medium">Cancel</button>
                            <button onClick={handleSellPlayer} disabled={!sellForm.teamId || !sellForm.soldPrice || !!actionLoading}
                                className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold disabled:opacity-50 flex items-center gap-2">
                                {actionLoading === 'sell' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                Confirm Sale
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
};

export default AuctionSection;
