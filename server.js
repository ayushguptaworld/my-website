const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let players = {};
let currentPlayer = 'X';
let board = ['', '', '', '', '', '', '', '', ''];
let running = true;

const winConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function checkWin() {
    let roundWon = false;
    for (let i = 0; i < winConditions.length; i++) {
        const [a, b, c] = winConditions[i];
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            roundWon = true;
            break;
        }
    }
    if (roundWon || !board.includes('')) {
        running = false;
    }
}

io.on('connection', (socket) => {
    // Assign roles dynamically
    if (!Object.values(players).includes('X')) {
        players[socket.id] = 'X';
    } else if (!Object.values(players).includes('O')) {
        players[socket.id] = 'O';
    } else {
        players[socket.id] = 'Spectator';
    }

    socket.emit('init', {
        role: players[socket.id],
        board: board,
        currentPlayer: currentPlayer,
        running: running
    });

    socket.on('makeMove', (index) => {
        if (!running || board[index] !== '') return;
        if (players[socket.id] !== currentPlayer) return;

        board[index] = currentPlayer;

        io.emit('moveMade', {
            index: index,
            player: currentPlayer
        });

        checkWin();
        if (running) {
            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            io.emit('turnChange', currentPlayer);
        }
    });

    socket.on('restartGame', () => {
        board = ['', '', '', '', '', '', '', '', ''];
        currentPlayer = 'X';
        running = true;
        io.emit('gameRestarted');
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
});
