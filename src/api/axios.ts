import axios from 'axios';

// .env.development points `npm run dev` at a local server (LAUNCH-AUDIT H25).
export const API_URL: string = import.meta.env.VITE_API_URL || 'https://api.kria.club';
const baseURL = API_URL;

const API = axios.create({
    baseURL,
    withCredentials: true,
    // A stalled request gives up instead of locking a page, e.g. the scoring pad (LAUNCH-AUDIT H21).
    timeout: 15000,
});

// Interceptor to attach token
API.interceptors.request.use((req) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    if (req.data instanceof FormData) req.timeout = 120000; // an upload on a slow connection takes longer
    return req;
});

/** The server's own message for a failed request, else `fallback`. */
export const serverMessage = (err: unknown, fallback: string): string =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;

// Every slice shows err.message when the server sends none: say a timeout in words.
API.interceptors.response.use(undefined, (error) => {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        error.message = "Kria didn't answer in time. Check your connection and try again.";
    }
    return Promise.reject(error);
});

export default API;
