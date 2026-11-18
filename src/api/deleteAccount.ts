import axios from 'axios';
import API from './axios';

// LAUNCH-AUDIT B7: deleting a player account from the web, through the
// emailed-code sign-in. Bare axios on purpose: the shared client's interceptor
// would swap in a stored (organiser) token for the player's.

const url = (path: string) => `${API.defaults.baseURL}${path}`;
const reason = (e: unknown, fallback: string) =>
    new Error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback);

export async function sendDeletionCode(email: string): Promise<void> {
    try {
        await axios.post(url('/player/auth/login/otp'), { email });
    } catch (e) {
        throw reason(e, 'Could not send a code. Try again.');
    }
}

export async function deleteWithCode(email: string, otp: string): Promise<void> {
    let token: string | undefined;
    try {
        const res = await axios.post(url('/player/auth/login/otp/verify'), { email, otp });
        token = res.data?.data?.data?.accessToken ?? res.data?.data?.accessToken;
    } catch (e) {
        throw reason(e, 'That code didn\'t work. Try again.');
    }
    if (!token) throw new Error('That code didn\'t work. Try again.');
    try {
        await axios.delete(url('/player/auth/account'), { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {
        throw reason(e, 'Could not delete your account. Try again.');
    }
}
