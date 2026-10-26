import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BotReadinessJob, BotReadinessSnapshot } from "@ottv2/contracts";

import BotReadinessPage from "./BotReadinessPage";

const now = "2026-10-23T08:00:00.000Z";
const target = {
  targetContextRef: "brt_aaaaaaaaaaaaaaaaaaaaaaaa",
  configVersionNumber: 2,
  ruleVersion: "rps-v1",
  sdkVersion: "bot-sdk-v1",
  schemaVersion: "bot-state-v1",
  runtimeProfile: "WASMTIME_SUPERVISOR" as const,
  policyVersion: "policy-v1",
  sourceDigestPrefix: "aaaaaaaaaaaa",
};

function item(overrides: Record<string, unknown> = {}) {
  return {
    enrollmentId: "enrollment-1",
    tournamentId: "t-1",
    personKey: "SV001",
    displayName: "Nguyễn An",
    status: "READY" as const,
    revision: 3,
    botId: "bot-1",
    revisionId: "revision-1",
    revisionNumber: 4,
    target,
    receipt: { receiptId: "11111111-1111-4111-8111-111111111111", outcome: "ACCEPTED" as const, code: "READY" as const, completedAt: now, safeMessage: "Bot đã sẵn sàng." },
    safeReason: "READY" as const,
    retryable: false,
    retryAfterMs: null,
    permittedActions: { canSelect: false, canRecheck: true },
    updatedAt: now,
    ...overrides,
  };
}

function snapshot(overrides: Partial<BotReadinessSnapshot> = {}): BotReadinessSnapshot {
  return {
    tournamentId: "t-1",
    applicable: true,
    notApplicableMessage: null,
    items: [item()] as BotReadinessSnapshot["items"],
    nextCursor: null,
    evaluatedAt: now,
    ...overrides,
  };
}

function job(overrides: Partial<BotReadinessJob> = {}): BotReadinessJob {
  return {
    jobId: "22222222-2222-4222-8222-222222222222",
    tournamentId: "t-1",
    enrollmentId: "enrollment-1",
    targetContextRef: target.targetContextRef,
    state: "SUCCEEDED",
    status: "READY",
    retryable: false,
    retryAfterMs: null,
    safeReason: "READY",
    receipt: item().receipt,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    ...overrides,
  };
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderPage(tournamentId = "t-1") {
  return render(
    <MemoryRouter initialEntries={[`/admin/tournaments/${tournamentId}/bot-readiness`]}>
      <Routes><Route path="/admin/tournaments/:tournamentId/bot-readiness" element={<BotReadinessPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe("P16 — BotReadinessPage", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders only the safe target projection and passes server-side filter/pagination arguments", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ snapshot: snapshot({ nextCursor: "50" }) }))
      .mockResolvedValueOnce(response({ snapshot: snapshot({ items: [item({ enrollmentId: "enrollment-2", displayName: "Trần Bình", personKey: "SV002" })], nextCursor: null }) }))
      .mockResolvedValueOnce(response({ snapshot: snapshot({ items: [item({ enrollmentId: "enrollment-3", displayName: "Lê Chi", personKey: "SV003" })] }) }));

    renderPage();
    await screen.findByRole("heading", { name: "Danh sách readiness" });
    expect(screen.getByText("Nguyễn An")).toBeInTheDocument();
    expect(screen.getByText("aaaaaaaaaaaa")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("privateLog");

    fireEvent.click(screen.getByRole("button", { name: "Tải thêm đăng ký" }));
    await screen.findByText("Trần Bình");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("cursor=50");

    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "READY" } });
    await screen.findByText("Lê Chi");
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("status=READY");
  });

  it("submits a recheck command, follows its terminal job, and refreshes the authoritative row", async () => {
    fetchMock
      .mockResolvedValueOnce(response({ snapshot: snapshot() }))
      .mockResolvedValueOnce(response({ item: item({ status: "PENDING", safeReason: "CHECK_QUEUED" }), job: job() }, 202))
      .mockResolvedValueOnce(response({ snapshot: snapshot({ items: [item({ receipt: { receiptId: "33333333-3333-4333-8333-333333333333", outcome: "ACCEPTED", code: "READY", completedAt: now, safeMessage: "Đã kiểm tra lại thành công." } })] }) }));

    renderPage();
    await screen.findByRole("button", { name: "Kiểm tra lại" });
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại" }));
    await screen.findByText("Đã kiểm tra lại thành công.");

    const request = fetchMock.mock.calls[1];
    expect(String(request?.[0])).toContain("/api/tournaments/t-1/bot-readiness/rechecks");
    expect(request?.[1]).toMatchObject({ method: "POST", credentials: "include" });
    expect((request?.[1] as RequestInit).headers).toMatchObject({ "X-OTT-Request": "1" });
    expect(JSON.parse(String((request?.[1] as RequestInit).body))).toMatchObject({ enrollmentId: "enrollment-1", expectedEnrollmentRevision: 3 });
  });

  it("renders the typed not-applicable state for Human–Human tournaments", async () => {
    fetchMock.mockResolvedValueOnce(response({ snapshot: snapshot({ tournamentId: "human-1", applicable: false, notApplicableMessage: "Giải Người–Người không yêu cầu Bot readiness.", items: [] }) }));
    renderPage("human-1");
    await screen.findByRole("heading", { name: "Không áp dụng cho giải này" });
    expect(screen.getByText(/không yêu cầu Bot readiness/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kiểm tra lại" })).not.toBeInTheDocument();
  });

  it("shows forbidden state and sends safe focus to its recovery heading", async () => {
    fetchMock.mockResolvedValueOnce(response({ code: "UNAUTHORIZED" }, 403));
    renderPage();
    const heading = await screen.findByRole("heading", { name: "Không có quyền truy cập" });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.getByRole("link", { name: "Về danh sách giải" })).toBeInTheDocument();
  });
});
