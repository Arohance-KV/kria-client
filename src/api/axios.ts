import axios from 'axios';

const baseURL = 'https://api.kria.club';

const API = axios.create({
    baseURL,
    withCredentials: true,
});

// Interceptor to attach token
API.interceptors.request.use((req) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
        req.headers.Authorization = `Bearer ${token}`;
    }
    return req;
});

export default API;
