# Security — Bộ tài liệu của Đức

Deadline chung toàn team: 00:00 10/10/2026 → 00:00 12/10/2026, UTC+7; 48 giờ lịch. Các file là đặc tả và điều kiện nghiệm thu, chưa phải evidence implementation.

| TASK_ID | Tài liệu | Nội dung |
|---|---|---|
| Tổng quan | [DUC.md](DUC.md) | Phân công/ownership, thứ tự thực hiện và handoff |
| D-01 | [FRS-D01](FRS-D01-THREAT-MODEL-POLICY.md) | Threat model, policy và risk/control matrix |
| D-02 | [FRS-D02](FRS-D02-AUTH-SESSION-ACCESS.md) | Auth/session/ACL/CSRF, external automation và API limits |
| D-03.ON | [FRS-D03](FRS-D03-ONLINE-SANDBOX.md) | Online sandbox/runtime gates |
| D-03.OFF | [FRS-D04](FRS-D04-OFFLINE-SANDBOX.md) | Offline compartment/kit/bridge/cold-launch gates |
| D-04 | [FRS-D05](FRS-D05-ANTI-CHEAT-PRIVACY.md) | Anti-cheat, races và dữ liệu riêng |
| D-05 | [FRS-D06](FRS-D06-OPERATIONS-DATA-SECURITY.md) | Operations/data security và incident rehearsal |
| D-06 | [FRS-D07](FRS-D07-SECURITY-ACCEPTANCE.md) | Coverage/evidence, attack regression và sign-off |

Policy/fixtures bắt đầu sớm; owner tạo candidate → Đức review → owner sửa → retest. Nam giữ runtime, Long giữ contracts/lifecycle/data/network, Sơn giữ shared UI; không đợi nhau DONE theo vòng.

**Phần việc chung:** [Long là owner code tích hợp LD-01…LD-06](../network-core/LONG.md#10-thực-thi-song-song-longđức), config/candidate và integration fixes. [DUC.md](DUC.md#long-duc) ghi modules/policy/fixtures Đức cung cấp, checkpoint và điều kiện review/retest. Đức vẫn triển khai security modules riêng; code Đức viết cần reviewer khác. Khóa interface/budgets sớm.
