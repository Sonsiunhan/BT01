# Network Core — Bộ tài liệu của Long

| TASK_ID | Tài liệu | Phạm vi |
|---|---|---|
| Tổng quan | [LONG.md](LONG.md) | Phân công, ownership và thứ tự phối hợp |
| L-01 | [FRS-L01](FRS-L01-GAME-RULES-SETUP.md) | Game rules và setup |
| L-02 | [FRS-L02](FRS-L02-API-DATA-CONTRACTS.md) | API/data contracts |
| L-03.ROOM | [FRS-L03](FRS-L03-ROOM-MATCHMAKING.md) | Room và matchmaking |
| L-03.SYNC | [FRS-L04](FRS-L04-HTTP-SSE-SYNC.md) | HTTP/SSE và shared client sync |
| L-04 | [FRS-L05](FRS-L05-MATCH-AUTHORITY-CLOCKS.md) | Authority và clocks |
| L-05 | [FRS-L06](FRS-L06-PERSISTENCE-RECOVERY-REPLAY.md) | Persistence, recovery và replay |
| L-06A/L-07/L-06B | [FRS-L07](FRS-L07-CAPACITY-INTEGRATION-RUNBOOK.md) | Capacity, integration và runbook |

Thứ tự: L-01/L-02 → L-03/L-04/L-05 tích hợp theo interface → L-07 retest/bàn giao. L-06A và baseline L-07 bắt đầu sớm; task authority/persistence không chờ nhau DONE theo vòng.

Các FRS là yêu cầu và tiêu chí nghiệm thu; trạng thái implementation phải được xác nhận bằng evidence, không suy từ việc tài liệu đã đầy đủ.

## Phối hợp Security

L02…L07 có checklist ở cuối file; [LONG.md](LONG.md#10-thực-thi-song-song-longđức) giao Long toàn bộ code tích hợp chung LD-01…LD-06, config, candidate và integration fixes. Đức giữ security modules riêng/policy/attack fixtures, review/retest liên tục. [Checklist đầu vào/nghiệm thu](../security/DUC.md#long-duc) giữ TASK_ID và DoD hiện có.
