const socket = io();

// DOM Elements
const homepage = document.getElementById('homepage');
const gameRoom = document.getElementById('game-room');
const btnRandomMatch = document.getElementById('btn-random-match');
const btnBotMatch = document.getElementById('btn-bot-match');
const btnLocalMatch = document.getElementById('btn-local-match');
const btnLeaveRoom = document.getElementById('btn-leave-room');
const btnRestartRoom = document.getElementById('btn-restart-room');
const waitingRoomsList = document.getElementById('waiting-rooms-list');
const matchHistoryList = document.getElementById('match-history-list');
const roomIdDisplay = document.getElementById('room-id-display');
const playerRoleDisplay = document.getElementById('player-role');
const turnDisplay = document.getElementById('turn-display');
const turnDot = document.getElementById('turn-dot');
const timerDisplay = document.getElementById('timer-display');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownText = document.getElementById('countdown-text');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverText = document.getElementById('game-over-text');
const btnBackHome = document.getElementById('btn-back-home');
const boardEl = document.getElementById('board');

// State
let currentRoom = null;
let myRole = null;
let isLocal = false;
let isBotMode = false;
let currentPieces = {};
let currentTurn = null;
let selectedPieceId = null;

// Emoji map
const emojiMap = { 'R': '✊', 'P': '✋', 'S': '✌️' };

// Initialize Board UI (10x10 Grid with Coordinates)
function initBoardUI() {
  boardEl.innerHTML = '';
  
  // Top-left empty cell
  boardEl.appendChild(document.createElement('div'));
  
  // Top coordinates (A-I)
  const cols = ['A','B','C','D','E','F','G','H','I'];
  for (let x = 0; x <= 8; x++) {
    const coord = document.createElement('div');
    coord.className = 'coord-cell';
    coord.innerText = cols[x];
    boardEl.appendChild(coord);
  }

  for (let y = 8; y >= 0; y--) { // Y=8 is top
    // Left coordinate (9-1)
    const rowCoord = document.createElement('div');
    rowCoord.className = 'coord-cell';
    rowCoord.innerText = y + 1;
    boardEl.appendChild(rowCoord);

    for (let x = 0; x <= 8; x++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      if ((x + y) % 2 === 0) cell.classList.add('light');
      else cell.classList.add('dark');
      cell.dataset.x = x;
      cell.dataset.y = y;
      
      // Goal cells
      if (x === 0 && y === 0) cell.dataset.goal = 'red'; // Red target (a1)
      if (x === 8 && y === 8) cell.dataset.goal = 'blue'; // Blue target (i9)
      
      cell.addEventListener('click', () => handleCellClick(x, y));
      boardEl.appendChild(cell);
    }
  }
}

function updateForcesCount(pieces) {
  const counts = { p1: { R: 0, P: 0, S: 0 }, p2: { R: 0, P: 0, S: 0 } };
  Object.values(pieces).forEach(p => counts[p.owner][p.type]++);
  
  // Blue (P1)
  document.getElementById('p1-rock').innerText = counts.p1.R;
  document.getElementById('p1-paper').innerText = counts.p1.P;
  document.getElementById('p1-scissors').innerText = counts.p1.S;

  // Red (P2)
  document.getElementById('p2-rock').innerText = counts.p2.R;
  document.getElementById('p2-paper').innerText = counts.p2.P;
  document.getElementById('p2-scissors').innerText = counts.p2.S;
}

function renderPieces(pieces) {
  document.querySelectorAll('.cell').forEach(c => {
    const p = c.querySelector('.piece');
    if (p) p.remove();
    c.classList.remove('valid-move');
  });
  
  for (const [id, p] of Object.entries(pieces)) {
    const cell = document.querySelector(`.cell[data-x="${p.x}"][data-y="${p.y}"]`);
    if (cell) {
      const el = document.createElement('div');
      el.className = `piece ${p.owner === 'p1' ? 'blue' : 'red'}`;
      if (id === selectedPieceId) el.classList.add('selected');
      el.innerText = emojiMap[p.type];
      el.dataset.id = id;
      cell.appendChild(el);
    }
  }
  
  if (selectedPieceId && pieces[selectedPieceId]) {
    showValidMoves(pieces[selectedPieceId]);
  }
}

function showValidMoves(piece) {
  const dirs = [[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
  for (const [dx, dy] of dirs) {
    const nx = piece.x + dx;
    const ny = piece.y + dy;
    if (nx >= 0 && nx <= 8 && ny >= 0 && ny <= 8) {
      const cell = document.querySelector(`.cell[data-x="${nx}"][data-y="${ny}"]`);
      if (cell) cell.classList.add('valid-move');
    }
  }
}

function handleCellClick(x, y) {
  let activeRole = (isLocal || isBotMode) ? currentTurn : myRole;
  if (isBotMode && activeRole === 'p2') return; // Cannot move bot pieces
  if (currentTurn !== activeRole) return;
  
  let clickedPiece = null;
  for (const p of Object.values(currentPieces)) {
    if (p.x === x && p.y === y) {
      clickedPiece = p;
      break;
    }
  }
  
  if (clickedPiece && clickedPiece.owner === activeRole) {
    selectedPieceId = clickedPiece.id;
    renderPieces(currentPieces);
  } else if (selectedPieceId) {
    const p = currentPieces[selectedPieceId];
    const dx = Math.abs(x - p.x);
    const dy = Math.abs(y - p.y);
    if (Math.max(dx, dy) === 1) {
      socket.emit('PIECE_MOVE', { roomId: currentRoom, pieceId: selectedPieceId, tx: x, ty: y });
      selectedPieceId = null;
    } else {
      selectedPieceId = null;
      renderPieces(currentPieces);
    }
  }
}

function updateHistory(result) {
  const li = document.createElement('li');
  li.innerText = `Phòng: ${currentRoom} - Kết quả: ${result}`;
  matchHistoryList.prepend(li);
}

// UI Setup
function setupGameRoom(roomId, roleText) {
  currentRoom = roomId;
  homepage.classList.add('hidden');
  gameRoom.classList.remove('hidden');
  roomIdDisplay.innerText = roomId;
  playerRoleDisplay.innerText = roleText;
  
  if (isLocal || isBotMode) {
    btnRestartRoom.classList.remove('hidden');
  } else {
    btnRestartRoom.classList.add('hidden');
  }
  
  initBoardUI();
}

function returnHome() {
  gameOverOverlay.classList.add('hidden');
  gameRoom.classList.add('hidden');
  homepage.classList.remove('hidden');
  btnRandomMatch.disabled = false;
  btnRandomMatch.innerText = '🎲 GHÉP NGẪU NHIÊN';
  currentRoom = null;
  myRole = null;
  isLocal = false;
  isBotMode = false;
}

// Socket Events
socket.on('ROOMS_LIST', (rooms) => {
  waitingRoomsList.innerHTML = '';
  if (rooms.length === 0) {
    waitingRoomsList.innerHTML = '<li><span style="color:#94a3b8">Không có phòng nào đang chờ.</span></li>';
  } else {
    rooms.forEach(id => {
      const li = document.createElement('li');
      li.innerText = `Phòng ${id} (1/2)`;
      waitingRoomsList.appendChild(li);
    });
  }
});

btnRandomMatch.addEventListener('click', () => {
  socket.emit('JOIN_RANDOM');
  btnRandomMatch.disabled = true;
  btnRandomMatch.innerText = 'Đang tìm phòng...';
});

btnBotMatch.addEventListener('click', () => {
  socket.emit('CREATE_BOT_ROOM');
});

btnLocalMatch.addEventListener('click', () => {
  socket.emit('CREATE_LOCAL_ROOM');
});

btnLeaveRoom.addEventListener('click', () => {
  if (currentRoom) socket.emit('LEAVE_ROOM', currentRoom);
  returnHome();
});

btnBackHome.addEventListener('click', () => {
  returnHome();
});

btnRestartRoom.addEventListener('click', () => {
  if (currentRoom) socket.emit('RESTART_ROOM', currentRoom);
});

socket.on('ROOM_CREATED', ({ roomId, isLocal: _isLocal, isBot: _isBot }) => {
  myRole = 'p1';
  isLocal = _isLocal || false;
  isBotMode = _isBot || false;
  let roleText = 'Bạn là Phe Xanh (P1)';
  if (isLocal) roleText = 'Local Mode (P1 & P2)';
  if (isBotMode) roleText = 'Bạn vs Máy';
  setupGameRoom(roomId, roleText);
});

socket.on('MATCH_FOUND', ({ roomId }) => {
  myRole = 'p2';
  isLocal = false;
  isBotMode = false;
  setupGameRoom(roomId, 'Bạn là Phe Đỏ (P2)');
});

socket.on('COUNTDOWN', (count) => {
  gameOverOverlay.classList.add('hidden');
  countdownOverlay.classList.remove('hidden');
  countdownText.innerText = count > 0 ? count : 'CHIẾN!';
});

function updateTurnDisplay(turn) {
  let activeRole = (isLocal || isBotMode) ? currentTurn : myRole;
  turnDot.style.backgroundColor = turn === 'p1' ? 'var(--team-blue)' : 'var(--team-red)';
  
  if (isLocal || isBotMode) {
    turnDisplay.innerText = turn === 'p1' ? 'PHE XANH' : 'PHE ĐỎ';
    turnDisplay.style.color = turn === 'p1' ? 'var(--team-blue)' : 'var(--team-red)';
  } else {
    turnDisplay.innerText = turn === myRole ? 'BẠN' : 'ĐỐI PHƯƠNG';
    turnDisplay.style.color = turn === myRole ? 'var(--team-blue)' : 'var(--team-red)';
  }
}

function applyState(pieces, turn) {
  currentPieces = pieces;
  currentTurn = turn;
  updateTurnDisplay(turn);
  renderPieces(pieces);
  updateForcesCount(pieces);
}

socket.on('GAME_START', ({ pieces, turn }) => {
  setTimeout(() => countdownOverlay.classList.add('hidden'), 1000);
  applyState(pieces, turn);
});

socket.on('STATE_UPDATE', ({ pieces, turn }) => {
  applyState(pieces, turn);
});

socket.on('GAME_OVER', ({ winner, reason }) => {
  gameOverOverlay.classList.remove('hidden');
  
  let winMsg = '';
  let winColor = '';
  
  if (isLocal) {
    winMsg = winner === 'p1' ? '🎉 PHE XANH THẮNG!' : '🎉 PHE ĐỎ THẮNG!';
    winColor = winner === 'p1' ? 'var(--team-blue)' : 'var(--team-red)';
    updateHistory(`Local - ${winner === 'p1' ? 'Xanh' : 'Đỏ'} Thắng`);
  } else {
    if (winner === myRole) {
      winMsg = '🎉 CHIẾN THẮNG!';
      winColor = 'var(--team-blue)';
      updateHistory('THẮNG');
    } else {
      winMsg = '💀 THẤT BẠI!';
      winColor = 'var(--team-red)';
      updateHistory('THUA');
    }
  }
  
  gameOverText.innerText = winMsg;
  gameOverText.style.color = winColor;
});
