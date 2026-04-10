import { io } from 'socket.io-client';

const isDevelopment = import.meta.env.MODE === 'development';
const SOCKET_URL = isDevelopment ? 'http://localhost:4010' : 'https://api.kria.club';

export const socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
});
