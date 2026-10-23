import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { AccountActivationPage } from "./AccountActivationPage";
import type { ActivationApi } from "../services/roster/activationApi";

function createMockApi(overrides: Partial<ActivationApi> = {}): ActivationApi {
  return {
    claim: vi.fn().mockResolvedValue({
      success: true,
      enrollmentId: "enr-1",
      userId: "u-1",
      username: "alex_chan",
      displayName: "Alex Chan",
      personKey: "KHOA_CNTT:SV001",
      claimedAt: "2026-10-23T08:00:00.000Z",
      outcome: "NEWLY_ACTIVATED" as const,
    }),
    setupCredential: vi.fn().mockResolvedValue({
      success: true,
      userId: "u-1",
      username: "alex_chan",
      status: "ACTIVE" as const,
      recoveryCode: "RC-9988-7766-5544",
      completedAt: "2026-10-23T08:05:00.000Z",
    }),
    ...overrides,
  };
}

describe("P13 AccountActivationPage", () => {
  it("renders activation form with initial inputs", async () => {
    const api = createMockApi();
    renderWithProviders(<AccountActivationPage apiClient={api} />);

    expect(await screen.findByTestId("account-activation-card")).toBeInTheDocument();
    expect(screen.getByTestId("claim-token-input")).toBeInTheDocument();
    expect(screen.getByTestId("activation-username-input")).toBeInTheDocument();
    expect(screen.getByTestId("activation-display-name-input")).toBeInTheDocument();
  });

  it("pre-fills token when provided via props or url", async () => {
    const api = createMockApi();
    renderWithProviders(<AccountActivationPage apiClient={api} token="PREFILLED-TOKEN" />);

    expect(screen.getByTestId("claim-token-input")).toHaveValue("PREFILLED-TOKEN");
  });

  it("walks through step 1 claim and step 2 password setup to completion", async () => {
    const api = createMockApi();
    renderWithProviders(<AccountActivationPage apiClient={api} token="TEST-TOKEN-123" />);

    // Step 1: Fill username & display name
    await userEvent.type(screen.getByTestId("activation-username-input"), "alex_chan");
    await userEvent.type(screen.getByTestId("activation-display-name-input"), "Alex Chan");
    await userEvent.click(screen.getByTestId("claim-submit-btn"));

    // Verify claim called with token, username, display name (NO password)
    await waitFor(() => {
      expect(api.claim).toHaveBeenCalledWith({
        claimToken: "TEST-TOKEN-123",
        username: "alex_chan",
        displayName: "Alex Chan",
      });
    });

    // Step 2: Set password
    expect(await screen.findByTestId("activation-password-input")).toBeInTheDocument();
    await userEvent.type(screen.getByTestId("activation-password-input"), "SecurePass123!");
    await userEvent.type(screen.getByTestId("activation-confirm-password-input"), "SecurePass123!");
    await userEvent.click(screen.getByTestId("password-submit-btn"));

    // Verify setupCredential called
    await waitFor(() => {
      expect(api.setupCredential).toHaveBeenCalledWith({
        claimToken: "TEST-TOKEN-123",
        password: "SecurePass123!",
      });
    });

    // Step 3: Success screen
    expect(await screen.findByTestId("activation-success-panel")).toBeInTheDocument();
    expect(screen.getByTestId("recovery-code-value")).toHaveTextContent("RC-9988-7766-5544");
    expect(screen.getByTestId("activation-login-btn")).toBeInTheDocument();
  });

  it("displays error message when token claim is rejected", async () => {
    const api = createMockApi({
      claim: vi.fn().mockRejectedValue(new Error("Mã kích hoạt đã hết hạn.")),
    });
    renderWithProviders(<AccountActivationPage apiClient={api} token="EXPIRED-TOKEN" />);

    await userEvent.type(screen.getByTestId("activation-username-input"), "valid_user");
    await userEvent.type(screen.getByTestId("activation-display-name-input"), "Valid Name");
    await userEvent.click(screen.getByTestId("claim-submit-btn"));

    expect(await screen.findByTestId("activation-error")).toHaveTextContent("Mã kích hoạt đã hết hạn.");
  });

  it("validates password confirmation match in step 2", async () => {
    const api = createMockApi();
    renderWithProviders(<AccountActivationPage apiClient={api} token="VALID-TOKEN" />);

    await userEvent.type(screen.getByTestId("activation-username-input"), "valid_user");
    await userEvent.type(screen.getByTestId("activation-display-name-input"), "Valid Name");
    await userEvent.click(screen.getByTestId("claim-submit-btn"));

    expect(await screen.findByTestId("activation-password-input")).toBeInTheDocument();
    await userEvent.type(screen.getByTestId("activation-password-input"), "Password123!");
    await userEvent.type(screen.getByTestId("activation-confirm-password-input"), "DifferentPass123!");
    await userEvent.click(screen.getByTestId("password-submit-btn"));

    expect(await screen.findByTestId("activation-error")).toHaveTextContent("Mật khẩu xác nhận không khớp.");
    expect(api.setupCredential).not.toHaveBeenCalled();
  });
});
