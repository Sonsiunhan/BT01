# SRS.md — Software Requirements Specification
## Multiplayer Real-time Network Game: Oẳn Tù Tì v2 (OTTv2)

> **Document Status:** IMPLEMENTATION READY (≥95%)  
> **Version:** 1.0  
> **Course:** INT3304 — Lập trình mạng (Network Programming)  
> **Assignment:** Bài tập lớn — Bài số 2 (Multiplayer Client-Server OTTv2 với playfull.html / cơ chế playhtml.fun)  
> **Language:** Vietnamese  
> **Target Git Delivery:** Git Repository bao gồm Source Code, Docs, Tests, Benchmarks và Live Deploy URL.  

---

# 0. AI AGENT GUIDING — MANDATORY

## 0.1 Mục đích và Nguyên tắc
Tài liệu này là **Software Requirements Specification (SRS)** chính thức cho dự án **Bài 2: Game cờ Oẳn Tù Tì v2 (OTTv2) Real-time Multiplayer**.

Tài liệu được chuyển đổi từ khung baseline sau khi tiếp nhận đề bài chính thức từ giảng viên:
- **Đề bài Bài 2:** Xây dựng hệ thống nhiều người chơi cùng lúc trên môi trường Web, có server quản lý logic và trạng thái, áp dụng thư viện/cơ chế `playfull.html` (tương tự cơ chế đồng bộ realtime của `playhtml.fun`).
- **Luật chơi OTTv2:** Bàn cờ 9x9 (tọa độ a1 đến i9). Ba loại quân: Đấm (Rock), Lá/Bao (Paper), Kéo (Scissors).
- **Quy tắc di chuyển:** Mỗi quân di chuyển 1 ô theo 8 hướng (ngang, dọc, chéo) tương tự quân Vua trong cờ vua.
- **Quy tắc ăn quân:** Đấm ăn Kéo, Kéo ăn Lá, Lá ăn Đấm. Hai quân cùng loại không thể ăn nhau mà đứng chặn đường nhau. Quân cùng phe không ăn nhau và không thể đi vào ô đã có quân đồng minh.
- **Điều kiện thắng:** 
  1. Ăn hết sạch hoàn toàn 1 loại quân của đối phương (đối phương sạch Đấm, hoặc sạch Lá, hoặc sạch Kéo).
  2. Hoặc đưa bất kỳ một quân nào của mình vào ô đích chỉ định (`a1` hoặc `i9`).
- **Phân công nhóm:** Nhóm tối đa 4 sinh viên (1 SV làm bài 1, 3 SV làm bài 2). Tài liệu này đặc tả toàn diện cho **Bài 2 với 3 sinh viên phụ trách**.

## 0.2 Quy tắc bất biến (Baseline-Locked Rules)
- Server là Authoritative (Server nắm giữ canonical game state, Client gửi Intent/Command).
- Giao tiếp kết hợp HTTP (Control plane) và WebSocket (Realtime data plane).
- Định dạng gói tin Envelope thống nhất với Sequence Number và Timestamp.
- Cơ chế đồng bộ Hybrid: Full Snapshot khi kết nối/resync, Delta/Event trong quá trình chơi.
- Đảm bảo Room Isolation tuyệt đối (mỗi ván cờ 9x9 diễn ra độc lập trong 1 Room).
- Cơ chế phục hồi Reconnect với Grace Period và Resync an toàn.
- Kiểm thử tự động đa tầng: Unit, Integration, E2E, Network Degradation (Latency, Packet Loss, Disconnect) và Load/Benchmark (Full Snapshot vs Delta/Event).
- Nộp link Git, trong README có link Deploy đang hoạt động.

---

# 1. Project Overview

## 1.1 Tên dự án
**OTTv2 Multiplayer Real-time Board Game (Playfull.html Engine)**

## 1.2 Môn học
`INT3304 — Lập trình mạng (Network Programming)`

## 1.3 Cơ cấu nhóm Bài 2 (3 Sinh viên)
| Vai trò | Thành viên phụ trách | Trách nhiệm chính |
|---|---|---|
| **Person A** | Sinh viên 1 (Client / UX Lead) | Xây dựng Game Interface, bàn cờ 9x9, hiển thị quân cờ Đấm-Lá-Kéo, drag-and-drop / click-to-move 8 hướng, tích hợp cơ chế đồng bộ client playfull.html, animation ăn quân / chặn đường / thắng cuộc. |
| **Person B** | Sinh viên 2 (Network / Server Lead) | Xây dựng Server Node.js/TypeScript, WebSocket Gateway, Session/Room Manager, Authoritative OTTv2 Game Engine (luật 8 hướng, ăn quân RPS, chặn cùng loại, check thắng ô a1/i9 hoặc sạch 1 loại quân), Delta/Snapshot Sync, Reconnect/Resync. |
| **Person C** | Sinh viên 3 (QA / Performance Lead) | Xây dựng Test Suite (Unit test cờ, Integration, Concurrency), Network Degradation simulation (lag, rớt gói, mất kết nối), Load testing & Benchmark (Artillery/Autocannon), Deployment CI/CD và tài liệu bàn giao. |

## 1.4 Mục tiêu học thuật & Kỹ thuật
Dự án chứng minh năng lực toàn diện trong môn Lập trình mạng thông qua:
1. Thiết kế và cài đặt hệ thống Client-Server realtime cho board game đối kháng nhiều người chơi.
2. Áp dụng cơ chế chia sẻ phần tử tương tác thời gian thực theo phong cách `playhtml.fun` / thư viện `playfull.html`.
3. Quản lý trạng thái phân tán, phân định quyền tác tử (Server Authority), đồng bộ Snapshot + Delta.
4. Xử lý đồng thời (Concurrency), tranh chấp nước đi, ngắt kết nối và khôi phục ván đấu (Reconnect & Resync).
5. Thực hiện đo kiểm định lượng, benchmark hiệu năng băng thông/tần số truyền tin, stress test nhiều phòng chơi đồng thời.
6. Đóng gói và triển khai ứng dụng lên môi trường Production có URL công khai.

---

# 2. Scope

## 2.1 In Scope (Trong phạm vi)
- **Hệ thống phòng (Lobby & Room):** Tạo phòng, tham gia phòng theo mã phòng, Quick Play ghép cặp ngẫu nhiên, xem danh sách người chơi, trạng thái Ready.
- **Bàn cờ OTTv2 9x9:**
  - Lưới 9x9 ô tương ứng các cột `a` đến `i` và các hàng `1` đến `9`.
  - Hai người chơi: Player 1 (Quân Trắng/Đỏ) xuất phát tại hàng 1-2; Player 2 (Quân Đen/Xanh) xuất phát tại hàng 8-9.
  - Mỗi bên sở hữu 9 quân cờ gồm 3 Đấm (Rock), 3 Lá (Paper), 3 Kéo (Scissors).
  - Di chuyển 1 ô theo 8 hướng (N, NE, E, SE, S, SW, W, NW).
  - Ăn quân theo chu trình Búa-Kéo-Bao; chặn đường nếu gặp quân cùng loại hoặc quân đồng minh.
  - Kiểm tra điều kiện thắng tức thì: hết 1 loại quân hoặc đưa bất kỳ quân nào vào ô `a1` hoặc `i9`.
- **Cơ chế realtime playfull.html:**
  - Đồng bộ DOM elements / board state theo thời gian thực giữa các client qua Server WebSocket.
  - Khả năng nhiều phòng đấu diễn ra độc lập song song (Multi-room capacity).
- **Độ tin cậy mạng (Reliability):**
  - Đóng gói Envelope chuẩn, quản lý Sequence number, phát hiện mất gói/lệch thứ tự.
  - Disconnect detection, Grace period (mặc định 30 giây), khôi phục phiên Reconnect và gửi Snapshot/Delta bù.
- **Kiểm thử & Đánh giá hiệu năng:**
  - Kiểm thử chức năng, luật cờ, mô phỏng mạng suy hao (lag 100-300ms, rớt gói 5-10%).
  - Đo tải tải tối thiểu 50-100 kết nối đồng thời (25-50 phòng chơi active).
  - So sánh định lượng giữa truyền Full Snapshot và Delta/Event.
- **Triển khai:**
  - Docker Compose cho môi trường dev/chấm bài.
  - Deploy server & client lên hosting công khai (Render / Fly.io / Cloud Run / Vercel) có link trong README.

## 2.2 Out of Scope (Ngoài phạm vi)
- Đồ họa 3D phức tạp, âm thanh voice chat thời gian thực.
- Hệ thống thanh toán, mua bán vật phẩm, bảng xếp hạng toàn cầu ELO phức tạp có database phân tán.
- Ứng dụng native mobile (iOS/Android) trên App Store (chỉ cần Web responsive).
- Các biến thể cờ khác ngoài luật OTTv2 9x9 đã cho.

---

# 3. Game Concept — Oẳn Tù Tì v2 (OTTv2)

## 3.1 Thể loại game
**Real-time / Turn-based Strategic Multiplayer Board Game** trên lưới cờ 9x9 kết hợp cơ chế Oẳn Tù Tì mở rộng.

## 3.2 Bàn cờ và Bố trí quân ban đầu
- **Kích thước:** Bàn cờ 9x9 ô vuông, trục ngang biểu diễn bằng các chữ cái `a, b, c, d, e, f, g, h, i` (tương ứng chỉ số x từ 0 đến 8), trục dọc biểu diễn bằng các số `1, 2, 3, 4, 5, 6, 7, 8, 9` (tương ứng chỉ số y từ 0 đến 8).
- **Hai ô đặc biệt (Goal Squares):**
  - Ô `a1` (góc dưới bên trái).
  - Ô `i9` (góc trên bên phải).
- **Lực lượng mỗi bên (9 quân):**
  - 3 quân Đấm (Rock - R)
  - 3 quân Lá/Bao (Paper - P)
  - 3 quân Kéo (Scissors - S)
- **Vị trí xuất phát chuẩn:**
  - **Player 1 (Trắng/Đỏ):** Bắt đầu tại phía dưới bàn cờ (hàng 1 và 2).
    - Hàng 1 (y = 0): `a1: R`, `b1: P`, `c1: S`, `d1: R`, `e1: P`, `f1: S`, `g1: R`, `h1: P`, `i1: S`
  - **Player 2 (Đen/Xanh):** Bắt đầu tại phía trên bàn cờ (hàng 9 và 8).
    - Hàng 9 (y = 8): `a9: S`, `b9: P`, `c9: R`, `d9: S`, `e9: P`, `f9: R`, `g9: S`, `h9: P`, `i9: R`

## 3.3 Quy tắc di chuyển
- Quân cờ thuộc bất kỳ loại nào (Đấm, Lá, Kéo) đều có tầm di chuyển: **đúng 1 ô** theo một trong **8 hướng** xung quanh (tương đương quân Vua trong cờ vua):
  - Hướng Bắc (N): `(x, y + 1)`
  - Hướng Đông Bắc (NE): `(x + 1, y + 1)`
  - Hướng Đông (E): `(x + 1, y)`
  - Hướng Đông Nam (SE): `(x + 1, y - 1)`
  - Hướng Nam (S): `(x, y - 1)`
  - Hướng Tây Nam (SW): `(x - 1, y - 1)`
  - Hướng Tây (W): `(x - 1, y)`
  - Hướng Tây Bắc (NW): `(x - 1, y + 1)`
- Nước đi không được vượt ra ngoài biên bàn cờ (0 ≤ x ≤ 8, 0 ≤ y ≤ 8).

## 3.4 Quy tắc tương tác và ăn quân (Combat Rules)
Khi một quân của người chơi A di chuyển vào ô đang có một quân của người chơi B:
1. **Áp dụng quan hệ Oẳn Tù Tì:**
   - **Đấm (Rock) ăn Kéo (Scissors):** Quân Đấm sống sót và chiếm ô, quân Kéo bị loại bỏ khỏi bàn cờ.
   - **Kéo (Scissors) ăn Lá (Paper):** Quân Kéo sống sót và chiếm ô, quân Lá bị loại bỏ.
   - **Lá (Paper) ăn Đấm (Rock):** Quân Lá sống sót và chiếm ô, quân Đấm bị loại bỏ.
2. **Quân cùng loại (Same Type Interaction):**
   - Đấm gặp Đấm, Kéo gặp Kéo, Lá gặp Lá: **KHÔNG THỂ ĂN NHAU**.
   - Hai quân cùng loại đứng **CHẶN ĐƯỜNG NHAU**. Nước đi của quân muốn đi vào ô đó bị coi là không hợp lệ (Invalid Move) và bị Server từ chối.
3. **Quân cùng phe (Friendly Collision):**
   - Một quân không thể di chuyển vào ô đang được chiếm giữ bởi một quân khác của chính người chơi đó (quân đồng minh chặn đường).

## 3.5 Điều kiện Thắng / Thua (Win / Lose Conditions)
Một người chơi được công nhận **THẮNG CUỘC NGAY LẬP TỨC** khi thỏa mãn ít nhất một trong các điều kiện sau:
1. **Chiến thắng do Tuyệt chủng một loại quân (Extinction Victory):**
   - Ăn hết sạch toàn bộ một loại quân của đối phương (Ví dụ: đối phương mất toàn bộ 3 quân Đấm, HOẶC toàn bộ 3 quân Lá, HOẶC toàn bộ 3 quân Kéo).
2. **Chiến thắng do Chiếm ô Đích (Goal Square Infiltration):**
   - Đưa được **bất kỳ một quân nào** còn sống của mình vào một trong hai ô đích chiến lược: ô `a1` hoặc ô `i9`.
3. **Chiến thắng do Đối thủ xin thua hoặc Bỏ cuộc (Resignation / Timeout):**
   - Đối thủ đầu hàng hoặc ngắt kết nối quá thời gian Grace Period (30s) mà không kết nối lại.

## 3.6 Chế độ chơi và Nhịp độ (Turn vs Realtime Cooldown)
Để phù hợp với cơ chế `playhtml.fun` / `playfull.html`, hệ thống hỗ trợ 2 chế độ nhịp điệu (tùy cấu hình phòng):
- **Chế độ Lượt (Turn-based):** Hai bên lần lượt đi nước cờ (mỗi lượt có thời gian giới hạn, ví dụ 30s).
- **Chế độ Thời gian thực có Cooldown (Real-time Action with Piece Cooldown):** Người chơi có thể di chuyển quân tự do, mỗi quân cờ sau khi di chuyển có thời gian hồi chiêu ngắn (ví dụ 1-2 giây) trước khi có thể đi tiếp, đem lại trải nghiệm tương tác trực tiếp nhiều người chơi sôi động chuẩn phong cách `playhtml`.

---

# 4. Actors & Users

| Actor | Miêu tả | Quyền hạn |
|---|---|---|
| **Player (Người chơi)** | Người tham gia trực tiếp điều khiển quân cờ trong phòng. | Tạo phòng, tham gia phòng, Ready, gửi lệnh di chuyển quân (`PIECE_MOVE`), yêu cầu Resync, xin thua, đề nghị Rematch. |
| **Spectator (Khán giả)** | Người xem ván đấu trong phòng. | Nhận Full Snapshot và Delta stream để xem bàn cờ theo thời gian thực; không có quyền gửi lệnh di chuyển. |
| **Server (Hệ thống Authoritative)** | Máy chủ quản lý toàn bộ logic và trạng thái. | Xác thực phiên, quản lý phòng, kiểm tra tính hợp lệ của nước đi (Validation), cập nhật Canonical State, phát hiện ăn quân/chặn đường, phân định thắng thua, phát sóng Snapshot/Delta. |

---

# 5. Game Rules Specification

| ID | Quy tắc | Tác tử kích hoạt | Kết quả mong đợi | Độ ưu tiên |
|---|---|---|---|---|
| **GAME-OTT-001** | Khởi tạo bàn cờ 9x9 | Server khi bắt đầu trận | Sinh đủ 81 ô (a1..i9), cấp đủ 9 quân cho P1 (hàng 1) và 9 quân cho P2 (hàng 9). | CRITICAL |
| **GAME-OTT-002** | Di chuyển 1 ô theo 8 hướng | Client gửi `PIECE_MOVE` | Server kiểm tra khoảng cách: `max(\|dx\|, \|dy\|) == 1`. Hợp lệ thì cho phép di chuyển. | CRITICAL |
| **GAME-OTT-003** | Chặn đường biên bàn cờ | Client gửi `PIECE_MOVE` | Nước đi có tọa độ đích ngoài phạm vi `[0..8, 0..8]` bị từ chối với lỗi `OUT_OF_BOUNDS`. | CRITICAL |
| **GAME-OTT-004** | Chặn đường quân đồng minh | Client gửi `PIECE_MOVE` | Nếu ô đích có quân cùng `ownerId`, từ chối với lỗi `FRIENDLY_BLOCK`. | HIGH |
| **GAME-OTT-005** | Chặn đường quân cùng loại | Client gửi `PIECE_MOVE` | Nếu ô đích có quân đối phương cùng loại (R gặp R, P gặp P, S gặp S), từ chối với lỗi `SAME_TYPE_BLOCK`. | CRITICAL |
| **GAME-OTT-006** | Đấm ăn Kéo (Rock beats Scissors) | Client `R` đi vào ô quân `S` | Quân `S` bị tiêu diệt, quân `R` chiếm ô đích, phát sự kiện `PIECE_CAPTURED`. | CRITICAL |
| **GAME-OTT-007** | Kéo ăn Lá (Scissors beats Paper) | Client `S` đi vào ô quân `P` | Quân `P` bị tiêu diệt, quân `S` chiếm ô đích, phát sự kiện `PIECE_CAPTURED`. | CRITICAL |
| **GAME-OTT-008** | Lá ăn Đấm (Paper beats Rock) | Client `P` đi vào ô quân `R` | Quân `R` bị tiêu diệt, quân `P` chiếm ô đích, phát sự kiện `PIECE_CAPTURED`. | CRITICAL |
| **GAME-OTT-009** | Thắng do ăn sạch 1 loại quân | Sự kiện `PIECE_CAPTURED` | Server kiểm tra nếu số lượng loại quân bị ăn của đối thủ giảm về 0 -> Kết thúc ván, người ăn thắng cuộc. | CRITICAL |
| **GAME-OTT-010** | Thắng do chiếm ô đích a1 / i9 | Quân cờ di chuyển vào a1 hoặc i9 | Người sở hữu quân cờ vừa di chuyển vào ô `a1` hoặc `i9` lập tức THẮNG CUỘC. | CRITICAL |
| **GAME-OTT-011** | Kiểm tra lượt đi (Turn check) | Client gửi `PIECE_MOVE` | Nếu ở chế độ Turn-based, chỉ người đến lượt mới được đi. Đi xong đổi lượt sang đối phương. | HIGH |
| **GAME-OTT-012** | Cooldown quân cờ (Realtime mode)| Client gửi `PIECE_MOVE` | Nếu ở chế độ Realtime, quân cờ chỉ được đi khi đã hết cooldown (mặc định 1.5s). | MEDIUM |

---

# 6. Functional Requirements

## 6.1 Quản lý Phòng (Room Management)
| ID | Yêu cầu | Tiêu chí chấp thuận (Acceptance Criteria) |
|---|---|---|
| **FR-ROOM-001** | Người chơi có thể tạo phòng mới | Tạo thành công phòng với mã phòng duy nhất (`roomId`), người tạo là Host (P1). |
| **FR-ROOM-002** | Người chơi có thể vào phòng bằng mã | Kiểm tra phòng tồn tại và chưa đủ 2 người chơi chính; thêm vào phòng với vai trò P2 hoặc Spectator. |
| **FR-ROOM-003** | Ghép phòng nhanh (Quick Play) | Tự động ghép người chơi vào phòng đang chờ hoặc tạo phòng mới nếu không có phòng khả dụng. |
| **FR-ROOM-004** | Cô lập phòng tuyệt đối (Room Isolation) | Mọi thông điệp và trạng thái của Room A không bao giờ rò rỉ sang Room B. |
| **FR-ROOM-005** | Trạng thái Ready và Khởi động trận | Khi cả 2 người chơi gửi `PLAYER_READY`, Server chuyển trạng thái phòng sang `PLAYING` và gửi `GAME_START`. |
| **FR-ROOM-006** | Rời phòng và Giải tán phòng | Người chơi có thể rời phòng; nếu trận chưa bắt đầu, phòng cập nhật danh sách; nếu Host rời, phòng tự giải tán. |

## 6.2 Quản lý Phiên & Kết nối (Session & Connection)
| ID | Yêu cầu | Tiêu chí chấp thuận (Acceptance Criteria) |
|---|---|---|
| **FR-SESS-001** | Cấp phát danh tính Guest & Token | Sinh `playerId` ngẫu nhiên và `sessionToken` an toàn cho mỗi client kết nối. |
| **FR-SESS-002** | Phát hiện mất kết nối (Disconnect) | Server phát hiện WebSocket đóng hoặc quá timeout ping/pong (5s) và kích hoạt Grace Period. |
| **FR-SESS-003** | Kết nối lại trong Grace Period (Reconnect) | Người chơi kết nối lại trong 30s với `sessionToken` cũ được khôi phục toàn bộ trạng thái và tiếp tục chơi. |
| **FR-SESS-004** | Hết hạn Grace Period | Sau 30s không reconnect, xử thua người chơi ngắt kết nối và trao chiến thắng cho đối thủ. |

## 6.3 Cơ chế Cờ OTTv2 & Tác vụ Realtime
| ID | Yêu cầu | Tiêu chí chấp thuận (Acceptance Criteria) |
|---|---|---|
| **FR-GAME-001** | Lựa chọn và hiển thị nước đi hợp lệ | Client click vào quân cờ của mình, hiển thị các ô xung quanh (tối đa 8 ô) hợp lệ để đi. |
| **FR-GAME-002** | Gửi và thực thi lệnh di chuyển | Client gửi `PIECE_MOVE`, Server thẩm định luật (GAME-OTT-002 đến 005), cập nhật vị trí và broadcast `STATE_DELTA`. |
| **FR-GAME-003** | Thực hiện ăn quân và cập nhật kho | Server tính toán thắng thua RPS, xóa quân thua, cập nhật bảng đếm số lượng quân còn lại (`pieceCounts`). |
| **FR-GAME-004** | Chặn đường di chuyển | Nước đi vào ô có quân cùng loại hoặc đồng minh bị Server trả về lỗi `MOVE_REJECTED` kèm mã lỗi. |
| **FR-GAME-005** | Phát hiện chiến thắng và kết thúc | Ngay khi phát hiện điều kiện thắng (GAME-OTT-009, 010), Server broadcast `GAME_OVER` kèm `winnerId` và `reason`. |
| **FR-GAME-006** | Đề nghị đấu lại (Rematch) | Cho phép người chơi yêu cầu chơi lại ván mới, reset bàn cờ 9x9 về vị trí ban đầu. |

## 6.4 Đồng bộ phần tử phong cách Playfull.html
| ID | Yêu cầu | Tiêu chí chấp thuận (Acceptance Criteria) |
|---|---|---|
| **FR-SYNC-001** | Khởi tạo Snapshot đầy đủ | Client vừa kết nối thành công nhận ngay `STATE_SNAPSHOT` chứa toàn bộ 18 quân cờ và trạng thái bàn cờ 9x9. |
| **FR-SYNC-002** | Đồng bộ Delta theo thời gian thực | Mỗi nước đi chỉ gửi Delta thay đổi vị trí quân hoặc trạng thái bị tiêu diệt, tối ưu băng thông. |
| **FR-SYNC-003** | Cơ chế Re-sync khi lệch Sequence | Client phát hiện mất gói dựa trên `sequence` sẽ gửi `RESYNC_REQUEST` để nhận lại Snapshot mới nhất. |

---

# 7. Non-Functional Requirements

## 7.1 Hiệu năng (Performance)
- **Round-Trip Time (RTT):** Server xử lý và phản hồi lệnh di chuyển dưới 50ms trong điều kiện mạng nội bộ/mạng chuẩn.
- **Server Tick Rate:** Game loop chạy ở tần số ổn định 20-30 ticks/giây đối với các tác vụ đếm giờ và kiểm tra timeout.
- **Băng thông gói tin:** Kích thước gói tin `STATE_DELTA` trung bình dưới 250 bytes; `STATE_SNAPSHOT` dưới 2 KB.
- **Tải bộ nhớ:** Bộ nhớ RAM tiêu thụ dưới 50MB cho 50 phòng chơi đồng thời.

## 7.2 Khả năng chịu tải (Scalability)
- Hỗ trợ tối thiểu 100 kết nối đồng thời trên một server instance duy nhất mà không bị crash hay drop connection.

## 7.3 Bảo mật & Toàn vẹn (Security)
- Khách hàng không thể gian lận tọa độ hoặc ăn quân trái luật: Mọi nước đi đều được thẩm định độc lập tại Server.
- Rate limiting: Giới hạn tối đa 10 messages/giây từ mỗi kết nối WebSocket để chống flood gói tin.
- Token xác thực phiên được tạo bằng hàm ngẫu nhiên mã hóa an toàn (`crypto.randomUUID()`).

---

# 8. Network Architecture & Protocols

```text
       +-------------------------------------------------------------+
       |                  Web Client (Playfull.html UI)             |
       |  - 9x9 Board View (DOM elements with synchronized state)   |
       |  - Piece Controller & 8-Direction Move Predictor           |
       |  - Network Adapter (HTTP & WebSocket Client)                |
       +------------------------------+------------------------------+
                                      |
                      HTTP REST       |       WebSocket Realtime
                    (Control Plane)   |         (Data Plane)
                                      |
       +------------------------------v------------------------------+
       |                  Game Server (Modular Monolith)             |
       |                                                             |
       |   [ HTTP Gateway ]               [ WebSocket Gateway ]      |
       |   - /api/rooms/create            - Packet Framing           |
       |   - /api/rooms/join              - Heartbeat (Ping/Pong)    |
       |   - /api/health                  - Connection Management    |
       |          |                                  |               |
       |          +-----------------+----------------+               |
       |                            |                                |
       |                  [ Protocol & Validator ]                   |
       |                  - Schema & Envelope Validation             |
       |                  - Rate Limiting                            |
       |                            |                                |
       |                  [ Session & Room Manager ]                 |
       |                  - Guest Tokens / Grace Period (30s)        |
       |                  - Room Isolation & Matchmaking             |
       |                            |                                |
       |                  [ Authoritative Game Engine ]              |
       |                  - 9x9 Grid Coordinate Verification         |
       |                  - 8-Direction King Movement Logic          |
       |                  - Combat: Rock > Scissors > Paper > Rock   |
       |                  - Block: Same-type & Friendly Collision    |
       |                  - Win Check: Piece extinction or a1/i9     |
       |                            |                                |
       |                  [ Synchronization Engine ]                 |
       |                  - Sequence Tracking                        |
       |                  - Full Snapshot Generation                 |
       |                  - Incremental Delta & Event Broadcast      |
       +-------------------------------------------------------------+
```

---

# 9. Protocol Specification & Message Catalogue

## 9.1 Unified Message Envelope
Tất cả các gói tin trao đổi qua WebSocket đều tuân thủ cấu trúc envelope chuẩn:
```json
{
  "messageId": "msg_01HXYZ789...",
  "type": "PIECE_MOVE",
  "timestamp": 1774230000000,
  "roomId": "room_alpha_99",
  "playerId": "player_white_01",
  "sequence": 142,
  "payload": {}
}
```

## 9.2 Danh mục Gói tin (Message Catalogue)

| Message Type | Direction | Reliable | Ordered | Payload chính | Ý nghĩa / Hành động |
|---|---|---|---|---|---|
| `CREATE_ROOM` | C → S | Yes | Yes | `{ roomName, gameMode }` | Yêu cầu tạo phòng mới |
| `ROOM_CREATED` | S → C | Yes | Yes | `{ roomId, hostId, joinCode }` | Phản hồi thông tin phòng đã tạo |
| `JOIN_ROOM` | C → S | Yes | Yes | `{ roomId, playerName }` | Yêu cầu tham gia phòng |
| `JOIN_ACCEPTED`| S → C | Yes | Yes | `{ roomId, assignedRole, playerList }` | Chấp thuận vào phòng |
| `PLAYER_READY` | C → S | Yes | Yes | `{ ready: true }` | Báo sẵn sàng chơi |
| `GAME_START` | S → C | Yes | Yes | `{ initialTurn, boardConfig }` | Thông báo trận đấu bắt đầu |
| `PIECE_MOVE` | C → S | Yes | Yes | `{ pieceId, from: {x,y}, to: {x,y} }` | Gửi nước đi 1 ô theo 8 hướng |
| `PIECE_MOVED` | S → C | Yes | Yes | `{ pieceId, from: {x,y}, to: {x,y}, nextTurn }` | Xác nhận nước đi hợp lệ |
| `PIECE_CAPTURED`| S → C | Yes | Yes | `{ attackerId, victimId, at: {x,y}, remainingCounts }` | Sự kiện ăn quân RPS |
| `MOVE_REJECTED`| S → C | Yes | Yes | `{ reason, code, invalidMove }` | Báo nước đi không hợp lệ |
| `GAME_OVER` | S → C | Yes | Yes | `{ winnerId, winCondition, finalScores }` | Kết thúc ván đấu |
| `STATE_SNAPSHOT`| S → C | Yes | Yes | `{ boardState, pieces, turn, score }` | Toàn bộ trạng thái ván cờ |
| `STATE_DELTA` | S → C | Yes | Yes | `{ changes: [ { path, value } ] }` | Thay đổi cục bộ sau nước đi |
| `RESYNC_REQUEST`| C → S | Yes | Yes | `{ lastKnownSequence }` | Yêu cầu cấp lại Snapshot do lệch gói |
| `PING` / `PONG`| C ↔ S | No | No | `{ timestamp }` | Giữ kết nối & đo RTT |
| `REMATCH_REQUEST`| C → S | Yes | Yes | `{}` | Đề nghị đấu lại ván mới |

---

# 10. Data Model & State Ownership Matrix

## 10.1 Cấu trúc Quân cờ (Piece Model)
```typescript
type PieceType = 'ROCK' | 'PAPER' | 'SCISSORS';

interface Piece {
  id: string;              // e.g. "p1_r1", "p2_s3"
  ownerId: string;         // "player1" | "player2"
  type: PieceType;         // 'ROCK' | 'PAPER' | 'SCISSORS'
  position: {
    x: number;             // 0..8 tương ứng cột a..i
    y: number;             // 0..8 tương ứng hàng 1..9
  };
  isAlive: boolean;        // true: còn trên bàn cờ, false: đã bị ăn
  lastMovedTick?: number;  // Dùng cho chế độ Realtime cooldown
}
```

## 10.2 Trạng thái Ván đấu (Canonical Game State)
```typescript
interface OTTGameState {
  roomId: string;
  status: 'WAITING' | 'PLAYING' | 'PAUSED' | 'ENDED';
  players: {
    player1: { id: string; name: string; connected: boolean; role: 'P1' };
    player2: { id: string; name: string; connected: boolean; role: 'P2' };
  };
  pieces: Record<string, Piece>; // Toàn bộ 18 quân cờ
  board: (string | null)[][];    // Ma trận 9x9 chứa pieceId hoặc null
  currentTurn: string;           // playerId đang đến lượt
  remainingPieces: {
    player1: { ROCK: number; PAPER: number; SCISSORS: number };
    player2: { ROCK: number; PAPER: number; SCISSORS: number };
  };
  goalSquares: {
    a1: { x: 0, y: 0 };
    i9: { x: 8, y: 8 };
  };
  winnerId: string | null;
  winReason: 'EXTINCTION_OF_TYPE' | 'REACHED_GOAL_SQUARE' | 'RESIGNATION' | 'DISCONNECT_TIMEOUT' | null;
  sequence: number;
}
```

## 10.3 State Ownership Matrix

| State Component | Primary Owner | Client Mutation | Server Mutation | Thẩm định (Validation) | Phương thức đồng bộ |
|---|---|---|---|---|---|
| Tọa độ quân cờ (Piece Position) | Server | Client Prediction (tạm thời) | Có (Authoritative) | Server kiểm tra luật 8 hướng & ô trống | `STATE_DELTA` |
| Trạng thái sống/chết quân (isAlive) | Server | Không | Có | Server tính theo RPS | `STATE_DELTA` / `PIECE_CAPTURED` |
| Số lượng quân từng loại (Counts) | Server | Không | Có | Server tự động cập nhật | `STATE_DELTA` |
| Lượt đi (Current Turn) | Server | Không | Có | Server luân chuyển sau nước đi | `STATE_DELTA` |
| Kết quả thắng/thua (Winner & Reason) | Server | Không | Có | Server kiểm tra điều kiện thắng | `GAME_OVER` |
| Trạng thái phòng (Room State) | Server | Không | Có | Server kiểm tra điều kiện chuyển | `STATE_DELTA` |
| Kết nối người chơi (Presence) | Server | Không | Có | Heartbeat / Socket event | `STATE_DELTA` |

---

# 11. Concurrency & Room State Machine

## 11.1 Concurrency Handling
- **Xử lý nước đi đồng thời:** Mọi lệnh `PIECE_MOVE` được đẩy vào hàng đợi (FIFO Queue) theo từng phòng tại Server. Nước đi nào đến trước và vượt qua khâu thẩm định sẽ được thực thi trước.
- **Tranh chấp ô đích:** Nếu 2 quân cùng muốn đi vào 1 ô tại cùng thời điểm, quân xử lý trước sẽ chiếm ô hoặc ăn quân đối thủ, lệnh của quân thứ hai sẽ được thẩm định lại trên trạng thái mới (có thể bị chặn hoặc ăn quân mới).

## 11.2 Room State Machine
```text
  [ WAITING ]  <-----------------------+
       |                               |
       | Cả 2 players READY            |
       v                               |
  [ PLAYING ]                          | Rematch
       |                               |
       +---> [ PAUSED ] (1 player disconnect, 30s Grace Period)
       |          |
       |          +--> [ PLAYING ] (Player reconnects within 30s)
       |          |
       |          +--> [ ENDED ] (Grace Period expired -> Forfeit)
       |
       v  Có người thắng (Sạch 1 loại quân hoặc chiếm a1/i9)
   [ ENDED ]
```

---

# 12. Traceability Matrix

| Requirement ID | Nội dung yêu cầu | Module cài đặt | Test Case ID | Tiêu chí nghiệm thu |
|---|---|---|---|---|
| **REQ-OTT-001** | Bàn cờ 9x9 & Khởi tạo 18 quân cờ | `server/game/board.ts` | `TC-BOARD-001` | Đủ 81 ô, 9 quân P1 ở hàng 1-2, 9 quân P2 ở hàng 8-9. |
| **REQ-OTT-002** | Di chuyển 1 ô theo 8 hướng (quân Vua) | `server/game/movement.ts` | `TC-MOVE-001` | Chỉ cho phép di chuyển trong 8 hướng lân cận, cự ly 1 ô. |
| **REQ-OTT-003** | Quy tắc ăn quân Oẳn Tù Tì | `server/game/combat.ts` | `TC-COMBAT-001`| Đấm ăn Kéo, Kéo ăn Lá, Lá ăn Đấm chính xác 100%. |
| **REQ-OTT-004** | Chặn đường quân cùng loại | `server/game/combat.ts` | `TC-BLOCK-001` | Cùng loại không ăn được nhau, đứng chặn đường nhau. |
| **REQ-OTT-005** | Thắng khi hết 1 loại quân | `server/game/winCheck.ts` | `TC-WIN-001` | Đối thủ hết sạch Đấm/Lá/Kéo -> Phát sự kiện thắng. |
| **REQ-OTT-006** | Thắng khi chiếm ô đích a1 hoặc i9 | `server/game/winCheck.ts` | `TC-WIN-002` | Quân bất kỳ di chuyển vào a1 hoặc i9 -> Thắng ngay. |
| **REQ-OTT-007** | Đồng bộ thời gian thực playfull.html | `client/sync/playfull.ts` | `TC-SYNC-001` | DOM bàn cờ 9x9 cập nhật ngay khi server gửi delta. |
| **REQ-OTT-008** | Reconnect & Grace period 30s | `server/network/session.ts` | `TC-RECON-001` | Mất mạng 15s kết nối lại phục hồi nguyên vẹn trạng thái. |
| **REQ-OTT-009** | Benchmark Snapshot vs Delta | `benchmarks/loadTest.ts` | `TC-PERF-001` | Có bảng so sánh thông lượng và biểu đồ báo cáo. |

---

# 13. Deployment & Delivery

- **Mã nguồn Git:**
  - `client/`: Giao diện Web cờ OTTv2, playfull.html binding, asset quân cờ.
  - `server/`: Server Node.js / TypeScript, WebSocket, Game Engine, Room/Session.
  - `shared/`: Protocol schemas, TypeScript types dùng chung.
  - `tests/`: Bộ test tự động (Vitest / Jest / Playwright).
  - `benchmarks/`: Script đo tải (Artillery / Autocannon).
  - `docs/`: Toàn bộ 5 tài liệu đặc tả và SRS.
  - `README.md`: Hướng dẫn chạy local, Docker, và link deploy trực tuyến.
- **Link Deploy công khai:** Được cung cấp rõ ràng ngay đầu file `README.md` để giảng viên có thể click vào chơi trực tiếp trên trình duyệt mà không cần cài đặt.

---

# 14. Implementation-Readiness Audit
- [x] Đề bài OTTv2 và thư viện/cơ chế playfull.html đã được đặc tả chi tiết.
- [x] Bàn cờ 9x9, luật di chuyển 8 hướng, luật ăn quân RPS, luật chặn đường được định nghĩa rõ ràng.
- [x] Hai điều kiện thắng (sạch 1 loại quân hoặc chiếm a1/i9) đã có ID và thuật toán kiểm tra.
- [x] Danh mục gói tin WebSocket, định dạng Payload và State Model hoàn tất 100%.
- [x] Phân công trách nhiệm 3 sinh viên cho Bài 2 rõ ràng, minh bạch.
- [x] Không còn bất kỳ mục `[TODO]`, `[TBD]`, hoặc `[GAME-DEPENDENT]` nào chưa giải quyết.

**Trạng thái sẵn sàng cài đặt (Implementation Readiness):** **100% — BASELINE LOCKED & APPROVED**.
