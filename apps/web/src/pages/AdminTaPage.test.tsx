import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import AdminTaPage from "./AdminTaPage";
import { ApiError } from "../services/http/apiError";

const mocks = vi.hoisted(() => ({
  fetchTaList: vi.fn(),
  bootstrapTaAccount: vi.fn(),
  createTaAccount: vi.fn(),
  bindTaContract: vi.fn(),
  revokeTaAccount: vi.fn(),
}));

vi.mock("../services/admin/taApi", () => mocks);

const mockTa1 = {
  id: "ta-uuid-1",
  fullName: "Lê Văn Quản Trị",
  displayName: "TA Lê",
  username: "ta_le_admin",
  role: "TOURNAMENT_ADMIN",
  stats: { elo: 1200, rankedWins: 10, rankedLosses: 2, quickWins: 3, quickLosses: 1 },
};

const mockTa2 = {
  id: "ta-uuid-2",
  fullName: "Trần Thị Trọng Tài",
  displayName: "TA Trần",
  username: "ta_tran_admin",
  role: "TOURNAMENT_ADMIN",
  stats: { elo: 1100, rankedWins: 4, rankedLosses: 2, quickWins: 0, quickLosses: 0 },
};

describe("D02-C — AdminTaPage UI Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. shows loading state while fetching TA list", () => {
    mocks.fetchTaList.mockReturnValue(new Promise(() => {})); // Never resolves
    renderWithProviders(<AdminTaPage />);

    expect(screen.getByText("Đang tải danh sách Tournament Admin...")).toBeInTheDocument();
  });

  it("2. loads and renders TA list successfully", async () => {
    mocks.fetchTaList.mockResolvedValue({ items: [mockTa1, mockTa2] });
    renderWithProviders(<AdminTaPage />);

    await waitFor(() => {
      expect(screen.getByText("Quản lý Tournament Admin (TA)")).toBeInTheDocument();
    });

    expect(screen.getByText("ta_le_admin")).toBeInTheDocument();
    expect(screen.getByText("TA Lê")).toBeInTheDocument();
    expect(screen.getByText("ta_tran_admin")).toBeInTheDocument();
    expect(screen.getByText("TA Trần")).toBeInTheDocument();
    expect(screen.getAllByText("TOURNAMENT_ADMIN")).toHaveLength(2);
  });

  it("3. renders empty state when no TAs exist", async () => {
    mocks.fetchTaList.mockResolvedValue({ items: [] });
    renderWithProviders(<AdminTaPage />);

    await waitFor(() => {
      expect(screen.getByTestId("ta-empty-state")).toBeInTheDocument();
    });
    expect(screen.getByText("Chưa có tài khoản Tournament Admin nào được tạo trong hệ thống.")).toBeInTheDocument();
  });

  it("4. handles 401 unauthenticated with login prompt", async () => {
    mocks.fetchTaList.mockRejectedValue(new ApiError("Phiên đăng nhập đã hết hạn", 401, "UNAUTHORIZED"));
    renderWithProviders(<AdminTaPage />);

    await waitFor(() => {
      expect(screen.getByTestId("ta-unauthorized")).toBeInTheDocument();
    });
    expect(screen.getByText("Yêu cầu đăng nhập")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đăng nhập ngay" })).toHaveAttribute("href", "/dang-nhap");
  });

  it("5. handles 403 forbidden when user is not SYSTEM_ADMIN", async () => {
    mocks.fetchTaList.mockRejectedValue(new ApiError("Chỉ SYSTEM_ADMIN mới có quyền", 403, "UNAUTHORIZED"));
    renderWithProviders(<AdminTaPage />);

    await waitFor(() => {
      expect(screen.getByTestId("ta-forbidden")).toBeInTheDocument();
    });
    expect(screen.getByText("Không đủ quyền hạn")).toBeInTheDocument();
    expect(screen.getByText(/Chỉ Quản trị viên hệ thống \(SYSTEM_ADMIN\)/)).toBeInTheDocument();
  });

  it("6. renders error banner on network or server failure", async () => {
    mocks.fetchTaList.mockRejectedValue(new ApiError("Lỗi kết nối máy chủ", 500, "INTERNAL_ERROR"));
    renderWithProviders(<AdminTaPage />);

    await waitFor(() => {
      expect(screen.getByTestId("ta-error-banner")).toBeInTheDocument();
    });
    expect(screen.getByText(/Lỗi kết nối máy chủ/)).toBeInTheDocument();
  });

  it("7. opens create modal, fills form, and submits new TA", async () => {
    mocks.fetchTaList.mockResolvedValue({ items: [mockTa1] });
    mocks.createTaAccount.mockResolvedValue({
      user: {
        id: "ta-new",
        fullName: "Phạm Văn Mới",
        displayName: "TA Phạm Mới",
        username: "ta_pham_moi",
      },
    });

    renderWithProviders(<AdminTaPage />);

    await waitFor(() => expect(screen.getByText("ta_le_admin")).toBeInTheDocument());

    // Click open create modal
    fireEvent.click(screen.getByTestId("open-create-ta-btn"));
    expect(screen.getByText("Tạo tài khoản Tournament Admin mới")).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByTestId("input-fullname"), { target: { value: "Phạm Văn Mới" } });
    fireEvent.change(screen.getByTestId("input-displayname"), { target: { value: "TA Phạm Mới" } });
    fireEvent.change(screen.getByTestId("input-username"), { target: { value: "ta_pham_moi" } });
    fireEvent.change(screen.getByTestId("input-password"), { target: { value: "secretPass123" } });

    // Submit form
    fireEvent.click(screen.getByTestId("submit-create-ta-btn"));

    await waitFor(() => {
      expect(mocks.createTaAccount).toHaveBeenCalledWith({
        fullName: "Phạm Văn Mới",
        displayName: "TA Phạm Mới",
        username: "ta_pham_moi",
        password: "secretPass123",
      });
    });
  });

  it("8. opens bind contract modal and calls bindTaContract", async () => {
    mocks.fetchTaList.mockResolvedValue({ items: [mockTa1] });
    mocks.bindTaContract.mockResolvedValue({
      binding: {
        id: "b-1",
        contractId: "contract-123",
        userId: "ta-uuid-1",
        status: "ACTIVE",
        grantedAt: new Date().toISOString(),
      },
    });

    renderWithProviders(<AdminTaPage />);

    await waitFor(() => expect(screen.getByText("ta_le_admin")).toBeInTheDocument());

    // Click Bind button on first TA
    fireEvent.click(screen.getByTestId("bind-btn-ta-uuid-1"));
    expect(screen.getByText(/Gán hợp đồng cho TA Lê/)).toBeInTheDocument();

    // Enter contract ID & notes
    fireEvent.change(screen.getByTestId("input-contract-id"), { target: { value: "contract-123" } });
    fireEvent.change(screen.getByTestId("input-bind-notes"), { target: { value: "Phụ trách bảng A" } });

    // Submit bind
    fireEvent.click(screen.getByTestId("submit-bind-ta-btn"));

    await waitFor(() => {
      expect(mocks.bindTaContract).toHaveBeenCalledWith("ta-uuid-1", {
        contractId: "contract-123",
        notes: "Phụ trách bảng A",
      });
    });
  });

  it("9. opens revoke confirmation modal and calls revokeTaAccount", async () => {
    mocks.fetchTaList.mockResolvedValue({ items: [mockTa1] });
    mocks.revokeTaAccount.mockResolvedValue({
      success: true,
      userId: "ta-uuid-1",
      message: "Thu hồi quyền thành công",
    });

    renderWithProviders(<AdminTaPage />);

    await waitFor(() => expect(screen.getByText("ta_le_admin")).toBeInTheDocument());

    // Click Revoke button on TA
    fireEvent.click(screen.getByTestId("revoke-btn-ta-uuid-1"));
    expect(screen.getByText("Xác nhận thu hồi quyền Tournament Admin")).toBeInTheDocument();

    // Click Confirm
    fireEvent.click(screen.getByTestId("confirm-revoke-btn"));

    await waitFor(() => {
      expect(mocks.revokeTaAccount).toHaveBeenCalledWith("ta-uuid-1");
    });
  });

  it("10. STRICT: never renders passwords, password hashes or recovery secrets", async () => {
    const taWithSuspiciousProps = {
      ...mockTa1,
      password: "SUPER_SECRET_RAW_PASSWORD",
      passwordHash: "SUPER_SECRET_PASSWORD_HASH",
      recoveryCodeHash: "SUPER_SECRET_RECOVERY_HASH",
    };
    mocks.fetchTaList.mockResolvedValue({ items: [taWithSuspiciousProps] });

    renderWithProviders(<AdminTaPage />);

    await waitFor(() => expect(screen.getByText("ta_le_admin")).toBeInTheDocument());

    // Verify secret fields are not rendered in DOM
    expect(screen.queryByText(/SUPER_SECRET/)).not.toBeInTheDocument();
    expect(screen.queryByText(/RAW_PASSWORD/)).not.toBeInTheDocument();
    expect(screen.queryByText(/PASSWORD_HASH/)).not.toBeInTheDocument();
    expect(screen.queryByText(/RECOVERY_HASH/)).not.toBeInTheDocument();
  });

  it("11. triggers bootstrap TA from empty state and reloads list", async () => {
    mocks.fetchTaList.mockResolvedValueOnce({ items: [] });
    mocks.bootstrapTaAccount.mockResolvedValue({
      user: {
        id: "ta-bootstrapped",
        fullName: "Tournament Admin",
        displayName: "Tournament Admin",
        username: "ta_bootstrapped",
      },
    });
    mocks.fetchTaList.mockResolvedValueOnce({ items: [mockTa1] });

    renderWithProviders(<AdminTaPage />);

    await waitFor(() => {
      expect(screen.getByTestId("ta-empty-state")).toBeInTheDocument();
    });

    const bootstrapBtn = screen.getByTestId("empty-bootstrap-btn");
    expect(bootstrapBtn).toBeInTheDocument();
    fireEvent.click(bootstrapBtn);

    await waitFor(() => {
      expect(mocks.bootstrapTaAccount).toHaveBeenCalledTimes(1);
      expect(mocks.fetchTaList).toHaveBeenCalledTimes(2);
    });
  });
});
