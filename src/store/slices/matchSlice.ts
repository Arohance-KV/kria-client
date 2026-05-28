// Match-related shared types.
//
// This module was once a Redux slice, but its state was never read and its thunks
// were never dispatched (badminton scoring uses thunks in its plugin; cricket uses
// cricketLiveStateSlice). Stream 3 removed the dead slice; the file remains as the
// home for the shared `Match` type and its sub-types, imported by the public
// BracketPage and the player BracketTab.

export interface MatchTeams {
    team1Id: string;
    team2Id: string;
    team1Name: string;
    team2Name: string;
}

export interface MatchSchedule {
    date?: string;
    time?: string;
    court?: string;
    venue?: string;
}

export interface GameScore {
    gameNumber: number;
    team1Score: number;
    team2Score: number;
    winnerId?: string;
}

export interface MatchResult {
    team1Summary?: string;
    team2Summary?: string;
    team1Total?: number;
    team2Total?: number;
    marginOfVictory?: string;
}

export interface PlayerCompetitor {
    registrationId: string;
    name: string;
    teamId: string;
    teamName: string;
}

export interface Match {
    _id: string;
    tournamentId: string;
    categoryId: string;
    sportType: string;
    competitorType?: 'player' | 'team';
    bracketRound: string;
    matchNumber: number;
    roundNumber?: number;
    positionInRound?: number;
    nextMatchId?: string;
    nextMatchSlot?: string;
    teams: MatchTeams;
    player1?: PlayerCompetitor;
    player2?: PlayerCompetitor;
    schedule?: MatchSchedule;
    status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'walkover';
    gameScores: GameScore[];
    setScores: any[];
    periodScores: any[];
    inningsScores: any[];
    matchConfig?: {
        bestOf?: number;
        pointsToWin?: number;
        maxOvers?: number;
        periodMinutes?: number;
        numberOfPeriods?: number;
        gamesPerSeries?: number;
    };
    result?: MatchResult;
    winnerId?: string;
    winReason?: string;
    recordedBy?: string;
    lockedAt?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}
