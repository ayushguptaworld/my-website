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

// Chat UI Elements
const chatPanel = document.getElementById('chat-panel');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send-btn');

// Video UI Elements
const videoPanel = document.getElementById('video-panel');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const callBtn = document.getElementById('call-btn');
const endCallBtn = document.getElementById('end-call-btn');
const muteAudioBtn = document.getElementById('mute-audio-btn');
const muteVideoBtn = document.getElementById('mute-video-btn');

let localStream = null;
let currentCall = null;

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
    } else if (type === 'chat') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }
}

let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let running = false;
let myRole = ''; // Will be 'X' or 'O' once connected
let isComputerMode = false;

const winConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

// ----- UI LISTENERS -----
const playComputerBtn = document.getElementById('play-computer-btn');
playComputerBtn.addEventListener('click', () => {
    isComputerMode = true;
    myRole = 'X'; // Human is always X
    connectionPanel.style.display = 'none';
    boardEl.style.pointerEvents = 'auto';
    boardEl.style.opacity = '1';
    resetBtn.style.display = 'block';

    startGame();
});

// Chat Listeners
chatSendBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

// Video Call Listeners
async function getLocalStream() {
    if (localStream) return localStream;
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
        return localStream;
    } catch (err) {
        console.error('Failed to get local stream', err);
        alert('Could not access camera/microphone. Please grant permissions.');
        return null;
    }
}

callBtn.addEventListener('click', async () => {
    if (!conn) return;
    const stream = await getLocalStream();
    if (!stream) return;

    callBtn.style.display = 'none';
    endCallBtn.style.display = 'inline-block';
    muteAudioBtn.style.display = 'flex';
    muteVideoBtn.style.display = 'flex';

    statusText.textContent = "Calling...";
    const call = peer.call(conn.peer, stream);
    setupCallEvents(call);
});

endCallBtn.addEventListener('click', () => {
    if (currentCall) {
        currentCall.close();
    }
    stopLocalStream();
    resetCallUI();
});

muteAudioBtn.addEventListener('click', () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        if (audioTrack.enabled) {
            muteAudioBtn.textContent = '🎤';
            muteAudioBtn.classList.remove('muted');
        } else {
            muteAudioBtn.textContent = '🔇';
            muteAudioBtn.classList.add('muted');
        }
    }
});

muteVideoBtn.addEventListener('click', () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        if (videoTrack.enabled) {
            muteVideoBtn.textContent = '📹';
            muteVideoBtn.classList.remove('muted');
        } else {
            muteVideoBtn.textContent = '🚫';
            muteVideoBtn.classList.add('muted');
        }
    }
});

function setupCallEvents(call) {
    currentCall = call;

    call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        statusText.textContent = "In Call";
    });

    call.on('close', () => {
        remoteVideo.srcObject = null;
        statusText.textContent = `Player ${currentPlayer}'s turn`;
        resetCallUI();
        stopLocalStream();
    });
}

function stopLocalStream() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localVideo.srcObject = null;
        localStream = null;
    }
}

function resetCallUI() {
    callBtn.style.display = 'inline-block';
    endCallBtn.style.display = 'none';
    muteAudioBtn.style.display = 'none';
    muteVideoBtn.style.display = 'none';
    muteAudioBtn.textContent = '🎤';
    muteVideoBtn.textContent = '📹';
    muteAudioBtn.classList.remove('muted');
    muteVideoBtn.classList.remove('muted');
}

function sendChatMessage() {
    const text = chatInput.value.trim();
    if (!text || !conn) return;

    // Send to peer
    conn.send({ type: 'chat', text: text });

    // Append locally
    appendChatMessage(text, 'self');
    chatInput.value = '';
}

function appendChatMessage(text, senderType) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', senderType);
    msgDiv.textContent = text;
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (senderType === 'other') {
        playSound('chat');
    }
}

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
    if (conn || isComputerMode) {
        connection.send({ type: 'error', message: 'Game already in progress.' });
        connection.close();
        return;
    }
    setupConnection(connection, 'X');
});

// Handle incoming video calls
peer.on('call', async (call) => {
    // Answer the call automatically with our stream
    const stream = await getLocalStream();
    if (stream) {
        call.answer(stream);
        setupCallEvents(call);

        callBtn.style.display = 'none';
        endCallBtn.style.display = 'inline-block';
        muteAudioBtn.style.display = 'flex';
        muteVideoBtn.style.display = 'flex';
    } else {
        console.warn("Could not answer call without media stream");
    }
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

        // Show board, chat, and video panel
        boardEl.style.pointerEvents = 'auto';
        boardEl.style.opacity = '1';
        resetBtn.style.display = 'block';
        chatPanel.style.display = 'flex';
        videoPanel.style.display = 'flex';

        startGame();
    });

    conn.on('data', (data) => {
        if (data.type === 'move') {
            handleOpponentMove(data.index, data.player);
        } else if (data.type === 'restart') {
            restartGame(false);
        } else if (data.type === 'chat') {
            appendChatMessage(data.text, 'other');
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
    currentPlayer = isComputerMode ? 'X' : 'ANY'; // ANY means whoever clicks first starts in MP
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

    if (isComputerMode) {
        if (running) {
            // Give the computer a small delay to feel natural
            setTimeout(computerTurn, 500);
        }
    } else {
        // Send move to opponent
        conn.send({ type: 'move', index: cellIndex, player: myRole });
    }
}

// ----- COMPUTER AI (MINIMAX) -----
function computerTurn() {
    if (!running) return;

    // Sometimes make a random move to make it beatable (20% chance)
    if (Math.random() < 0.2) {
        let emptyIndices = [];
        board.forEach((cell, idx) => { if (cell === '') emptyIndices.push(idx); });
        let randomIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        makeMove(randomIdx, 'O');
    } else {
        let bestScore = -Infinity;
        let bestMove;

        for (let i = 0; i < 9; i++) {
            if (board[i] === '') {
                board[i] = 'O';
                let score = minimax(board, 0, false);
                board[i] = '';
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = i;
                }
            }
        }
        makeMove(bestMove, 'O');
    }
}

let scores = {
    'X': -10, // Human
    'O': 10,  // Computer
    'draw': 0
};

function checkWinnerMinimax(b) {
    for (let i = 0; i < winConditions.length; i++) {
        const [a, b1, c] = winConditions[i];
        if (b[a] && b[a] === b[b1] && b[a] === b[c]) {
            return b[a];
        }
    }
    if (!b.includes('')) return 'draw';
    return null;
}

function minimax(b, depth, isMaximizing) {
    let result = checkWinnerMinimax(b);
    if (result !== null) return scores[result];

    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (b[i] === '') {
                b[i] = 'O';
                let score = minimax(b, depth + 1, false);
                b[i] = '';
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (b[i] === '') {
                b[i] = 'X';
                let score = minimax(b, depth + 1, true);
                b[i] = '';
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}
// ---------------------------------

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
        if (isComputerMode) {
            let turnMsg = (currentPlayer === myRole) ? "Your Turn" : "Computer is thinking...";
            statusText.textContent = turnMsg;
        } else {
            let turnMsg = (currentPlayer === myRole) ? "Your Turn" : "Opponent's Turn";
            statusText.textContent = `Player ${currentPlayer}'s turn (${turnMsg})`;
        }
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
        let msg = "";
        if (isComputerMode) {
            msg = (winner === myRole) ? "You win! 🎉" : "Computer wins! 🤖";
        } else {
            msg = (winner === myRole) ? "You win! 🎉" : "Opponent wins! 😢";
        }
        statusText.textContent = `Player ${winner} wins! ${msg}`;
        running = false;
    } else if (!board.includes('')) {
        playSound('draw');
        statusText.textContent = 'Draw! 🤝';
        running = false;
    }
}

function restartGame(emit) {
    currentPlayer = isComputerMode ? 'X' : 'ANY';
    board = ['', '', '', '', '', '', '', '', ''];
    running = true;
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o');
        cell.style.backgroundColor = '';
    });
    updateStatusText();

    if (emit && !isComputerMode && conn) {
        conn.send({ type: 'restart' });
    }
}
