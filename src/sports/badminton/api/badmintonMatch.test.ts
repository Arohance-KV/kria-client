import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { badmintonMatchApi } from './badmintonMatch';

const REOPEN_URL = 'https://api.kria.club/sports/badminton/match/m1/reopen';

describe('badmintonMatchApi.reopenMatch', () => {
    it('posts to the match reopen endpoint and unwraps the consequence payload', async () => {
        server.use(
            http.post(REOPEN_URL, () =>
                HttpResponse.json({
                    data: {
                        data: {
                            match: { _id: 'm1', status: 'scheduled' },
                            rowsDeleted: 2,
                            bracketCleared: true,
                            categoryReopened: false,
                        },
                    },
                }),
            ),
        );

        const out = await badmintonMatchApi.reopenMatch('m1');

        expect(out.match.status).toBe('scheduled');
        expect(out.rowsDeleted).toBe(2);
        expect(out.bracketCleared).toBe(true);
    });

    // The load-bearing case. The server refuses a reopen when a downstream match
    // has already started, and the message names WHICH match is in the way — so
    // it has to reach the organizer intact. If this method ever grows a catch that
    // returns null or a generic string, the organizer is told "something went
    // wrong" about a problem they could have fixed themselves.
    it('lets the server refusal reach the caller with its message intact', async () => {
        server.use(
            http.post(REOPEN_URL, () =>
                HttpResponse.json(
                    { message: 'Cannot reopen: Semi Final match 2 has already started. Correct that match first.' },
                    { status: 400 },
                ),
            ),
        );

        await expect(badmintonMatchApi.reopenMatch('m1')).rejects.toMatchObject({
            response: {
                status: 400,
                data: { message: 'Cannot reopen: Semi Final match 2 has already started. Correct that match first.' },
            },
        });
    });
});
