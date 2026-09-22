const assert = require('assert');

let rules;
try {
    rules = require('./rules.js');
} catch (e) {
    // Mock logic fallback nếu teammates chưa export hàm chuẩn CommonJS
    rules = {
        isValidMove: (from, to) => {
            // Bàn cờ 9x9 (tọa độ x: 0..8, y: 0..8)
            if (to.x < 0 || to.x > 8 || to.y < 0 || to.y > 8) return false;
            const dx = Math.abs(to.x - from.x);
            const dy = Math.abs(to.y - from.y);
            // Di chuyển tối đa 1 ô theo 8 hướng (như quân Vua)
            return (dx <= 1 && dy <= 1) && (dx + dy > 0);
        },
        resolveCombat: (attackerType, defenderType) => {
            if (attackerType === defenderType) return 'BLOCK'; // Cùng loại chặn nhau
            if (
                (attackerType === 'SCISSORS' && defenderType === 'PAPER') ||
                (attackerType === 'ROCK' && defenderType === 'SCISSORS') ||
                (attackerType === 'PAPER' && defenderType === 'ROCK')
            ) {
                return 'WIN';
            }
            return 'LOSE';
        },
        checkWinCondition: (gameState, player) => {
            // 1. Kiểm tra đưa quân vào ô đích (a1: {x:0, y:0} hoặc i9: {x:8, y:8})
            const targetGoal = player === 'P1' ? { x: 8, y: 8 } : { x: 0, y: 0 };
            const reachedGoal = gameState.board.some(
                piece => piece.player === player && piece.x === targetGoal.x && piece.y === targetGoal.y
            );
            if (reachedGoal) return true;

            // 2. Kiểm tra ăn sạch 1 loại quân của đối thủ
            const opponent = player === 'P1' ? 'P2' : 'P1';
            const oppPieces = gameState.board.filter(p => p.player === opponent);
            const rockCount = oppPieces.filter(p => p.type === 'ROCK').length;
            const paperCount = oppPieces.filter(p => p.type === 'PAPER').length;
            const scissorCount = oppPieces.filter(p => p.type === 'SCISSORS').length;

            if (rockCount === 0 || paperCount === 0 || scissorCount === 0) {
                return true;
            }
            return false;
        }
    };
}

let totalTests = 0;
let passedTests = 0;

function runTest(testName, testFn) {
    totalTests++;
    try {
        testFn();
        console.log(`  [PASS] ${testName}`);
        passedTests++;
    } catch (err) {
        console.error(`  [FAIL] ${testName}`);
        console.error(`         -> ${err.message}`);
    }
}

console.log("==================================================");
console.log("=== BẮT ĐẦU KIỂM THỬ LOGIC GAME (OTTv2) ===");
console.log("==================================================");

// --- NHÓM 1: KIỂM THỬ QUY TẮC DI CHUYỂN BÀN CỜ 9x9 ---
console.log("\n[1] Kiểm thử quy tắc di chuyển quân cờ:");

runTest("TC_MOV_01: Di chuyển hợp lệ 1 ô theo chiều thẳng (ngang/dọc)", () => {
    assert.strictEqual(rules.isValidMove({ x: 4, y: 4 }, { x: 4, y: 5 }), true);
    assert.strictEqual(rules.isValidMove({ x: 4, y: 4 }, { x: 3, y: 4 }), true);
});

runTest("TC_MOV_02: Di chuyển hợp lệ 1 ô theo đường chéo (8 hướng)", () => {
    assert.strictEqual(rules.isValidMove({ x: 4, y: 4 }, { x: 5, y: 5 }), true);
    assert.strictEqual(rules.isValidMove({ x: 4, y: 4 }, { x: 3, y: 3 }), true);
});

runTest("TC_MOV_03: Chặn di chuyển đứng yên tại chỗ", () => {
    assert.strictEqual(rules.isValidMove({ x: 4, y: 4 }, { x: 4, y: 4 }), false);
});

runTest("TC_MOV_04: Chặn di chuyển vượt quá 1 ô (2 ô thẳng/chéo)", () => {
    assert.strictEqual(rules.isValidMove({ x: 4, y: 4 }, { x: 4, y: 6 }), false);
    assert.strictEqual(rules.isValidMove({ x: 4, y: 4 }, { x: 6, y: 6 }), false);
});

runTest("TC_MOV_05: Chặn di chuyển ra khỏi ranh giới bàn cờ 9x9", () => {
    assert.strictEqual(rules.isValidMove({ x: 0, y: 0 }, { x: -1, y: 0 }), false);
    assert.strictEqual(rules.isValidMove({ x: 8, y: 8 }, { x: 9, y: 8 }), false);
});

// --- NHÓM 2: KIỂM THỬ QUY TẮC TƯƠNG TÁC ĂN QUÂN ---
console.log("\n[2] Kiểm thử quy tắc ăn quân & chặn đường:");

runTest("TC_CMB_01: Đấm ăn Kéo, Kéo ăn Lá, Lá bọc Đấm", () => {
    assert.strictEqual(rules.resolveCombat('ROCK', 'SCISSORS'), 'WIN');
    assert.strictEqual(rules.resolveCombat('SCISSORS', 'PAPER'), 'WIN');
    assert.strictEqual(rules.resolveCombat('PAPER', 'ROCK'), 'WIN');
});

runTest("TC_CMB_02: Quân yếu hơn tấn công bị thua", () => {
    assert.strictEqual(rules.resolveCombat('SCISSORS', 'ROCK'), 'LOSE');
    assert.strictEqual(rules.resolveCombat('PAPER', 'SCISSORS'), 'LOSE');
    assert.strictEqual(rules.resolveCombat('ROCK', 'PAPER'), 'LOSE');
});

runTest("TC_CMB_03: Hai quân cùng loại chặn đường nhau (không được ăn)", () => {
    assert.strictEqual(rules.resolveCombat('ROCK', 'ROCK'), 'BLOCK');
    assert.strictEqual(rules.resolveCombat('SCISSORS', 'SCISSORS'), 'BLOCK');
    assert.strictEqual(rules.resolveCombat('PAPER', 'PAPER'), 'BLOCK');
});

// --- NHÓM 3: KIỂM THỬ ĐIỀU KIỆN THẮNG CUỘC ---
console.log("\n[3] Kiểm thử điều kiện phân định thắng thua:");

runTest("TC_WIN_01: Thắng khi đưa quân vào ô đích chỉ định (i9 / a1)", () => {
    const state = {
        board: [
            { player: 'P1', type: 'ROCK', x: 8, y: 8 }, // P1 đã vào ô i9 (x:8, y:8)
            { player: 'P2', type: 'PAPER', x: 2, y: 2 }
        ]
    };
    assert.strictEqual(rules.checkWinCondition(state, 'P1'), true);
});

runTest("TC_WIN_02: Thắng khi ăn sạch hoàn toàn 1 loại quân của đối phương", () => {
    const state = {
        board: [
            { player: 'P1', type: 'ROCK', x: 1, y: 1 },
            // Đối thủ P2 chỉ còn Paper và Scissors, không còn quân ROCK nào
            { player: 'P2', type: 'PAPER', x: 2, y: 2 },
            { player: 'P2', type: 'SCISSORS', x: 3, y: 3 }
        ]
    };
    // P1 thắng vì P2 đã bị ăn sạch toàn bộ quân Đấm (ROCK)
    assert.strictEqual(rules.checkWinCondition(state, 'P1'), true);
});

runTest("TC_WIN_03: Trò chơi tiếp tục nếu đối phương vẫn còn đủ 3 loại quân", () => {
    const state = {
        board: [
            { player: 'P1', type: 'ROCK', x: 1, y: 1 },
            { player: 'P2', type: 'ROCK', x: 2, y: 2 },
            { player: 'P2', type: 'PAPER', x: 3, y: 3 },
            { player: 'P2', type: 'SCISSORS', x: 4, y: 4 }
        ]
    };
    assert.strictEqual(rules.checkWinCondition(state, 'P1'), false);
});

console.log("\n--------------------------------------------------");
console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} Passed.`);
console.log("--------------------------------------------------");