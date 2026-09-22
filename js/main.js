import { OTTGame, PIECE_TYPES, TEAMS } from './rules.js';

// SVG Vector siêu sắc nét chuẩn Gaming
// Bộ icon Khí giới Chiến thuật: Chiến chùy (Búa) - Khiên hộ mệnh (Bao) - Song kiếm chéo (Kéo)
const PIECE_SVGS = {
    // 1. ĐẤM / BÚA -> CHIẾN CHÙY (Warhammer / Mace)
    [PIECE_TYPES.ROCK]: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- Đầu búa chiến trận -->
            <path d="M15 4l4 4-2.5 2.5-4-4L15 4z" fill="currentColor" fill-opacity="0.3"/>
            <path d="M13.5 2.5l5 5"/>
            <path d="M11 5l5 5"/>
            <!-- Cán búa bọc thép -->
            <path d="M12.5 6.5L4 15l2 2 8.5-8.5"/>
            <!-- Đuôi cán búa -->
            <circle cx="3.5" cy="18.5" r="1.5" fill="currentColor"/>
        </svg>`,
    
    // 2. LÁ / BAO -> KHIÊN HỘ MỆNH (Guardian Shield / Aegis)
    [PIECE_TYPES.PAPER]: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- Thân khiên -->
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="currentColor" fill-opacity="0.25"/>
            <!-- Hoa văn gia cố chữ thập trên khiên -->
            <path d="M12 6v10"/>
            <path d="M8 10h8"/>
        </svg>`,

    // 3. KÉO -> SONG KIẾM BẮT CHÉO (Dual Crossed Blades)
    [PIECE_TYPES.SCISSORS]: `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <!-- Lưỡi kiếm 1 (từ góc trên-trái xuống dưới-phải) -->
            <path d="M19 5l-8.5 8.5"/>
            <path d="M20 4l-4 1 3 3 1-4z" fill="currentColor"/>
            <path d="M9 15l2 2"/>
            <circle cx="6.5" cy="18.5" r="1.5"/>

            <!-- Lưỡi kiếm 2 (từ góc trên-phải xuống dưới-trái) -->
            <path d="M5 5l8.5 8.5"/>
            <path d="M4 4l4 1-3 3-1-4z" fill="currentColor"/>
            <path d="M15 15l-2 2"/>
            <circle cx="17.5" cy="18.5" r="1.5"/>
        </svg>`
};

const game = new OTTGame();
let selectedCell = null;
let currentMoves = [];

const boardElement = document.getElementById('board');
const turnChip = document.getElementById('turn-chip');
const turnText = document.getElementById('turn-text');
const statusMessage = document.getElementById('status-message');
const resetBtn = document.getElementById('btn-reset');

function initBoardDOM() {
    boardElement.innerHTML = '';
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.r = r;
            cell.dataset.c = c;

            // Đánh dấu đường chéo chia đôi sân r = c
            if (r === c) cell.classList.add('diagonal-split');

            // Căn cứ đặc biệt
            if (r === 8 && c === 0) cell.classList.add('special-a1');
            if (r === 0 && c === 8) cell.classList.add('special-i9');

            cell.addEventListener('click', () => handleCellClick(r, c));
            boardElement.appendChild(cell);
        }
    }
}

function updateUI() {
    const cells = boardElement.children;

    // Đếm số lượng quân của mỗi bên để cập nhật live stats
    const stats = {
        [TEAMS.RED]: { [PIECE_TYPES.ROCK]: 0, [PIECE_TYPES.PAPER]: 0, [PIECE_TYPES.SCISSORS]: 0 },
        [TEAMS.BLUE]: { [PIECE_TYPES.ROCK]: 0, [PIECE_TYPES.PAPER]: 0, [PIECE_TYPES.SCISSORS]: 0 }
    };

    for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        const r = parseInt(cell.dataset.r);
        const c = parseInt(cell.dataset.c);

        cell.innerHTML = '';
        cell.classList.remove('selected', 'valid-move', 'valid-capture');

        if (selectedCell && selectedCell.r === r && selectedCell.c === c) {
            cell.classList.add('selected');
        }

        const validMove = currentMoves.find(m => m.r === r && m.c === c);
        if (validMove) {
            cell.classList.add(validMove.isCapture ? 'valid-capture' : 'valid-move');
        }

        const piece = game.board[r][c];
        if (piece) {
            stats[piece.team][piece.type]++;
            const pieceDiv = document.createElement('div');
            pieceDiv.className = `piece ${piece.team}`;
            pieceDiv.innerHTML = PIECE_SVGS[piece.type];
            cell.appendChild(pieceDiv);
        }
    }

    // Cập nhật bảng đếm số quân bên cột phải
    document.getElementById('cnt-blue-rock').textContent = stats[TEAMS.BLUE][PIECE_TYPES.ROCK];
    document.getElementById('cnt-blue-paper').textContent = stats[TEAMS.BLUE][PIECE_TYPES.PAPER];
    document.getElementById('cnt-blue-scissors').textContent = stats[TEAMS.BLUE][PIECE_TYPES.SCISSORS];

    document.getElementById('cnt-red-rock').textContent = stats[TEAMS.RED][PIECE_TYPES.ROCK];
    document.getElementById('cnt-red-paper').textContent = stats[TEAMS.RED][PIECE_TYPES.PAPER];
    document.getElementById('cnt-red-scissors').textContent = stats[TEAMS.RED][PIECE_TYPES.SCISSORS];

    // Cập nhật lượt chơi và thông báo
    if (game.isGameOver) {
        turnChip.className = `turn-chip turn-${game.winner}`;
        turnText.textContent = `CHIẾN THẮNG: PHE ${game.winner.toUpperCase()}!`;
        statusMessage.textContent = game.winReason;
    } else {
        turnChip.className = `turn-chip turn-${game.currentTurn}`;
        turnText.textContent = `LƯỢT: PHE ${game.currentTurn === TEAMS.RED ? 'ĐỎ' : 'XANH'}`;
        statusMessage.textContent = selectedCell ? 'Chọn ô có chấm xanh/đỏ để di chuyển' : 'Chọn một quân cờ để bắt đầu';
    }
}

function handleCellClick(r, c) {
    if (game.isGameOver) return;

    if (selectedCell) {
        const move = currentMoves.find(m => m.r === r && m.c === c);
        if (move) {
            const success = game.makeMove(selectedCell.r, selectedCell.c, r, c);
            if (success && window.onLocalMoveMade) {
                window.onLocalMoveMade({ from: selectedCell, to: { r, c } });
            }
            selectedCell = null;
            currentMoves = [];
            updateUI();
            return;
        }
    }

    const piece = game.board[r][c];
    if (piece && piece.team === game.currentTurn) {
        selectedCell = { r, c };
        currentMoves = game.getValidMoves(r, c);
    } else {
        selectedCell = null;
        currentMoves = [];
    }
    updateUI();
}

window.applyRemoteMove = function(fromR, fromC, toR, toC) {
    game.makeMove(fromR, fromC, toR, toC);
    selectedCell = null;
    currentMoves = [];
    updateUI();
};

resetBtn.addEventListener('click', () => {
    game.resetGame();
    selectedCell = null;
    currentMoves = [];
    updateUI();
});

initBoardDOM();
updateUI();