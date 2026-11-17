const { io } = require('socket.io-client');

const socket = io(process.env.URL || 'http://localhost:5000', { auth: { token: process.env.TOKEN } });
socket.onAny((event, payload) => console.log(event, JSON.stringify(payload, null, 2)));
socket.on('connect_error', (e) => console.log('connect_error:', e.message));