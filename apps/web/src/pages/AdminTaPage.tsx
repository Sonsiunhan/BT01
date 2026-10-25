import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, LoadingState, Modal, useToast } from "../components/ui";
import { routes } from "../app/routes";
import { ApiError } from "../services/http/apiError";
import {
  bindTaContract,
  bootstrapTaAccount,
  createTaAccount,
  fetchTaList,
  revokeTaAccount,
  type TaUserItem,
} from "../services/admin/taApi";
import { AdminForbiddenState } from "../features/admin/shell/AdminForbiddenState";

export default function AdminTaPage() {
  const { notify } = useToast();
  const [taList, setTaList] = useState<TaUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  // Create TA Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    displayName: "",
    username: "",
    password: "",
  });
  const [createPending, setCreatePending] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Bind TA Modal
  const [bindingTa, setBindingTa] = useState<TaUserItem | null>(null);
  const [bindContractId, setBindContractId] = useState("");
  const [bindNotes, setBindNotes] = useState("");
  const [bindPending, setBindPending] = useState(false);
  const [bindError, setBindError] = useState<string | null>(null);

  // Revoke TA Modal
  const [revokingTa, setRevokingTa] = useState<TaUserItem | null>(null);
  const [revokePending, setRevokePending] = useState(false);

  // Bootstrap state
  const [bootstrapPending, setBootstrapPending] = useState(false);

  const handleOpenCreateModal = () => {
    setCreateError(null);
    setCreateForm({ fullName: "", displayName: "", username: "", password: "" });
    setShowCreateModal(true);
  };

  const handleCloseCreateModal = () => {
    if (createPending) return;
    setShowCreateModal(false);
    setCreateError(null);
  };

  const handleOpenBindModal = (ta: TaUserItem) => {
    setBindingTa(ta);
    setBindContractId("");
    setBindNotes("");
    setBindError(null);
  };

  const handleCloseBindModal = () => {
    if (bindPending) return;
    setBindingTa(null);
    setBindError(null);
    setBindContractId("");
    setBindNotes("");
  };

  const handleCloseRevokeModal = () => {
    if (revokePending) return;
    setRevokingTa(null);
  };

  const handleBootstrap = async () => {
    setBootstrapPending(true);
    try {
      const res = await bootstrapTaAccount();
      notify(`Khởi tạo tài khoản TA "${res.user.displayName}" thành công!`, "success");
      await loadList();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Khởi tạo nhanh TA thất bại.", "error");
    } finally {
      setBootstrapPending(false);
    }
  };

  const loadList = async () => {
    setLoading(true);
    setError(null);
    setStatusCode(null);
    try {
      const data = await fetchTaList();
      setTaList(data.items ?? []);
    } catch (err) {
      if (err instanceof ApiError) {
        setStatusCode(err.status ?? null);
        setError(err.message);
      } else {
        setError("Không thể kết nối đến máy chủ.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreatePending(true);
    setCreateError(null);
    try {
      const payload: { fullName: string; displayName: string; username: string; password?: string } = {
        fullName: createForm.fullName.trim(),
        displayName: createForm.displayName.trim(),
        username: createForm.username.trim(),
      };
      if (createForm.password.trim()) {
        payload.password = createForm.password.trim();
      }
      const res = await createTaAccount(payload);
      notify(`Tạo tài khoản Tournament Admin "${res.user.displayName}" thành công!`, "success");
      setShowCreateModal(false);
      setCreateForm({ fullName: "", displayName: "", username: "", password: "" });
      await loadList();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Tạo tài khoản thất bại.");
    } finally {
      setCreatePending(false);
    }
  };

  const handleBindSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!bindingTa || !bindContractId.trim()) return;
    setBindPending(true);
    setBindError(null);
    try {
      await bindTaContract(bindingTa.id, {
        contractId: bindContractId.trim(),
        notes: bindNotes.trim() || undefined,
      });
      notify(`Gán hợp đồng cho "${bindingTa.displayName}" thành công!`, "success");
      setBindingTa(null);
      setBindContractId("");
      setBindNotes("");
      await loadList();
    } catch (err) {
      setBindError(err instanceof ApiError ? err.message : "Gán hợp đồng thất bại.");
    } finally {
      setBindPending(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokingTa) return;
    setRevokePending(true);
    try {
      const res = await revokeTaAccount(revokingTa.id);
      notify(res.message || `Đã thu hồi quyền Tournament Admin của "${revokingTa.displayName}".`, "info");
      setRevokingTa(null);
      await loadList();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Thu hồi quyền thất bại.", "error");
    } finally {
      setRevokePending(false);
    }
  };

  if (statusCode === 401) {
    return (
      <div className="panel" style={{ padding: "2rem", textAlign: "center" }} data-testid="ta-unauthorized">
        <h2 style={{ color: "var(--danger)" }}>Yêu cầu đăng nhập</h2>
        <p style={{ color: "var(--text-secondary)" }}>Phiên đăng nhập đã hết hạn hoặc bạn chưa đăng nhập.</p>
        <Link to={routes.login} className="button primary" style={{ marginTop: "1rem", display: "inline-block" }}>
          Đăng nhập ngay
        </Link>
      </div>
    );
  }

  if (statusCode === 403) {
    return (
      <div data-testid="ta-forbidden">
        <AdminForbiddenState
          testId="ta-forbidden"
          title="Không đủ quyền hạn"
          featureName="Quản lý tài khoản Tournament Admin"
          message="Chỉ Quản trị viên hệ thống (SYSTEM_ADMIN) mới có quyền quản lý tài khoản Tournament Admin."
          backTo={routes.adminTournaments}
          backText="Quay lại Bảng điều khiển Giải đấu"
        />
      </div>
    );
  }

  return (
    <div className="admin-ta-page" style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }} data-testid="admin-ta-page">
      {/* Page Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
          borderBottom: "1px solid var(--border)",
          paddingBottom: "1rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-block",
                padding: "0.2rem 0.5rem",
                borderRadius: "0.25rem",
                fontSize: "0.75rem",
                fontFamily: "var(--font-data)",
                fontWeight: 700,
                background: "color-mix(in srgb, var(--primary) 15%, transparent)",
                color: "var(--primary)",
              }}
            >
              P09
            </span>
            <h1 style={{ fontSize: "1.5rem", margin: 0, fontWeight: 700 }}>Quản lý Tournament Admin (TA)</h1>
          </div>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Danh sách, tạo tài khoản quản trị giải đấu, gán hợp đồng và thu hồi quyền hạn.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button variant="secondary" onClick={loadList} disabled={loading || bootstrapPending} data-testid="refresh-btn">
            Làm mới
          </Button>
          <Button
            variant="secondary"
            onClick={handleBootstrap}
            disabled={loading || bootstrapPending}
            data-testid="bootstrap-ta-btn"
          >
            {bootstrapPending ? "Đang khởi tạo..." : "Khởi tạo nhanh TA"}
          </Button>
          <Button
            variant="primary"
            onClick={handleOpenCreateModal}
            disabled={bootstrapPending}
            data-testid="open-create-ta-btn"
          >
            + Tạo tài khoản TA
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <LoadingState label="Đang tải danh sách Tournament Admin..." fullPage={false} />
      ) : error ? (
        <div
          className="banner danger"
          style={{
            padding: "1rem",
            marginBottom: "1rem",
            background: "color-mix(in srgb, var(--danger) 10%, transparent)",
            border: "1px solid var(--danger)",
            borderRadius: "0.5rem",
          }}
          data-testid="ta-error-banner"
        >
          <strong>Lỗi:</strong> {error}
          <Button variant="secondary" style={{ marginLeft: "1rem" }} onClick={loadList}>
            Thử lại
          </Button>
        </div>
      ) : taList.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 1rem",
            border: "1px dashed var(--border)",
            borderRadius: "0.75rem",
            color: "var(--text-secondary)",
          }}
          data-testid="ta-empty-state"
        >
          <p style={{ marginBottom: "1.5rem" }}>Chưa có tài khoản Tournament Admin nào được tạo trong hệ thống.</p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <Button
              variant="secondary"
              onClick={handleBootstrap}
              disabled={bootstrapPending}
              data-testid="empty-bootstrap-btn"
            >
              {bootstrapPending ? "Đang khởi tạo..." : "Khởi tạo nhanh TA (Bootstrap)"}
            </Button>
            <Button
              variant="primary"
              onClick={handleOpenCreateModal}
              disabled={bootstrapPending}
              data-testid="empty-create-btn"
            >
              Tạo tài khoản TA đầu tiên
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="table-responsive"
          style={{
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            overflowX: "auto",
            background: "var(--surface)",
          }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}
            aria-label="Danh sách Tournament Admin"
            data-testid="ta-table"
          >
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "color-mix(in srgb, var(--surface) 90%, black)" }}>
                <th scope="col" style={{ padding: "0.75rem 1rem" }}>Tên đăng nhập</th>
                <th scope="col" style={{ padding: "0.75rem 1rem" }}>Tên hiển thị</th>
                <th scope="col" style={{ padding: "0.75rem 1rem" }}>Họ và tên</th>
                <th scope="col" style={{ padding: "0.75rem 1rem" }}>Vai trò</th>
                <th scope="col" style={{ padding: "0.75rem 1rem" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {taList.map((ta) => (
                <tr key={ta.id} style={{ borderBottom: "1px solid var(--border)" }} data-testid={`ta-row-${ta.id}`}>
                  <td style={{ padding: "0.75rem 1rem", fontFamily: "var(--font-data)", fontWeight: 600 }}>
                    {ta.username}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>{ta.displayName}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>{ta.fullName}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span
                      style={{
                        padding: "0.2rem 0.5rem",
                        borderRadius: "0.25rem",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "color-mix(in srgb, var(--primary) 20%, transparent)",
                        color: "var(--primary)",
                      }}
                    >
                      {ta.role || "TOURNAMENT_ADMIN"}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Button
                        variant="secondary"
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                        onClick={() => handleOpenBindModal(ta)}
                        aria-label={`Gán hợp đồng cho ${ta.displayName}`}
                        data-testid={`bind-btn-${ta.id}`}
                      >
                        Gán hợp đồng
                      </Button>
                      <Button
                        variant="danger"
                        style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                        onClick={() => setRevokingTa(ta)}
                        aria-label={`Thu hồi quyền của ${ta.displayName}`}
                        data-testid={`revoke-btn-${ta.id}`}
                      >
                        Thu hồi
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tạo TA */}
      {showCreateModal && (
        <Modal
          open={showCreateModal}
          dismissible={!createPending}
          title="Tạo tài khoản Tournament Admin mới"
          onClose={handleCloseCreateModal}
        >
          <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }} data-testid="create-ta-modal">
            {createError && (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  padding: "0.75rem",
                  color: "var(--danger)",
                  background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                  borderRadius: "0.375rem",
                  fontSize: "0.85rem",
                }}
                data-testid="create-error-msg"
              >
                {createError}
              </div>
            )}
            <div>
              <label htmlFor="create-fullname" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                Họ và tên *
              </label>
              <input
                id="create-fullname"
                type="text"
                required
                minLength={2}
                maxLength={100}
                className="input"
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-raised)",
                  color: "var(--text)",
                }}
                value={createForm.fullName}
                onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                placeholder="Ví dụ: Nguyễn Văn Quản Trị"
                data-testid="input-fullname"
              />
            </div>
            <div>
              <label htmlFor="create-displayname" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                Tên hiển thị *
              </label>
              <input
                id="create-displayname"
                type="text"
                required
                minLength={2}
                maxLength={100}
                className="input"
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-raised)",
                  color: "var(--text)",
                }}
                value={createForm.displayName}
                onChange={(e) => setCreateForm({ ...createForm, displayName: e.target.value })}
                placeholder="Ví dụ: TA Quản Trị"
                data-testid="input-displayname"
              />
            </div>
            <div>
              <label htmlFor="create-username" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                Tên đăng nhập * (ít nhất 3 ký tự, chỉ chữ cái, số, _, -)
              </label>
              <input
                id="create-username"
                type="text"
                required
                minLength={3}
                maxLength={32}
                pattern="^[a-zA-Z0-9_-]+$"
                className="input"
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-raised)",
                  color: "var(--text)",
                }}
                value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="Ví dụ: ta_tournament_01"
                data-testid="input-username"
              />
            </div>
            <div>
              <label htmlFor="create-password" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                Mật khẩu (tùy chọn, để trống sẽ tự tạo ngẫu nhiên)
              </label>
              <input
                id="create-password"
                type="password"
                minLength={8}
                maxLength={128}
                className="input"
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-raised)",
                  color: "var(--text)",
                }}
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Tối thiểu 8 ký tự"
                data-testid="input-password"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <Button type="button" variant="secondary" disabled={createPending} onClick={handleCloseCreateModal}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" pending={createPending} data-testid="submit-create-ta-btn">
                Xác nhận tạo
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Gán Hợp Đồng */}
      {bindingTa && (
        <Modal
          open={Boolean(bindingTa)}
          dismissible={!bindPending}
          title={`Gán hợp đồng cho ${bindingTa.displayName} (${bindingTa.username})`}
          onClose={handleCloseBindModal}
        >
          <form onSubmit={handleBindSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }} data-testid="bind-ta-modal">
            {bindError && (
              <div
                role="alert"
                aria-live="polite"
                style={{
                  padding: "0.75rem",
                  color: "var(--danger)",
                  background: "color-mix(in srgb, var(--danger) 10%, transparent)",
                  borderRadius: "0.375rem",
                  fontSize: "0.85rem",
                }}
                data-testid="bind-error-msg"
              >
                {bindError}
              </div>
            )}
            <div>
              <label htmlFor="bind-contract-id" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                Mã hoặc ID Hợp đồng giải đấu *
              </label>
              <input
                id="bind-contract-id"
                type="text"
                required
                className="input"
                style={{
                  width: "100%",
                  padding: "0.65rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-raised)",
                  color: "var(--text)",
                }}
                value={bindContractId}
                onChange={(e) => setBindContractId(e.target.value)}
                placeholder="Nhập ID hợp đồng (ví dụ: contract-uuid-123)"
                data-testid="input-contract-id"
              />
            </div>
            <div>
              <label htmlFor="bind-notes" style={{ display: "block", marginBottom: "0.25rem", fontSize: "0.85rem", fontWeight: 600 }}>
                Ghi chú (tùy chọn)
              </label>
              <textarea
                id="bind-notes"
                maxLength={500}
                className="input"
                style={{
                  width: "100%",
                  height: "80px",
                  resize: "vertical",
                  padding: "0.65rem 0.75rem",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-raised)",
                  color: "var(--text)",
                }}
                value={bindNotes}
                onChange={(e) => setBindNotes(e.target.value)}
                placeholder="Ghi chú phân công phụ trách giải đấu..."
                data-testid="input-bind-notes"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <Button type="button" variant="secondary" disabled={bindPending} onClick={handleCloseBindModal}>
                Hủy
              </Button>
              <Button type="submit" variant="primary" pending={bindPending} data-testid="submit-bind-ta-btn">
                Xác nhận gán
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Xác Nhận Thu Hồi */}
      {revokingTa && (
        <Modal
          open={Boolean(revokingTa)}
          dismissible={!revokePending}
          title="Xác nhận thu hồi quyền Tournament Admin"
          onClose={handleCloseRevokeModal}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }} data-testid="revoke-confirm-modal">
            <p>
              Bạn có chắc chắn muốn thu hồi quyền Tournament Admin của{" "}
              <strong>{revokingTa.displayName}</strong> (<em>{revokingTa.username}</em>)?
            </p>
            <p style={{ fontSize: "0.85rem", color: "var(--danger)" }}>
              Sau khi thu hồi, tài khoản sẽ chuyển về vai trò người dùng thường (USER) và toàn bộ quyền quản trị giải đấu đã gán sẽ bị hủy hiệu lực.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
              <Button type="button" variant="secondary" disabled={revokePending} onClick={handleCloseRevokeModal}>
                Hủy
              </Button>
              <Button
                type="button"
                variant="danger"
                pending={revokePending}
                onClick={handleRevokeConfirm}
                data-testid="confirm-revoke-btn"
              >
                Xác nhận thu hồi
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
