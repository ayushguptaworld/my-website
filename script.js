const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('status');
const resetBtn = document.getElementById('reset-btn');

let board = ['', '', '', '', '', '', '', '', ''];
let currentPlayer = 'X';
let running = false;

const winConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
];

initializeGame();

function initializeGame() {
    cells.forEach(cell => cell.addEventListener('click', cellClicked));
    resetBtn.addEventListener('click', restartGame);
    statusText.textContent = `Player ${currentPlayer}'s turn`;
    running = true;
}

function cellClicked() {
    const cellIndex = this.getAttribute('data-index');

    if (board[cellIndex] !== '' || !running) {
        return;
    }

    updateCell(this, cellIndex);
    checkWinner();
}

function updateCell(cell, index) {
    board[index] = currentPlayer;
    cell.textContent = currentPlayer;
    cell.classList.add(currentPlayer.toLowerCase());
}

function changePlayer() {
    currentPlayer = (currentPlayer === 'X') ? 'O' : 'X';
    statusText.textContent = `Player ${currentPlayer}'s turn`;
}

function checkWinner() {
    let roundWon = false;

    for (let i = 0; i < winConditions.length; i++) {
        const condition = winConditions[i];
        const cellA = board[condition[0]];
        const cellB = board[condition[1]];
        const cellC = board[condition[2]];

        if (cellA === '' || cellB === '' || cellC === '') {
            continue;
        }

        if (cellA === cellB && cellB === cellC) {
            roundWon = true;
            break;
        }
    }

    if (roundWon) {
        statusText.textContent = `Player ${currentPlayer} wins! 🎉`;
        running = false;
        highlightWinningCells();
    } else if (!board.includes('')) {
        statusText.textContent = 'Draw! 🤝';
        running = false;
    } else {
        changePlayer();
    }
}

function highlightWinningCells() {
    for (let i = 0; i < winConditions.length; i++) {
        const condition = winConditions[i];
        const cellA = condition[0];
        const cellB = condition[1];
        const cellC = condition[2];
        
        if (board[cellA] !== '' && board[cellA] === board[cellB] && board[cellB] === board[cellC]) {
            cells[cellA].style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
            cells[cellB].style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
            cells[cellC].style.backgroundColor = 'rgba(255, 255, 255, 0.4)';
            break;
        }
    }
}

function restartGame() {
    currentPlayer = 'X';
    board = ['', '', '', '', '', '', '', '', ''];
    statusText.textContent = `Player ${currentPlayer}'s turn`;
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('x', 'o');
        cell.style.backgroundColor = '';
    });
    running = true;
}
