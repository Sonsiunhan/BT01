import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RulesAcknowledgementPage } from "./RulesAcknowledgementPage";
import type { RulesAcknowledgementApi } from "./rulesAcknowledgementApi";
import type { RulesAcknowledgementStatus } from "@ottv2/contracts";

const scope = { contractId: "contract-1", tournamentId: "tournament-1" };

function status(overrides: Partial<RulesAcknowledgementStatus> = {}): RulesAcknowledgementStatus {
  return {
    ...scope,
    configVersionId: "version-2",
    versionNumber: 2,
    effectiveAt: "2026-10-23T00:00:00.000Z",
    regulationsFull: "Điều lệ phiên bản hiện hành.",
    rulesQuickSummary: "Tóm tắt điều lệ.",
    required: true,
    satisfied: false,
    evidence: null,
    ...overrides,
  };
}

function api(initial = status()): RulesAcknowledgementApi {
  return {
    getStatus: vi.fn().mockResolvedValue(initial),
    acknowledge: vi.fn().mockResolvedValue(status({ satisfied: true, evidence: {
      id: "evidence-1", userId: "server-user", ...scope, configVersionId: "version-2",
      acknowledgedAt: "2026-10-23T00:00:01.000Z", evidenceKind: "AUTHENTICATED_EXPLICIT_ACK",
    } })),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("D08-C regulation acknowledgement UI", () => {
  it("loads and displays the authoritative current regulation/version", async () => {
    render(<RulesAcknowledgementPage {...scope} apiClient={api()} />);
    expect(await screen.findByText("Điều lệ phiên bản hiện hành.")).toBeInTheDocument();
    expect(screen.getByTestId("rules-version")).toHaveTextContent("2");
  });

  it("renders the current acknowledged status", async () => {
    render(<RulesAcknowledgementPage {...scope} apiClient={api(status({ satisfied: true }))} />);
    expect(await screen.findByTestId("rules-ack-status")).toHaveTextContent("Đã xác nhận");
  });

  it("shows acknowledgement required for an unacknowledged current version", async () => {
    render(<RulesAcknowledgementPage {...scope} apiClient={api()} />);
    expect(await screen.findByRole("button", { name: "Xác nhận điều lệ phiên bản hiện hành" })).toBeInTheDocument();
  });

  it("acknowledges the exact current version", async () => {
    const client = api();
    render(<RulesAcknowledgementPage {...scope} apiClient={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Xác nhận điều lệ phiên bản hiện hành" }));
    expect(client.acknowledge).toHaveBeenCalledWith(scope.contractId, scope.tournamentId, "version-2");
  });

  it("updates from the authoritative server response after acknowledgement", async () => {
    const client = api();
    render(<RulesAcknowledgementPage {...scope} apiClient={client} />);
    await userEvent.click(await screen.findByRole("button", { name: "Xác nhận điều lệ phiên bản hiện hành" }));
    expect(await screen.findByTestId("rules-ack-status")).toHaveTextContent("Đã xác nhận");
    expect(screen.queryByRole("button", { name: "Xác nhận điều lệ phiên bản hiện hành" })).not.toBeInTheDocument();
  });

  it("renders an already-acknowledged current version without an action", async () => {
    render(<RulesAcknowledgementPage {...scope} apiClient={api(status({ satisfied: true }))} />);
    await screen.findByTestId("rules-ack-status");
    expect(screen.queryByRole("button", { name: "Xác nhận điều lệ phiên bản hiện hành" })).not.toBeInTheDocument();
  });

  it("does not treat an old-version acknowledgement as satisfying the new version", async () => {
    render(<RulesAcknowledgementPage {...scope} apiClient={api(status({ configVersionId: "version-3", versionNumber: 3, satisfied: false, evidence: null }))} />);
    expect(await screen.findByRole("button", { name: "Xác nhận điều lệ phiên bản hiện hành" })).toBeInTheDocument();
    expect(screen.getByTestId("rules-version")).toHaveTextContent("3");
  });

  it("shows a loading state", () => {
    const pending = new Promise<RulesAcknowledgementStatus>(() => undefined);
    render(<RulesAcknowledgementPage {...scope} apiClient={{ ...api(), getStatus: vi.fn().mockReturnValue(pending) }} />);
    expect(screen.getByTestId("rules-loading")).toBeInTheDocument();
  });

  it("shows a server error and retries", async () => {
    const client = api();
    vi.mocked(client.getStatus).mockRejectedValueOnce(new Error("Máy chủ tạm thời chưa sẵn sàng.")).mockResolvedValueOnce(status());
    render(<RulesAcknowledgementPage {...scope} apiClient={client} />);
    expect(await screen.findByTestId("rules-error")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(client.getStatus).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Điều lệ phiên bản hiện hành.")).toBeInTheDocument();
  });

  it("does not let the client choose another user identity", async () => {
    const client = api();
    render(<RulesAcknowledgementPage {...scope} apiClient={client} />);
    await screen.findByTestId("rules-ack-status");
    expect(client.getStatus).toHaveBeenCalledWith(scope.contractId, scope.tournamentId);
    expect(client.acknowledge).not.toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), expect.anything());
  });

  it("does not render raw tokens or hashes", async () => {
    const client = api(status({ regulationsFull: "Điều lệ an toàn", evidence: null }));
    render(<RulesAcknowledgementPage {...scope} apiClient={client} />);
    await screen.findByText("Điều lệ an toàn");
    expect(screen.queryByText(/raw-token|token-hash|password-hash/i)).not.toBeInTheDocument();
  });

  it("does not persist acknowledgement state as browser authority", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<RulesAcknowledgementPage {...scope} apiClient={api(status({ satisfied: true }))} />);
    await screen.findByTestId("rules-ack-status");
    expect(setItem).not.toHaveBeenCalled();
  });

  it("renders only privacy-minimized regulation evidence", async () => {
    render(<RulesAcknowledgementPage {...scope} apiClient={api(status({ evidence: {
      id: "evidence-1", userId: "private-user", ...scope, configVersionId: "version-2",
      acknowledgedAt: "2026-10-23T00:00:01.000Z", evidenceKind: "AUTHENTICATED_EXPLICIT_ACK",
    } }))} />);
    await screen.findByTestId("rules-ack-status");
    expect(screen.queryByText("private-user")).not.toBeInTheDocument();
    expect(screen.getByTestId("rules-version")).toHaveTextContent("2");
  });

  it("represents pending Long admission consumer integration safely", async () => {
    render(<RulesAcknowledgementPage {...scope} apiClient={api()} />);
    expect(await screen.findByTestId("ack-consumer-pending")).toHaveTextContent("đang chờ Long");
  });
});
