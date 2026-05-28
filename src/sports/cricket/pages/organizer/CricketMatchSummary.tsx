import React from 'react';
import { Trophy } from 'lucide-react';

interface Props {
    match: any;       // completed match (has inningsScores, winnerId, teams, result)
}

export default function CricketMatchSummary({ match }: Props) {
    const team1 = { id: match?.teams?.team1Id, name: match?.teams?.team1Name || 'Team 1' };
    const team2 = { id: match?.teams?.team2Id, name: match?.teams?.team2Name || 'Team 2' };
    const winnerName = String(match?.winnerId) === String(team1.id) ? team1.name
        : String(match?.winnerId) === String(team2.id) ? team2.name : 'Winner';
    const innings = match?.inningsScores || [];

    return (
        <div className="max-w-lg mx-auto bg-black/30 border border-emerald-500/30 rounded-2xl p-6 flex flex-col gap-4 text-center">
            <Trophy className="h-10 w-10 text-emerald-400 mx-auto" />
            <h3 className="text-xl font-bold text-white">Match Complete</h3>
            <p className="text-emerald-400 font-semibold">{winnerName} won{match?.result?.marginOfVictory ? ` ${match.result.marginOfVictory}` : ''}.</p>
            <div className="flex flex-col gap-2">
                {innings.map((inn: any, i: number) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-gray-200">
                        Innings {inn.inningsNumber}: {inn.runs}/{inn.wickets} ({inn.overs}{inn.balls ? `.${inn.balls}` : ''} ov)
                    </div>
                ))}
            </div>
            <p className="text-xs text-gray-500">Winner has advanced in the bracket automatically.</p>
        </div>
    );
}
