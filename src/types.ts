import React from 'react';

export interface Player {
    _id: string;
    profile: {
        firstName: string;
        lastName: string;
        age: number;
        gender: string;
        skillLevel: string;
        photo?: string;
    };
    auctionData: {
        basePrice: number;
    };
    careerStats?: {
        matchesPlayed: number;
        matchesWon: number;
        pointsContributed: number;
        tournamentsPlayed: number;
    };
}

export interface Team {
    _id: string;
    name: string;
    budget: number;
    initialBudget: number;
    playersCount: number;
    totalSpent: number;
    primaryColor?: string;
    secondaryColor?: string;
}

export interface AuctionStatus {
    _id: string;
    status: 'not_started' | 'in_progress' | 'paused' | 'sold' | 'completed';
    currentPlayerIndex: number;
    totalPlayers: number;
    logsCount: number;
    lastSoldResult?: {
        playerName: string;
        teamName: string;
        teamColor: string;
        soldPrice: number;
        timestamp: string;
    };
    liveBid: {
        currentPrice: number;
        highestBidderId: string;
        highestBidderName: string;
        bidHistory: { teamId: string; teamName: string; amount: number; timestamp: string }[];
        tiedTeams: string[];
        tieBreakerActive: boolean;
        spinWinnerId: string | null;
        spinStartedAt: string | null;
    };
    settings: {
        minBidIncrement: number;
        bidDurationSeconds: number;
        hardLimit: number;
    };
    unsoldCount: number;
    rotationCount: number;
}

export interface AuctionSoldLog {
    _id: string;
    registrationId: string;
    playerName: string;
    teamId: string;
    teamName: string;
    finalPrice: number;
    auctionType: string;
    recordedBy: string;
    timestamp: string;
}

// A captain/icon pre-assigned to a team, shown in the sold log alongside
// auctioned players — carries a role badge instead of a price.
export interface AuctionPreAssigned {
    registrationId: string;
    playerName: string;
    playerPhoto?: string | null;
    teamId: string;
    teamName: string;
    role: 'captain' | 'icon';
}
