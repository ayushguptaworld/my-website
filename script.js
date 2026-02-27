const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('status');
const resetBtn = document.getElementById('reset-btn');
const boardEl = document.getElementById('board');

// Connection UI Elements
const myIdEl = document.getElementById('my-id');
const copyBtn = document.getElementById('copy-btn');
const friendIdInput = document.getElementById('friend-id');
const connectBtn = document.getElementById('connect-btn');
const connectionPanel = document.getElementById('connection-panel');

// Web Audio API for sound effects
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'win') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
        osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1); // C#5
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2); // E5
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3); // A5
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.6);
    } else if (type === 'draw') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let running = false;
let myRole = ''; // Will be 'X' or 'O' once connected

const winConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// ----- PEER JS SETUP -----
const marvelHeroes = [
    "IRONMAN", "THOR", "HULK", "CAPTAIN", "WIDOW", "HAWKEYE",
    "SPIDERMAN", "PANTHER", "STRANGE", "ANTMAN", "WASP", "MARVEL",
    "VISION", "WANDA", "FALCON", "LOKI", "GROOT", "ROCKET", "STARLORD",
    "DRAX", "GAMORA", "BUCKY", "VENOM", "DEADPOOL", "WOLVERINE"
];

// Generate a Marvel hero + 2 digits for uniqueness (e.g. THOR42)
function generateHeroId() {
    const randomHero = marvelHeroes[Math.floor(Math.random() * marvelHeroes.length)];
    const randomNum = Math.floor(Math.random() * 90 + 10); // 10 to 99
    return `${randomHero}${randomNum}`;
}

const customPeerId = generateHeroId();
const peer = new Peer(customPeerId); // Pass the custom ID
let conn = null;

peer.on('open', (id) => {
    myIdEl.textContent = id;
});

// When someone else connects to us (We become Player X, they are Player O)
peer.on('connection', (connection) => {
    if (conn) {
        connection.send({ type: 'error', message: 'Game already in progress.' });
        connection.close();
        return;
    }
    setupConnection(connection, 'X');
});

// We initiate connection to someone else (They are Player X, we are Player O)
connectBtn.addEventListener('click', () => {
    const friendId = friendIdInput.value.trim();
    if (!friendId) return;

    statusText.textContent = "Connecting...";
    const connection = peer.connect(friendId);
    setupConnection(connection, 'O');
});

copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(myIdEl.textContent);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => copyBtn.textContent = 'Copy', 2000);
});

function setupConnection(connection, role) {
    conn = connection;
    myRole = role;

    conn.on('open', () => {
        // Connected!
        connectionPanel.style.display = 'none';
        boardEl.style.pointerEvents = 'auto';
        boardEl.style.opacity = '1';
        resetBtn.style.display = 'block';

        startGame();
    });

    conn.on('data', (data) => {
        if (data.type === 'move') {
            handleOpponentMove(data.index, data.player);
        } else if (data.type === 'restart') {
            restartGame(false);
        }
    });

    conn.on('close', () => {
        alert("Opponent disconnected!");
        location.reload();
    });
}
// -----------------------

function startGame() {
    cells.forEach(cell => cell.addEventListener('click', cellClicked));
    resetBtn.addEventListener('click', () => restartGame(true));
    currentPlayer = 'ANY'; // ANY means whoever clicks first starts
    running = true;
    updateStatusText();
}

function cellClicked() {
    const cellIndex = this.getAttribute('data-index');

    if (board[cellIndex] !== '' || !running) {
        return;
    }

    if (currentPlayer !== 'ANY' && myRole !== currentPlayer) {
        return; // Not my turn
    }

    // If it's the very first move, the person who clicked dictates that their role went first
    if (currentPlayer === 'ANY') {
        currentPlayer = myRole;
    }

    // Make local move
    makeMove(cellIndex, myRole);

    // Send move to opponent
    conn.send({ type: 'move', index: cellIndex, player: myRole });
}

function handleOpponentMove(index, player) {
    if (currentPlayer === 'ANY') {
        currentPlayer = player;
    }
    makeMove(index, player);
}

function makeMove(index, player) {
    playSound('click');
    board[index] = player;
    cells[index].textContent = player;
    cells[index].classList.add(player.toLowerCase());

    checkWinner(true);

    if (running) {
        currentPlayer = (currentPlayer === 'X') ? 'O' : 'X';
        updateStatusText();
    }
}

function updateStatusText() {
    if (!running) return;
    if (currentPlayer === 'ANY') {
        statusText.textContent = "Game started! Anyone can make the first move.";
    } else {
        let turnMsg = (currentPlayer === myRole) ? "Your Turn" : "Opponent's Turn";
        statusText.textContent = `Player ${currentPlayer}'s turn (${turnMsg})`;
    }
}

function checkWinner(highlight) {
    let roundWon = false;
    let winner = '';

    for (let i = 0; i < winConditions.length; i++) {
        const condition = winConditions[i];
        const cellA = board[condition[0]];
        const cellB = board[condition[1]];
        const cellC = board[condition[2]];

        if (cellA === '' || cellB === '' || cellC === '') continue;

        if (cellA === cellB && cellB === cellC) {
            roundWon = true;
            winner = cellA;
            if (highlight) {
                cells[condition[0]].style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
                cells[condition[1]].style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
                cells[condition[2]].style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
            }
            break;
        }
    }

    if (roundWon) {
        playSound('win');
        let msg = (winner === myRole) ? "You win! 🎉" : "Opponent wins! 😢";
        statusText.textContent = `Player ${winner} wins! ${msg}`;
        running = false;
    } else if (!board.includes('')) {
        playSound('draw');
        statusText.textContent = 'Draw! 🤝';
        running = false;
    }
}

function restartGame(emit) {
    currentPlayer = 'ANY';
    board = ['', '', '', '', '', '', '', '', ''];
    running = true;
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o');
        cell.style.backgroundColor = '';
    });
    updateStatusText();

    if (emit) {
        conn.send({ type: 'restart' });
    }
}
