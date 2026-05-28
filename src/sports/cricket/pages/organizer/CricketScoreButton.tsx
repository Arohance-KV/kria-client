import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords } from 'lucide-react';
import type { MatchResultSectionProps } from '@/sports/_contracts/SportPlugin';

export default function CricketScoreButton({ match }: MatchResultSectionProps) {
    const navigate = useNavigate();
    const isBye = match.status === 'walkover' && match.winReason === 'bye';
    const isTBD = match.teams?.team1Name === 'TBD' || match.teams?.team2Name === 'TBD';
    if (isBye || isTBD) return null;

    const label = match.status === 'completed' ? 'View Match' : 'Score / Manage Match';
    return (
        <div className="px-4 py-2 border-t border-white/5 flex justify-end">
            <button
                onClick={() => navigate(`/organizer/cricket/match/${match._id}/score`)}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
            >
                <Swords className="h-3.5 w-3.5" /> {label}
            </button>
        </div>
    );
}
