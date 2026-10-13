import { describe, expect, it } from 'vitest';
import reducer, { fetchMatchAndLive } from './cricketLiveStateSlice';

// A socket reconnect refetches the match. Flipping a loaded entry to 'loading'
// or 'error' swaps the console for a full-page spinner and unmounts whatever
// the scorer had open (a wicket dialog, picks not yet posted).
describe('cricketLiveState — refetching a loaded match', () => {
    const loaded = reducer(undefined, fetchMatchAndLive.fulfilled({ matchId: 'm1', match: { _id: 'm1' }, liveState: { runs: 4 } }, 'r1', 'm1'));

    it('stays idle while a refetch is in flight', () => {
        const next = reducer(loaded, fetchMatchAndLive.pending('r2', 'm1'));
        expect(next.byMatchId.m1.status).toBe('idle');
        expect(next.byMatchId.m1.liveState).toEqual({ runs: 4 });
    });

    it('keeps the loaded match when a refetch fails', () => {
        const next = reducer(loaded, fetchMatchAndLive.rejected(new Error('offline'), 'r2', 'm1'));
        expect(next.byMatchId.m1.status).toBe('idle');
    });

    it('still shows loading and errors on the first fetch', () => {
        expect(reducer(undefined, fetchMatchAndLive.pending('r1', 'm1')).byMatchId.m1.status).toBe('loading');
        expect(reducer(undefined, fetchMatchAndLive.rejected(new Error('nope'), 'r1', 'm1')).byMatchId.m1.status).toBe('error');
    });
});
