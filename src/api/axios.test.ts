import { describe, expect, it } from 'vitest';
import { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import API from './axios';

// Records the config a request leaves with, instead of sending it.
const sent = async (send: (adapter: (c: InternalAxiosRequestConfig) => Promise<never>) => Promise<unknown>) => {
    let seen: InternalAxiosRequestConfig | undefined;
    await send(async (c) => { seen = c; return { data: {}, status: 200, statusText: 'OK', headers: {}, config: c } as never; });
    return seen!;
};

// LAUNCH-AUDIT H21: a stalled request used to hang forever and lock the scoring pad.
describe('API timeouts', () => {
    it('gives up on a request after 15 s', async () => {
        expect((await sent(adapter => API.get('/ping', { adapter }))).timeout).toBe(15000);
    });

    it('gives an upload 2 minutes, so a big banner on a slow connection is not cut off', async () => {
        expect((await sent(adapter => API.post('/upload/image', new FormData(), { adapter }))).timeout).toBe(120000);
    });

    it('says a timeout in words, not "timeout of 15000ms exceeded"', async () => {
        const adapter = async (c: InternalAxiosRequestConfig) => { throw new AxiosError('timeout of 15000ms exceeded', 'ECONNABORTED', c); };
        await expect(API.get('/slow', { adapter })).rejects.toMatchObject({ message: "Kria didn't answer in time. Check your connection and try again." });
    });
});
