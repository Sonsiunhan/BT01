const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '../client')));

const rooms = {};

// RPS Logic: returns true if p1Type beats p2Type
function winsAgainst(t1, t2) {
  if (t1 === 'R' && t2 === 'S') return true;
  if (t1 === 'S' && t2 === 'P') return true;
  if (t1 === 'P' && t2 === 'R') return true;
  return false;
}

function initBoard() {
  const pieces = {};
  const pattern = ['R', 'P', 'S', 'R', 'P', 'S', 'R', 'P', 'S'];
  
  let idCounter = 1;
  // P1 pieces (row 0 - Blue / Phe Xanh, bottom row)
  for (let x = 0; x <= 8; x++) {
    pieces[`p${idCounter++}`] = { id: `p${idCounter-1}`, owner: 'p1', type: pattern[x], x, y: 0 };
  }
  // P2 pieces (row 8 - Red / Phe Do, top row)
  for (let x = 0; x <= 8; x++) {
    pieces[`p${idCounter++}`] = { id: `p${idCounter-1}`, owner: 'p2', type: pattern[x], x, y: 8 };
  }
  return pieces;
}

function checkWin(roomId) {
  const room = rooms[roomId];
  if (!room || !room.pieces) return null;
  const pieces = Object.values(room.pieces);
  
  // Check corner win
  // Phe Xanh (p1) reaches i9 (x=8, y=8)
  // Phe Do (p2) reaches a1 (x=0, y=0)
  for (const p of pieces) {
    if (p.owner === 'p1' && p.x === 8 && p.y === 8) return 'p1';
    if (p.owner === 'p2' && p.x === 0 && p.y === 0) return 'p2';
  }
  
  // Check extinction win
  const counts = {
    p1: { R: 0, P: 0, S: 0 },
    p2: { R: 0, P: 0, S: 0 }
  };
  for (const p of pieces) {
    counts[p.owner][p.type]++;
  }
  
  if (counts.p1.R === 0 || counts.p1.P === 0 || counts.p1.S === 0) return 'p2';
  if (counts.p2.R === 0 || counts.p2.P === 0 || counts.p2.S === 0) return 'p1';
  
  return null;
}

function getWaitingRooms() {
  const waiting = [];
  for (const [id, r] of Object.entries(rooms)) {
    if (r.status === 'waiting') waiting.push(id);
  }
  return waiting;
}

function stopTurnTimer(roomId) {
  const room = rooms[roomId];
  if (room && room.turnTimer) {
    clearInterval(room.turnTimer);
    room.turnTimer = null;
  }
}

function resetTurnTimer(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing') return;
  stopTurnTimer(roomId);

  room.timeLeft = 30;
  io.to(roomId).emit('TIMER_TICK', { timeLeft: room.timeLeft });

  room.turnTimer = setInterval(() => {
    if (!rooms[roomId] || rooms[roomId].status !== 'playing') {
      stopTurnTimer(roomId);
      return;
    }
    room.timeLeft--;
    io.to(roomId).emit('TIMER_TICK', { timeLeft: room.timeLeft });

    if (room.timeLeft <= 0) {
      // Switch turn automatically on timeout
      room.turn = room.turn === 'p1' ? 'p2' : 'p1';
      io.to(roomId).emit('STATE_UPDATE', { pieces: room.pieces, turn: room.turn });
      resetTurnTimer(roomId);

      if (room.isBot && room.turn === 'p2') {
        setTimeout(() => makeBotMove(roomId), 800);
      }
    }
  }, 1000);
}

function makeBotMove(roomId) {
  const room = rooms[roomId];
  if (!room || room.status !== 'playing' || room.turn !== 'p2' || !room.isBot) return;

  const botPieces = Object.values(room.pieces).filter(p => p.owner === 'p2');
  if (botPieces.length === 0) return;

  const dirs = [[0,1],[1,1],[1,0],[1,-1],[0,-1],[-1,-1],[-1,0],[-1,1]];
  
  // Collect all valid moves
  const validMoves = [];
  for (const p of botPieces) {
    for (const [dx, dy] of dirs) {
      const tx = p.x + dx;
      const ty = p.y + dy;
      if (tx < 0 || tx > 8 || ty < 0 || ty > 8) continue;
      
      let targetPiece = null;
      for (const op of Object.values(room.pieces)) {
        if (op.x === tx && op.y === ty) {
          targetPiece = op;
          break;
        }
      }
      
      if (!targetPiece) {
        // Prioritize moving towards target (0,0)
        const dist = Math.hypot(tx, ty);
        validMoves.push({ piece: p, tx, ty, weight: 10 - dist });
      } else if (targetPiece.owner === 'p1' && winsAgainst(p.type, targetPiece.type)) {
        validMoves.push({ piece: p, tx, ty, capture: targetPiece.id, weight: 25 });
      }
    }
  }

  if (validMoves.length > 0) {
    // Sort by weight descending, pick among top moves
    validMoves.sort((a, b) => b.weight - a.weight);
    const topChoices = validMoves.slice(0, Math.min(3, validMoves.length));
    const move = topChoices[Math.floor(Math.random() * topChoices.length)];
    
    move.piece.x = move.tx;
    move.piece.y = move.ty;
    if (move.capture) delete room.pieces[move.capture];
  }

  const winner = checkWin(roomId);
  if (winner) {
    room.status = 'ended';
    stopTurnTimer(roomId);
    io.to(roomId).emit('STATE_UPDATE', { pieces: room.pieces, turn: room.turn });
    io.to(roomId).emit('GAME_OVER', { winner });
  } else {
    room.turn = 'p1';
    io.to(roomId).emit('STATE_UPDATE', { pieces: room.pieces, turn: room.turn });
    resetTurnTimer(roomId);
  }
}

function startRoomCountdown(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  stopTurnTimer(roomId);
  room.status = 'countdown';
  let count = 5;
  const interval = setInterval(() => {
    io.to(roomId).emit('COUNTDOWN', count);
    count--;
    if (count < 0) {
      clearInterval(interval);
      if (rooms[roomId]) {
        room.status = 'playing';
        room.pieces = initBoard();
        room.turn = 'p1';
        io.to(roomId).emit('GAME_START', { pieces: room.pieces, turn: room.turn });
        resetTurnTimer(roomId);
      }
    }
  }, 1000);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.emit('ROOMS_LIST', getWaitingRooms());

  socket.on('JOIN_RANDOM', () => {
    let joinedRoom = null;
    for (const [id, r] of Object.entries(rooms)) {
      if (r.status === 'waiting' && r.p1 !== socket.id) {
        joinedRoom = id;
        break;
      }
    }
    
    if (joinedRoom) {
      const room = rooms[joinedRoom];
      room.p2 = socket.id;
      room.status = 'countdown';
      socket.join(joinedRoom);
      
      // Send role explicitly to both players so they never conflict
      io.to(room.p1).emit('MATCH_STARTED', { 
        roomId: joinedRoom, 
        role: 'p1', 
        roleText: 'Bạn là Phe Xanh (P1)',
        isLocal: false,
        isBot: false
      });
      socket.emit('MATCH_STARTED', { 
        roomId: joinedRoom, 
        role: 'p2', 
        roleText: 'Bạn là Phe Đỏ (P2)',
        isLocal: false,
        isBot: false
      });
      
      io.emit('ROOMS_LIST', getWaitingRooms());
      startRoomCountdown(joinedRoom);
      
    } else {
      const newRoomId = 'room_' + Math.floor(Math.random() * 10000);
      rooms[newRoomId] = { id: newRoomId, p1: socket.id, p2: null, status: 'waiting' };
      socket.join(newRoomId);
      socket.emit('ROOM_WAITING', { 
        roomId: newRoomId,
        role: 'p1',
        roleText: 'Bạn là Phe Xanh (P1) - Đang chờ đối thủ...'
      });
      io.emit('ROOMS_LIST', getWaitingRooms());
    }
  });

  socket.on('CREATE_BOT_ROOM', () => {
    const newRoomId = 'bot_' + Math.floor(Math.random() * 10000);
    rooms[newRoomId] = { id: newRoomId, p1: socket.id, p2: 'bot', status: 'countdown', isBot: true };
    socket.join(newRoomId);
    socket.emit('MATCH_STARTED', { 
      roomId: newRoomId, 
      role: 'p1', 
      roleText: 'Bạn vs Máy (Bot)',
      isBot: true,
      isLocal: false
    });
    startRoomCountdown(newRoomId);
  });

  socket.on('CREATE_LOCAL_ROOM', () => {
    const newRoomId = 'local_' + Math.floor(Math.random() * 10000);
    rooms[newRoomId] = { id: newRoomId, p1: socket.id, p2: socket.id, status: 'countdown', isLocal: true };
    socket.join(newRoomId);
    socket.emit('MATCH_STARTED', { 
      roomId: newRoomId, 
      role: 'p1', 
      roleText: 'Chơi 2 Người (Local)',
      isLocal: true,
      isBot: false
    });
    startRoomCountdown(newRoomId);
  });

  socket.on('RESTART_ROOM', (roomId) => {
    const room = rooms[roomId];
    if (room && (room.isBot || room.isLocal)) {
      startRoomCountdown(roomId);
    }
  });

  socket.on('LEAVE_ROOM', (roomId) => {
    if (rooms[roomId]) {
      stopTurnTimer(roomId);
      socket.leave(roomId);
      rooms[roomId].status = 'ended';
      io.to(roomId).emit('GAME_OVER', { winner: rooms[roomId].p1 === socket.id ? 'p2' : 'p1', reason: 'disconnect' });
      delete rooms[roomId];
      io.emit('ROOMS_LIST', getWaitingRooms());
    }
  });
  
  socket.on('PIECE_MOVE', ({ roomId, pieceId, tx, ty }) => {
    const room = rooms[roomId];
    if (!room || room.status !== 'playing') return;
    
    let role = null;
    if (room.isLocal) {
      role = room.turn;
    } else {
      role = room.p1 === socket.id ? 'p1' : (room.p2 === socket.id ? 'p2' : null);
    }
    
    if (!role || room.turn !== role) return; // Not your turn
    
    const piece = room.pieces[pieceId];
    if (!piece || piece.owner !== role) return; // Invalid piece
    
    const dx = Math.abs(tx - piece.x);
    const dy = Math.abs(ty - piece.y);
    if (Math.max(dx, dy) !== 1) return; // Must move exactly 1 step
    if (tx < 0 || tx > 8 || ty < 0 || ty > 8) return; // Out of bounds
    
    // Check target cell
    let targetPiece = null;
    for (const p of Object.values(room.pieces)) {
      if (p.x === tx && p.y === ty) {
        targetPiece = p;
        break;
      }
    }
    
    if (targetPiece) {
      if (targetPiece.owner === role) return; // Friendly block
      if (targetPiece.type === piece.type) return; // Same type block
      if (winsAgainst(piece.type, targetPiece.type)) {
        delete room.pieces[targetPiece.id]; // Capture
      } else {
        return; // Attempting losing matchup
      }
    }
    
    // Move is valid
    piece.x = tx;
    piece.y = ty;
    
    const winner = checkWin(roomId);
    if (winner) {
      room.status = 'ended';
      stopTurnTimer(roomId);
      io.to(roomId).emit('STATE_UPDATE', { pieces: room.pieces, turn: room.turn });
      io.to(roomId).emit('GAME_OVER', { winner });
    } else {
      room.turn = room.turn === 'p1' ? 'p2' : 'p1';
      io.to(roomId).emit('STATE_UPDATE', { pieces: room.pieces, turn: room.turn });
      resetTurnTimer(roomId);
      
      // Trigger Bot move if needed
      if (room.isBot && room.turn === 'p2') {
        setTimeout(() => makeBotMove(roomId), 1000);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    for (const [id, r] of Object.entries(rooms)) {
      if (r.p1 === socket.id || r.p2 === socket.id) {
        stopTurnTimer(id);
        r.status = 'ended';
        io.to(id).emit('GAME_OVER', { winner: r.p1 === socket.id ? 'p2' : 'p1', reason: 'disconnect' });
        delete rooms[id];
        io.emit('ROOMS_LIST', getWaitingRooms());
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
