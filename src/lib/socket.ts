import { io } from 'socket.io-client';

const SOCKET_URL = 'https://api.kria.club';

export const socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
});
