import { io } from 'socket.io-client';
import { API_URL } from '@/api/axios';

const SOCKET_URL = API_URL;

export const socket = io(SOCKET_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: false,
});
