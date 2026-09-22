/**
 * OTTv2 Rules & Board State Engine
 * Tọa độ bàn cờ:
 * a1 = [row: 8, col: 0] (Góc dưới cùng bên trái)
 * i9 = [row: 0, col: 8] (Góc trên cùng bên phải)
 */

export const PIECE_TYPES = {
    ROCK: 'rock',       // Búa / Chùy 🔨
    PAPER: 'paper',     // Bao / Khiên 🛡️
    SCISSORS: 'scissors'// Kéo / Kiếm ⚔️
};

export const TEAMS = {
    RED: 'red',
    BLUE: 'blue'
};

export class OTTGame {
    constructor() {
        this.boardSize = 9;
        this.resetGame();
    }

    resetGame() {
        this.board = Array(this.boardSize).fill(null).map(() => Array(this.boardSize).fill(null));
        this.currentTurn = TEAMS.RED;
        this.isGameOver = false;
        this.winner = null;
        this.winReason = null;
        this.initPieces();
    }

    initPieces() {
        // Cắt chéo bàn cờ: Đường phân cách r = c
        // Đội Xanh ở nửa trên - phải (c > r), bảo vệ căn cứ i9 [0, 8]
        // Đội Đỏ ở nửa dưới - trái (r > c), bảo vệ căn cứ a1 [8, 0]
        // Bố trí 3 hàng chéo cách quãng, tạo vùng đệm ở giữa tránh va chạm ngay lượt đầu

        // 1. PHE XANH (Nửa trên - phải: c - r >= 2)
        const blueCoords = [
            // Tuyến trước (c - r = 2)
            { r: 2, c: 4, type: PIECE_TYPES.ROCK },
            { r: 3, c: 5, type: PIECE_TYPES.PAPER },
            { r: 4, c: 6, type: PIECE_TYPES.SCISSORS },

            // Tuyến giữa (c - r = 3)
            { r: 1, c: 4, type: PIECE_TYPES.PAPER },
            { r: 2, c: 5, type: PIECE_TYPES.SCISSORS },
            { r: 3, c: 6, type: PIECE_TYPES.ROCK },

            // Tuyến hậu (c - r = 4, bảo vệ i9)
            { r: 1, c: 5, type: PIECE_TYPES.SCISSORS },
            { r: 2, c: 6, type: PIECE_TYPES.ROCK },
            { r: 3, c: 7, type: PIECE_TYPES.PAPER }
        ];

        // 2. PHE ĐỎ (Nửa dưới - trái: r - c >= 2)
        const redCoords = [
            // Tuyến trước (r - c = 2)
            { r: 4, c: 2, type: PIECE_TYPES.ROCK },
            { r: 5, c: 3, type: PIECE_TYPES.PAPER },
            { r: 6, c: 4, type: PIECE_TYPES.SCISSORS },

            // Tuyến giữa (r - c = 3)
            { r: 4, c: 1, type: PIECE_TYPES.PAPER },
            { r: 5, c: 2, type: PIECE_TYPES.SCISSORS },
            { r: 6, c: 3, type: PIECE_TYPES.ROCK },

            // Tuyến hậu (r - c = 4, bảo vệ a1)
            { r: 5, c: 1, type: PIECE_TYPES.SCISSORS },
            { r: 6, c: 2, type: PIECE_TYPES.ROCK },
            { r: 7, c: 3, type: PIECE_TYPES.PAPER }
        ];

        redCoords.forEach(p => {
            this.board[p.r][p.c] = { team: TEAMS.RED, type: p.type };
        });

        blueCoords.forEach(p => {
            this.board[p.r][p.c] = { team: TEAMS.BLUE, type: p.type };
        });
    }

    canBeat(attackerType, defenderType) {
        if (attackerType === defenderType) return false; // Cùng loại chặn đường
        return (
            (attackerType === PIECE_TYPES.SCISSORS && defenderType === PIECE_TYPES.PAPER) ||
            (attackerType === PIECE_TYPES.PAPER && defenderType === PIECE_TYPES.ROCK) ||
            (attackerType === PIECE_TYPES.ROCK && defenderType === PIECE_TYPES.SCISSORS)
        );
    }

    // Đi 1 ô theo 8 hướng như quân vua cờ vua
    getValidMoves(r, c) {
        if (this.isGameOver) return [];
        const piece = this.board[r][c];
        if (!piece || piece.team !== this.currentTurn) return [];

        const moves = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];

        for (const [dr, dc] of directions) {
            const nr = r + dr;
            const nc = c + dc;

            if (nr >= 0 && nr < this.boardSize && nc >= 0 && nc < this.boardSize) {
                const target = this.board[nr][nc];
                if (!target) {
                    // Ô trống
                    moves.push({ r: nr, c: nc, isCapture: false });
                } else if (target.team !== piece.team && this.canBeat(piece.type, target.type)) {
                    // Ô quân địch mà quân mình ăn được
                    moves.push({ r: nr, c: nc, isCapture: true });
                }
            }
        }
        return moves;
    }

    makeMove(fromR, fromC, toR, toC) {
        const moves = this.getValidMoves(fromR, fromC);
        const valid = moves.find(m => m.r === toR && m.c === toC);
        if (!valid) return false;

        const piece = this.board[fromR][fromC];
        this.board[toR][toC] = piece;
        this.board[fromR][fromC] = null;

        // 1. Kiểm tra thắng cuộc khi chiếm căn cứ đối phương
        if (piece.team === TEAMS.RED && toR === 0 && toC === 8) {
            this.setWin(TEAMS.RED, "Đỏ đã đưa quân chiếm căn cứ i9 của đối phương!");
            return true;
        }
        if (piece.team === TEAMS.BLUE && toR === 8 && toC === 0) {
            this.setWin(TEAMS.BLUE, "Xanh đã đưa quân chiếm căn cứ a1 của đối phương!");
            return true;
        }

        // 2. Kiểm tra điều kiện thắng do ăn sạch 1 loại quân của đối thủ
        const opponentTeam = piece.team === TEAMS.RED ? TEAMS.BLUE : TEAMS.RED;
        if (this.checkExtinctionWin(opponentTeam)) {
            this.setWin(piece.team, `Đã tiêu diệt sạch hoàn toàn 1 loại quân của đối phương!`);
            return true;
        }

        // Chuyển lượt
        this.currentTurn = opponentTeam;
        return true;
    }

    checkExtinctionWin(opponentTeam) {
        const counts = { [PIECE_TYPES.ROCK]: 0, [PIECE_TYPES.PAPER]: 0, [PIECE_TYPES.SCISSORS]: 0 };
        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                const cell = this.board[r][c];
                if (cell && cell.team === opponentTeam) {
                    counts[cell.type]++;
                }
            }
        }
        return counts[PIECE_TYPES.ROCK] === 0 || counts[PIECE_TYPES.PAPER] === 0 || counts[PIECE_TYPES.SCISSORS] === 0;
    }

    setWin(team, reason) {
        this.isGameOver = true;
        this.winner = team;
        this.winReason = reason;
    }
}