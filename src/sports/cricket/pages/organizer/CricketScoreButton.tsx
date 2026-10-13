import { useNavigate } from 'react-router-dom';
import { Swords } from 'lucide-react';
import type { MatchResultSectionProps } from '@/sports/_contracts/SportPlugin';
import { BTN_SECONDARY, BTN_SM } from '@/pages/organizer/shared';
import { cn } from '@/lib/utils';

export default function CricketScoreButton({ match }: MatchResultSectionProps) {
    const navigate = useNavigate();
    const isBye = match.status === 'walkover' && match.winReason === 'bye';
    const isTBD = match.teams?.team1Name === 'TBD' || match.teams?.team2Name === 'TBD';
    if (isBye || isTBD) return null;

    return (
        <button type="button" onClick={() => navigate(`/organizer/cricket/match/${match._id}/score`)} className={cn(BTN_SECONDARY, BTN_SM)}>
            <Swords aria-hidden className="h-3.5 w-3.5" />
            {match.status === 'completed' ? 'View match' : 'Score match'}
        </button>
    );
}
