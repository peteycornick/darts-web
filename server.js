const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// In-memory game database
const games = {};

// Game Logic Helper
function calc(state) {
    let out = { ...state };
    out.homeScore = (state.homeBase || 0) + state.homeHistory.reduce((a, b) => a + b, 0);
    out.awayScore = (state.awayBase || 0) + state.awayHistory.reduce((a, b) => a + b, 0);
    out.homeSetup = (state.homeBase === 0);
    out.awaySetup = (state.awayBase === 0);
    out.homeCanUndo = state.homeSnapshot !== null;
    out.awayCanUndo = state.awaySnapshot !== null;
    return out;
}

io.on('connection', (socket) => {
    
    socket.on('create', () => {
        const gameId = Math.floor(100000 + Math.random() * 900000).toString();
        games[gameId] = {
            homeName: 'Home', awayName: 'Away',
            homeBase: 501, awayBase: 501,
            homeLastBase: 501, awayLastBase: 501,
            homeHistory: [], awayHistory: [],
            homeLegs: 0, awayLegs: 0,
            homeSnapshot: null, awaySnapshot: null
        };
        socket.join(gameId);
        socket.emit('gameJoined', { gameId, isHost: true, state: calc(games[gameId]) });
    });

    socket.on('join', (id) => {
        if (games[id]) {
            socket.join(id);
            socket.emit('gameJoined', { gameId: id, isHost: false, state: calc(games[id]) });
        } else {
            socket.emit('errorMsg', 'Game not found');
        }
    });

    socket.on('action', (data) => {
        const { id, team, type, value, index } = data;
        let state = games[id];
        if (!state) return;

        if (type === 'name') {
            state[`${team}Name`] = value;
        } 
        else if (type === 'legUpdate') {
            state[`${team}Legs`] = Math.max(0, state[`${team}Legs`] + value);
        }
        else if (type === 'reset') {
            state[`${team}Snapshot`] = { base: state[`${team}Base`], history: [...state[`${team}History`]] };
            state[`${team}History`] = [];
            state[`${team}Base`] = 0;
        }
        else if (type === 'resetDefault') {
            state[`${team}Base`] = state[`${team}LastBase`] || 501;
            state[`${team}History`] = [];
            state[`${team}Snapshot`] = null;
        }
        else if (type === 'nextLeg') {
            state[`${team}History`] = [];
            state[`${team}Base`] = state[`${team}LastBase`] || 501;
            state[`${team}Snapshot`] = null;
        }
        else if (type === 'undo') {
            if (state[`${team}Snapshot`]) {
                state[`${team}Base`] = state[`${team}Snapshot`].base;
                state[`${team}History`] = [...state[`${team}Snapshot`].history];
                state[`${team}Snapshot`] = null;
            }
        }
        else {
            if (type !== 'reset') state[`${team}Snapshot`] = null;

            if (type === 'throw') {
                if (state[`${team}Base`] === 0) {
                    state[`${team}Base`] = Math.abs(value);
                    state[`${team}LastBase`] = Math.abs(value);
                    state[`${team}History`] = [];
                } else {
                    state[`${team}History`].unshift(value);
                }
            } else if (type === 'edit') {
                if (state[`${team}History`][index] !== undefined) {
                    state[`${team}History`][index] = value;
                }
            }
        }

        // Rules check
        const base = state[`${team}Base`];
        const currentScore = base + state[`${team}History`].reduce((a, b) => a + b, 0);
        if (base !== 0 && currentScore < 0) {
            if (type === 'throw') state[`${team}History`].shift();
        }

        // Push update to everyone instantly
        io.to(id).emit('sync', calc(state));
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));