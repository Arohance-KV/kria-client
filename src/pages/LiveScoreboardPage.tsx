import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import API from '@/api/axios';
import { sportRegistry } from '@/sports/registry';

const extract = (res: any) => res.data?.data?.data || res.data?.data;

export default function LiveScoreboardPage() {
    const { matchId } = useParams<{ matchId: string }>();
    const [sport, setSport] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        if (!matchId) return;
        (async () => {
            try {
                // Resolve the sport from the match's OWN category, not the tournament — in a
                // multi-sport tournament, a match belonging to a non-first sport would otherwise
                // render with the wrong scoreboard. Fall back to the tournament's sport only for
                // legacy/single-sport data where the category has no sport recorded.
                const match = extract(await API.get(`/matches/${matchId}`));
                const categoryId = match?.categoryId;
                let resolvedSport: string | null = null;
                if (categoryId) {
                    const category = extract(await API.get(`/categories/${categoryId}`));
                    resolvedSport = category?.sport || null;
                }
                if (!resolvedSport) {
                    const tournamentId = match?.tournamentId;
                    if (!tournamentId) throw new Error('Match has no tournament.');
                    const tournament = extract(await API.get(`/tournament/${tournamentId}`));
                    resolvedSport = tournament?.sport || (tournament?.sports?.[0] ?? null);
                }
                if (active) setSport(resolvedSport);
            } catch (e: any) {
                if (active) setError(e?.response?.data?.message || e?.message || 'Could not load match.');
            }
        })();
        return () => { active = false; };
    }, [matchId]);

    if (!matchId) return null;
    if (error) return <div className="min-h-screen bg-[#111] flex items-center justify-center text-red-400">{error}</div>;
    if (!sport) return <div className="min-h-screen bg-[#111] flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    const Renderer = sportRegistry.get(sport)?.liveScoreboardRenderer;
    if (!Renderer) {
        return <div className="min-h-screen bg-[#111] flex items-center justify-center text-gray-400">Live view is not available for this sport.</div>;
    }
    return <Renderer matchId={matchId} />;
}
