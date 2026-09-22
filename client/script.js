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

function canBeat(t1, t2) {
  return (t1 === 'R' && t2 === 'S') || (t1 === 'S' && t2 === 'P') || (t1 === 'P' && t2 === 'R');
}

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

  for (let y = 8; y >= 0; y--) { // Y=8 is top row (Row 9)
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
      
      // Target goals:
      // a1 (x=0, y=0) is target for Phe Do (red)
      // i9 (x=8, y=8) is target for Phe Xanh (blue)
      if (x === 0 && y === 0) {
        cell.dataset.goal = 'red';
        cell.title = 'Mục tiêu căn cứ của Phe Đỏ (a1)';
      }
      if (x === 8 && y === 8) {
        cell.dataset.goal = 'blue';
        cell.title = 'Mục tiêu căn cứ của Phe Xanh (i9)';
      }
      
      cell.addEventListener('click', () => handleCellClick(x, y));
      boardEl.appendChild(cell);
    }
  }
}

function updateForcesCount(pieces) {
  const counts = { p1: { R: 0, P: 0, S: 0 }, p2: { R: 0, P: 0, S: 0 } };
  Object.values(pieces).forEach(p => {
    if (counts[p.owner] && counts[p.owner][p.type] !== undefined) {
      counts[p.owner][p.type]++;
    }
  });
  
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
    c.classList.remove('valid-move', 'valid-capture');
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
      let occ = null;
      for (const op of Object.values(currentPieces)) {
        if (op.x === nx && op.y === ny) {
          occ = op;
          break;
        }
      }
      
      const cell = document.querySelector(`.cell[data-x="${nx}"][data-y="${ny}"]`);
      if (!cell) continue;

      if (!occ) {
        cell.classList.add('valid-move');
      } else if (occ.owner !== piece.owner && occ.type !== piece.type && canBeat(piece.type, occ.type)) {
        cell.classList.add('valid-capture');
      }
    }
  }
}

function handleCellClick(x, y) {
  let activeRole = (isLocal || isBotMode) ? currentTurn : myRole;
  if (isBotMode && activeRole === 'p2') return; // Bot's turn
  if (currentTurn !== activeRole) return; // Not your turn
  
  let clickedPiece = null;
  for (const p of Object.values(currentPieces)) {
    if (p.x === x && p.y === y) {
      clickedPiece = p;
      break;
    }
  }
  
  // Click own piece to select
  if (clickedPiece && clickedPiece.owner === activeRole) {
    selectedPieceId = clickedPiece.id;
    renderPieces(currentPieces);
    return;
  }
  
  // If piece selected, try to move
  if (selectedPieceId) {
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
  countdownOverlay.classList.add('hidden');
  gameRoom.classList.add('hidden');
  homepage.classList.remove('hidden');
  btnRandomMatch.disabled = false;
  btnRandomMatch.innerText = '🎲 GHÉP NGẪU NHIÊN';
  currentRoom = null;
  myRole = null;
  isLocal = false;
  isBotMode = false;
  selectedPieceId = null;
  if (timerDisplay) {
    timerDisplay.innerText = '(30s)';
    timerDisplay.classList.remove('timer-warning');
  }
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

// Room waiting for player 2 in random match
socket.on('ROOM_WAITING', ({ roomId, role, roleText }) => {
  myRole = role || 'p1';
  isLocal = false;
  isBotMode = false;
  setupGameRoom(roomId, roleText || 'Bạn là Phe Xanh (P1) - Đang chờ đối thủ...');
  turnDisplay.innerText = 'ĐANG ĐỢI...';
  turnDisplay.style.color = '#94a3b8';
});

// Match started (both players assigned explicitly)
socket.on('MATCH_STARTED', ({ roomId, role, roleText, isLocal: _isLocal, isBot: _isBot }) => {
  myRole = role;
  isLocal = _isLocal || false;
  isBotMode = _isBot || false;
  setupGameRoom(roomId, roleText);
});

socket.on('COUNTDOWN', (count) => {
  gameOverOverlay.classList.add('hidden');
  countdownOverlay.classList.remove('hidden');
  countdownText.innerText = count > 0 ? count : 'CHIẾN!';
});

function updateTurnDisplay(turn) {
  const isP1 = (turn === 'p1');
  const teamName = isP1 ? 'PHE XANH' : 'PHE ĐỎ';
  const teamColor = isP1 ? 'var(--team-blue)' : 'var(--team-red)';
  
  turnDot.style.backgroundColor = teamColor;
  turnDot.style.boxShadow = `0 0 10px ${teamColor}`;
  
  let extraLabel = '';
  if (!isLocal) {
    if (isBotMode) {
      extraLabel = isP1 ? ' (Bạn)' : ' (Máy)';
    } else {
      extraLabel = (turn === myRole) ? ' (Bạn)' : ' (Đối thủ)';
    }
  }
  
  turnDisplay.innerText = `${teamName}${extraLabel}`;
  turnDisplay.style.color = teamColor;
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

socket.on('TIMER_TICK', ({ timeLeft }) => {
  if (timerDisplay) {
    timerDisplay.innerText = `(${timeLeft}s)`;
    if (timeLeft <= 5) {
      timerDisplay.classList.add('timer-warning');
    } else {
      timerDisplay.classList.remove('timer-warning');
    }
  }
});

socket.on('GAME_OVER', ({ winner, reason }) => {
  gameOverOverlay.classList.remove('hidden');
  if (timerDisplay) {
    timerDisplay.innerText = '(Kết thúc)';
    timerDisplay.classList.remove('timer-warning');
  }
  
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
