import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../services/http/apiError";
import AccountAccessPage from "./AccountAccessPage";
import SupportRecoveryPage from "../features/admin/support/SupportRecoveryPage";
import type { RecoveryApi } from "../services/support/recoveryApi";
import type { SupportRequestView } from "@ottv2/contracts";

const requestView = (status: SupportRequestView["status"] = "OPEN"): SupportRequestView => ({
  id: "ticket-1",
  tenantId: null,
  requestType: "ACCOUNT_RECOVERY",
  targetUserId: "user-1",
  requesterUserId: null,
  status,
  reason: "Không thể đăng nhập",
  assignedOperatorUserId: null,
  verificationReference: status === "VERIFIED" ? "case-1" : null,
  createdAt: "2026-10-23T09:00:00.000Z",
  updatedAt: "2026-10-23T09:00:00.000Z",
  verifiedAt: status === "VERIFIED" ? "2026-10-23T09:00:00.000Z" : null,
  rejectedAt: null,
  resolvedAt: null,
  closedAt: null,
});

function makeApi(overrides: Partial<RecoveryApi> = {}): RecoveryApi {
  return {
    request: vi.fn().mockResolvedValue({ accepted: true, requestId: null, replayed: false }),
    reset: vi.fn().mockResolvedValue({ accepted: true }),
    list: vi.fn().mockResolvedValue({ requests: [requestView()] }),
    detail: vi.fn().mockResolvedValue(requestView()),
    transition: vi.fn().mockResolvedValue({ request: requestView("VERIFIED"), replayed: false }),
    issueResetToken: vi.fn().mockResolvedValue({ request: requestView("VERIFIED"), purpose: "ACCOUNT_RECOVERY_RESET", expiresAt: "2026-10-23T10:00:00.000Z", rawToken: "opaque-token", replayed: false }),
    ...overrides,
  };
}

function renderAccess(entry = "/account-access", api = makeApi()) {
  return render(<MemoryRouter initialEntries={[entry]}><Routes><Route path="/account-access" element={<AccountAccessPage api={api} />} /><Route path="/account-access/reset" element={<AccountAccessPage api={api} />} /><Route path="/dang-nhap" element={<p>login</p>} /></Routes></MemoryRouter>);
}

afterEach(() => vi.restoreAllMocks());

describe("D07-C account access UI", () => {
  it("renders a public support request without password fields", () => {
    renderAccess();
    expect(screen.getByTestId("account-access-request")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.queryByLabelText("Mật khẩu mới")).not.toBeInTheDocument();
  });

  it("validates required request fields before calling the API", async () => {
    const api = makeApi();
    renderAccess("/account-access", api);
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("username");
    expect(api.request).not.toHaveBeenCalled();
  });

  it("sends only the canonical username and reason", async () => {
    const api = makeApi();
    renderAccess("/account-access", api);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "player" } });
    fireEvent.change(screen.getByLabelText("Lý do cần hỗ trợ"), { target: { value: "Không thể đăng nhập" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledWith({ username: "player", reason: "Không thể đăng nhập" }));
  });

  it("shows the same accepted handoff regardless of account existence", async () => {
    const api = makeApi();
    renderAccess("/account-access", api);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "unknown" } });
    fireEvent.change(screen.getByLabelText("Lý do cần hỗ trợ"), { target: { value: "Mất quyền truy cập" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(await screen.findByRole("status")).toHaveTextContent("đã được tiếp nhận");
  });

  it("maps request transport errors to a safe retry message", async () => {
    const api = makeApi({ request: vi.fn().mockRejectedValue(new Error("account exists")) });
    renderAccess("/account-access", api);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "player" } });
    fireEvent.change(screen.getByLabelText("Lý do cần hỗ trợ"), { target: { value: "Cần trợ giúp" } });
    fireEvent.click(screen.getByRole("button", { name: "Gửi yêu cầu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không thể gửi yêu cầu");
    expect(screen.queryByText("account exists")).not.toBeInTheDocument();
  });

  it("renders reset mode only when a token is present in the entry URL", () => {
    renderAccess("/account-access?token=one-time");
    expect(screen.getByTestId("account-access-reset")).toBeInTheDocument();
    expect(screen.queryByLabelText("Username")).not.toBeInTheDocument();
  });

  it("rejects a reset password that fails the repository policy", async () => {
    const api = makeApi();
    renderAccess("/account-access?token=one-time", api);
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));
    expect(await screen.findByText("Mật khẩu phải có ít nhất 8 ký tự.")).toBeInTheDocument();
    expect(api.reset).not.toHaveBeenCalled();
  });

  it("requires matching reset confirmation", async () => {
    const api = makeApi();
    renderAccess("/account-access?token=one-time", api);
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "secure-pass" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));
    expect(await screen.findByText("Mật khẩu xác nhận không khớp.")).toBeInTheDocument();
    expect(api.reset).not.toHaveBeenCalled();
  });

  it("passes the URL token and new password to the typed reset endpoint", async () => {
    const api = makeApi();
    renderAccess("/account-access?token=opaque-token", api);
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "secure-pass" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "secure-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));
    await waitFor(() => expect(api.reset).toHaveBeenCalledWith({ token: "opaque-token", newPassword: "secure-pass" }));
  });

  it("shows a generic message for expired, consumed, or invalid reset tokens", async () => {
    const api = makeApi({ reset: vi.fn().mockRejectedValue(new ApiError("token details", 401)) });
    renderAccess("/account-access?token=expired", api);
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "secure-pass" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "secure-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("không hợp lệ hoặc đã hết hạn");
    expect(screen.queryByText("token details")).not.toBeInTheDocument();
  });

  it("clears password fields after a successful reset", async () => {
    renderAccess("/account-access?token=one-time");
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "secure-pass" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "secure-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Mật khẩu đã được thay đổi an toàn");
    expect(screen.queryByDisplayValue("secure-pass")).not.toBeInTheDocument();
  });

  it("does not write token or password material to browser storage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderAccess("/account-access?token=opaque-token");
    fireEvent.change(screen.getByLabelText("Mật khẩu mới"), { target: { value: "secure-pass" } });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới"), { target: { value: "secure-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại mật khẩu" }));
    await screen.findByRole("status");
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe("D07-C support queue UI", () => {
  it("loads and renders the system-admin support queue", async () => {
    const api = makeApi();
    render(<MemoryRouter><SupportRecoveryPage api={api} /></MemoryRouter>);
    expect(await screen.findByTestId("support-recovery-page")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /user-1/ })).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith(undefined);
  });

  it("renders an empty queue without inventing a support role", async () => {
    const api = makeApi({ list: vi.fn().mockResolvedValue({ requests: [] }) });
    render(<MemoryRouter><SupportRecoveryPage api={api} /></MemoryRouter>);
    expect(await screen.findByTestId("support-recovery-empty")).toHaveTextContent("Không có yêu cầu");
    expect(screen.queryByText(/SUPPORT_AGENT/)).not.toBeInTheDocument();
  });

  it("shows a safe forbidden state for non-system-admin callers", async () => {
    const api = makeApi({ list: vi.fn().mockRejectedValue(new ApiError("forbidden details", 403)) });
    render(<MemoryRouter><SupportRecoveryPage api={api} /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("không có quyền truy cập");
    expect(screen.queryByText("forbidden details")).not.toBeInTheDocument();
  });

  it("loads detail only after selecting a queue item", async () => {
    const api = makeApi();
    render(<MemoryRouter><SupportRecoveryPage api={api} /></MemoryRouter>);
    await screen.findByRole("button", { name: /user-1/ });
    fireEvent.click(screen.getByRole("button", { name: /user-1/ }));
    await waitFor(() => expect(api.detail).toHaveBeenCalledWith("ticket-1"));
    expect(screen.getByText("Không thể đăng nhập")).toBeInTheDocument();
  });

  it("requires verification evidence before showing the verify action", async () => {
    const api = makeApi({ list: vi.fn().mockResolvedValue({ requests: [requestView("IN_PROGRESS")] }), detail: vi.fn().mockResolvedValue(requestView("IN_PROGRESS")) });
    render(<MemoryRouter><SupportRecoveryPage api={api} /></MemoryRouter>);
    await screen.findByRole("button", { name: /user-1/ });
    expect(screen.getByRole("button", { name: "Xác minh" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Verification reference"), { target: { value: "case-1" } });
    expect(screen.getByRole("button", { name: "Xác minh" })).toBeEnabled();
  });

  it("sends a verify transition with evidence and refreshes the selected item", async () => {
    const api = makeApi({ list: vi.fn().mockResolvedValue({ requests: [requestView("IN_PROGRESS")] }), detail: vi.fn().mockResolvedValue(requestView("IN_PROGRESS")) });
    render(<MemoryRouter><SupportRecoveryPage api={api} /></MemoryRouter>);
    await screen.findByRole("button", { name: /user-1/ });
    fireEvent.change(screen.getByLabelText("Verification reference"), { target: { value: "case-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác minh" }));
    await waitFor(() => expect(api.transition).toHaveBeenCalledWith("ticket-1", { action: "VERIFY", verificationReference: "case-1" }));
  });

  it("issues the reset handoff only from VERIFIED", async () => {
    const api = makeApi({ list: vi.fn().mockResolvedValue({ requests: [requestView("VERIFIED")] }), detail: vi.fn().mockResolvedValue(requestView("VERIFIED")) });
    render(<MemoryRouter><SupportRecoveryPage api={api} /></MemoryRouter>);
    await screen.findByRole("button", { name: "Cấp handoff reset" });
    fireEvent.click(screen.getByRole("button", { name: "Cấp handoff reset" }));
    expect(await screen.findByTestId("support-reset-handoff")).toHaveTextContent("opaque-token");
    expect(api.issueResetToken).toHaveBeenCalledWith("ticket-1");
  });

  it("keeps the raw handoff token out of storage and offers the reset flow link", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const api = makeApi({ list: vi.fn().mockResolvedValue({ requests: [requestView("VERIFIED")] }), detail: vi.fn().mockResolvedValue(requestView("VERIFIED")) });
    render(<MemoryRouter><SupportRecoveryPage api={api} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Cấp handoff reset" }));
    const link = await screen.findByRole("link", { name: "Mở luồng đặt lại" });
    expect(link).toHaveAttribute("href", "/account-access?token=opaque-token");
    expect(setItem).not.toHaveBeenCalled();
  });
});
