import React, { useState } from 'react';
import { Loader2, Save, X, Trophy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { teamLeagueApi } from '@/sports/badminton/api/teamLeague';

interface Props {
    match: any;
    onClose: () => void;
    onSaved: () => void;
    setError: (err: string | null) => void;
}

export default function SubMatchResultModal({ match, onClose, onSaved, setError }: Props) {
    const [winnerId, setWinnerId] = useState('');
    const [gameScores, setGameScores] = useState<{ gameNumber: number; team1Score: number; team2Score: number }[]>(
        [{ gameNumber: 1, team1Score: 0, team2Score: 0 }]
    );
    const [saving, setSaving] = useState(false);

    // For sub-matches, player1.teamId is the clean team ObjectId (player1.registrationId
    // is unreliable for doubles — it's stored as "id1,id2" joined by comma).
    const team1Id = match.teams?.team1Id || match.player1?.teamId;
    const team2Id = match.teams?.team2Id || match.player2?.teamId;
    const team1Name = match.player1?.name || match.teams?.team1Name || 'Team 1';
    const team2Name = match.player2?.name || match.teams?.team2Name || 'Team 2';

    const addGame = () => {
        setGameScores(prev => [...prev, { gameNumber: prev.length + 1, team1Score: 0, team2Score: 0 }]);
    };

    const removeGame = (idx: number) => {
        if (gameScores.length <= 1) return;
        setGameScores(prev => prev.filter((_, i) => i !== idx).map((g, i) => ({ ...g, gameNumber: i + 1 })));
    };

    const updateScore = (idx: number, field: 'team1Score' | 'team2Score', value: number) => {
        setGameScores(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
    };

    const handleSave = async () => {
        if (!winnerId) {
            setError('Please select a winner.');
            return;
        }
        setSaving(true);
        setError(null);
        try {
            await teamLeagueApi.recordSubMatchResult(match._id, {
                winnerId,
                gameScores,
            });
            onSaved();
            onClose();
        } catch (e: any) {
            setError(e.response?.data?.message || 'Failed to record result');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-bold text-white">Record Result</h3>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
                </div>

                <div className="space-y-4">
                    {/* Winner selection */}
                    <div className="space-y-2">
                        <Label className="text-gray-400">Winner</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setWinnerId(team1Id)}
                                className={`p-3 rounded-lg text-sm font-medium border transition-colors ${
                                    winnerId === team1Id
                                        ? 'bg-primary/20 text-primary border-primary/50'
                                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                {team1Name}
                            </button>
                            <button
                                onClick={() => setWinnerId(team2Id)}
                                className={`p-3 rounded-lg text-sm font-medium border transition-colors ${
                                    winnerId === team2Id
                                        ? 'bg-primary/20 text-primary border-primary/50'
                                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                                }`}
                            >
                                {team2Name}
                            </button>
                        </div>
                    </div>

                    {/* Game scores */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-gray-400">Game Scores</Label>
                            <button onClick={addGame} className="text-xs text-primary hover:text-primary/80">+ Add Game</button>
                        </div>
                        {gameScores.map((game, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-black/40 rounded-lg">
                                <span className="text-xs text-gray-500 w-8">G{game.gameNumber}</span>
                                <Input
                                    type="number"
                                    min={0}
                                    value={game.team1Score}
                                    onChange={(e) => updateScore(idx, 'team1Score', Number(e.target.value))}
                                    className="bg-black/50 border-white/10 text-white h-8 text-sm text-center w-16"
                                />
                                <span className="text-gray-600 text-xs">-</span>
                                <Input
                                    type="number"
                                    min={0}
                                    value={game.team2Score}
                                    onChange={(e) => updateScore(idx, 'team2Score', Number(e.target.value))}
                                    className="bg-black/50 border-white/10 text-white h-8 text-sm text-center w-16"
                                />
                                {gameScores.length > 1 && (
                                    <button onClick={() => removeGame(idx)} className="p-1 text-red-400 hover:text-red-500">
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <button onClick={onClose} className="px-4 py-2 rounded-full border border-white/10 text-white text-sm hover:bg-white/5">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !winnerId}
                            className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Result
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
