import React, { useCallback, useEffect, useState } from "react";
import type {
  AllowedMode,
  ContractPolicyEnvelope,
  CreateTournamentContractInput,
  TournamentContractDto,
  UnitDto,
} from "@ottv2/contracts";
import { ApiError } from "../../../services/http/apiError";
import {
  defaultTournamentAdminApi,
  type TournamentAdminApiPort,
} from "../services/tournamentAdminApi";

const DEFAULT_ENVELOPE: ContractPolicyEnvelope = {
  allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT", "HYBRID"],
  turnSecondsMin: 10,
  turnSecondsMax: 60,
  totalMatchSecondsMin: 120,
  totalMatchSecondsMax: 1800,
  turnLimitMin: 40,
  turnLimitMax: 240,
  allowedNoProgressPlies: [40, 60, 80],
  allowedRepetitionThresholds: [3, 4],
  allowedTieBreakPolicies: [
    "RANDOM_SEEDED",
    "BLUE_ADVANTAGE",
    "RED_ADVANTAGE",
    "REPLAY_ONCE_THEN_SEEDED",
    "MANUAL_REFEREE",
  ],
};

export interface ContractsAdminPageProps {
  api?: TournamentAdminApiPort;
}

export function ContractsAdminPage({
  api = defaultTournamentAdminApi,
}: ContractsAdminPageProps) {
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [contracts, setContracts] = useState<TournamentContractDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Create Contract Form State (F07..F16)
  const [contractCode, setContractCode] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");
  const [validFrom, setValidFrom] = useState<string>("2026-10-01T00:00:00.000Z");
  const [validTo, setValidTo] = useState<string>("2027-06-30T23:59:59.000Z");
  const [maxTournamentsTotal, setMaxTournamentsTotal] = useState<number>(5);
  const [maxParticipantsPerTournament, setMaxParticipantsPerTournament] =
    useState<number>(128);
  const [maxParticipantsTotal, setMaxParticipantsTotal] = useState<number>(500);
  const [allowedModes, setAllowedModes] = useState<AllowedMode[]>([
    "HUMAN_ONLINE",
    "BOT_VS_BOT",
  ]);
  const [initialTaUserId, setInitialTaUserId] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Selected Contract for TA Binding management
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [grantUserId, setGrantUserId] = useState<string>("");
  const [revokeReasonByUser, setRevokeReasonByUser] = useState<Record<string, string>>(
    {}
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [uRes, cRes] = await Promise.all([
        api.listUnits(),
        api.listContracts(),
      ]);
      setUnits(uRes.units);
      setContracts(cRes.contracts);
      if (!unitId && uRes.units[0]) {
        setUnitId(uRes.units[0].id);
      }
      setForbiddenError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbiddenError(err.message);
      } else {
        setErrorBanner(
          err instanceof Error
            ? err.message
            : "Không thể tải dữ liệu hợp đồng."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [api, unitId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleAllowedMode = (mode: AllowedMode) => {
    setAllowedModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode]
    );
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSuccessBanner(null);

    if (allowedModes.length === 0) {
      setErrorBanner("Vui lòng chọn ít nhất một chế độ thi đấu được phép (F14).");
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateTournamentContractInput = {
        contractCode: contractCode.trim().toUpperCase(),
        unitId,
        validFrom,
        validTo,
        maxTournamentsTotal: Number(maxTournamentsTotal),
        maxParticipantsPerTournament: Number(maxParticipantsPerTournament),
        maxParticipantsTotal: Number(maxParticipantsTotal),
        allowedModes,
        policyEnvelope: {
          ...DEFAULT_ENVELOPE,
          allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT", "HYBRID"],
        },
        technicalCaps: {
          botSourceMaxBytes: 65536,
          botRuntimeTimeoutMs: 1000,
          botMemoryLimitMb: 64,
          maxConcurrentMatchesPerTournament: 16,
          rosterImportMaxRows: 2000,
        },
        status: "ACTIVE",
        initialTaUserIds: initialTaUserId.trim()
          ? [initialTaUserId.trim()]
          : [],
      };
      const res = await api.createContract(payload);
      setContracts((prev) => [res.contract, ...prev]);
      setSelectedContractId(res.contract.id);
      setContractCode("");
      setInitialTaUserId("");
      setSuccessBanner(
        `Đã phát hành hợp đồng "${res.contract.contractCode}" thành công.`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Không thể tạo hợp đồng."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrantTa = async (contractId: string) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    if (!grantUserId.trim()) {
      setErrorBanner("Vui lòng nhập userId của Quản trị giải (TA) cần gán quyền.");
      return;
    }
    try {
      const res = await api.grantContractTa(contractId, {
        userId: grantUserId.trim(),
      });
      setContracts((prev) =>
        prev.map((c) => (c.id === contractId ? res.contract : c))
      );
      setGrantUserId("");
      setSuccessBanner(`Đã gán quyền TA cho "${grantUserId.trim()}".`);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Gán quyền TA thất bại."
      );
    }
  };

  const handleRevokeTa = async (contractId: string, targetUserId: string) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    const reason = (revokeReasonByUser[targetUserId] ?? "").trim();
    if (reason.length < 3) {
      setErrorBanner("Vui lòng nhập lý do thu hồi quyền TA (ít nhất 3 ký tự).");
      return;
    }
    try {
      const res = await api.revokeContractTa(contractId, targetUserId, {
        reason,
      });
      setContracts((prev) =>
        prev.map((c) => (c.id === contractId ? res.contract : c))
      );
      setSuccessBanner(`Đã thu hồi quyền TA của "${targetUserId}".`);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : "Thu hồi quyền TA thất bại."
      );
    }
  };

  if (forbiddenError) {
    return (
      <section aria-labelledby="p07-forbidden-heading" className="p-6">
        <div role="alert" className="rounded border border-red-500/40 bg-red-950/30 p-4">
          <h1 id="p07-forbidden-heading" className="text-lg font-bold text-red-200">
            Truy cập bị từ chối (403)
          </h1>
          <p className="mt-1 text-sm text-red-100">{forbiddenError}</p>
        </div>
      </section>
    );
  }

  const selectedContract =
    contracts.find((c) => c.id === selectedContractId) ?? contracts[0] ?? null;

  return (
    <main aria-labelledby="p07-heading" className="admin-contracts-page space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4">
        <div>
          <h1 id="p07-heading" className="text-2xl font-bold">
            Quản lý Hợp đồng, Hạn mức &amp; Gán quyền TA (P07)
          </h1>
          <p className="text-sm text-slate-300">
            Cấp hạn mức giải đấu (Quota), trần người tham gia, khung luật (Policy Envelope) và gán Quản trị giải (TA).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="rounded border border-slate-600 px-3 py-1.5 text-sm"
        >
          Làm mới
        </button>
      </header>

      {errorBanner && (
        <div
          role="alert"
          data-testid="contract-error-banner"
          className="rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200"
        >
          {errorBanner}
        </div>
      )}

      {successBanner && (
        <div
          role="status"
          aria-live="polite"
          data-testid="contract-success-banner"
          className="rounded border border-emerald-500/50 bg-emerald-950/40 p-3 text-sm text-emerald-200"
        >
          {successBanner}
        </div>
      )}

      <section
        aria-labelledby="create-contract-heading"
        className="rounded border border-slate-700 bg-slate-900/60 p-4"
      >
        <h2 id="create-contract-heading" className="mb-3 text-lg font-semibold">
          Phát hành Hợp đồng giải đấu mới (F07–F16)
        </h2>
        <form
          onSubmit={(e) => void handleCreateContract(e)}
          className="grid gap-4 md:grid-cols-3"
        >
          <div>
            <label htmlFor="contractCode-input" className="block text-sm font-medium">
              Mã hợp đồng (F07) *
            </label>
            <input
              id="contractCode-input"
              type="text"
              required
              placeholder="VD: HD_CNTT_2026"
              value={contractCode}
              onChange={(e) => setContractCode(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="contract-unit-select" className="block text-sm font-medium">
              Đơn vị chủ quản (F08) *
            </label>
            <select
              id="contract-unit-select"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            >
              <option value="">-- Chọn đơn vị --</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.unitCode} — {u.unitName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="initialTa-input" className="block text-sm font-medium">
              Gán TA khởi tạo (Tùy chọn)
            </label>
            <input
              id="initialTa-input"
              type="text"
              placeholder="VD: ta-user-01"
              value={initialTaUserId}
              onChange={(e) => setInitialTaUserId(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="validFrom-input" className="block text-sm font-medium">
              Hiệu lực từ (F09 ISO) *
            </label>
            <input
              id="validFrom-input"
              type="text"
              required
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="validTo-input" className="block text-sm font-medium">
              Hiệu lực đến (F10 ISO) *
            </label>
            <input
              id="validTo-input"
              type="text"
              required
              value={validTo}
              onChange={(e) => setValidTo(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="maxTournamentsTotal-input" className="block text-sm font-medium">
              Tổng hạn mức số giải (F11) *
            </label>
            <input
              id="maxTournamentsTotal-input"
              type="number"
              min={1}
              max={1000}
              required
              value={maxTournamentsTotal}
              onChange={(e) => setMaxTournamentsTotal(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="maxParticipantsPerTournament-input"
              className="block text-sm font-medium"
            >
              Trần người/giải (F12) *
            </label>
            <input
              id="maxParticipantsPerTournament-input"
              type="number"
              min={2}
              max={2000}
              required
              value={maxParticipantsPerTournament}
              onChange={(e) =>
                setMaxParticipantsPerTournament(Number(e.target.value))
              }
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="maxParticipantsTotal-input" className="block text-sm font-medium">
              Tổng trần người toàn HĐ (F13) *
            </label>
            <input
              id="maxParticipantsTotal-input"
              type="number"
              min={2}
              max={50000}
              required
              value={maxParticipantsTotal}
              onChange={(e) => setMaxParticipantsTotal(Number(e.target.value))}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <fieldset className="space-y-1">
            <legend className="text-sm font-medium">Chế độ cho phép (F14) *</legend>
            <div className="flex flex-wrap gap-3 pt-1 text-xs">
              {(["HUMAN_ONLINE", "BOT_VS_BOT", "HYBRID"] as AllowedMode[]).map(
                (mode) => (
                  <label key={mode} className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={allowedModes.includes(mode)}
                      onChange={() => handleToggleAllowedMode(mode)}
                    />
                    <span>{mode}</span>
                  </label>
                )
              )}
            </div>
          </fieldset>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {submitting ? "Đang phát hành..." : "Phát hành hợp đồng"}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="contracts-list-heading" className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 id="contracts-list-heading" className="text-lg font-semibold">
            Danh sách Hợp đồng ({contracts.length})
          </h2>
          {loading ? (
            <p role="status" className="text-sm text-slate-400">
              Đang tải hợp đồng...
            </p>
          ) : contracts.length === 0 ? (
            <div className="rounded border border-slate-800 p-4 text-sm text-slate-400">
              Chưa có hợp đồng nào được phát hành.
            </div>
          ) : (
            <div className="space-y-3">
              {contracts.map((c) => (
                <article
                  key={c.id}
                  data-testid={`contract-card-${c.contractCode}`}
                  className={`rounded border p-4 ${
                    selectedContract?.id === c.id
                      ? "border-cyan-500 bg-slate-900"
                      : "border-slate-700 bg-slate-950/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold">{c.contractCode}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        ({c.unitCode ?? c.unitId})
                      </span>
                    </div>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-semibold">
                      {c.status}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div data-testid={`quota-summary-${c.contractCode}`}>
                      Hạn mức giải (Quota):{" "}
                      <strong>
                        Đã giữ {c.quotaReservedCount}/{c.maxTournamentsTotal}
                      </strong>{" "}
                      (Còn lại: {c.quotaRemainingCount})
                    </div>
                    <div>
                      Trần người tham gia:{" "}
                      <strong>
                        {c.currentParticipantsTotal}/{c.maxParticipantsTotal}
                      </strong>{" "}
                      (Tối đa {c.maxParticipantsPerTournament}/giải)
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectedContractId(c.id)}
                      className="rounded border border-slate-600 px-2.5 py-1 text-xs"
                    >
                      Quản lý TA &amp; Envelope ({c.taBindings.length} TA)
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {selectedContract && (
          <aside
            aria-labelledby="ta-binding-heading"
            className="space-y-4 rounded border border-slate-700 bg-slate-900/50 p-4"
          >
            <h2 id="ta-binding-heading" className="text-lg font-semibold">
              Quản trị giải (TA) &amp; Khung luật — {selectedContract.contractCode}
            </h2>

            <div className="rounded border border-slate-800 bg-slate-950 p-3 text-xs text-slate-300">
              <div className="font-semibold text-slate-200">
                Khung luật hợp đồng (Policy Envelope F15):
              </div>
              <p className="mt-1">
                Lượt đi: {selectedContract.policyEnvelope.turnSecondsMin}s–
                {selectedContract.policyEnvelope.turnSecondsMax}s | Tổng trận:{" "}
                {selectedContract.policyEnvelope.totalMatchSecondsMin}s–
                {selectedContract.policyEnvelope.totalMatchSecondsMax}s | Trần lượt:{" "}
                {selectedContract.policyEnvelope.turnLimitMin}–
                {selectedContract.policyEnvelope.turnLimitMax}
              </p>
              <p className="mt-1">
                Trần kỹ thuật Bot: tối đa{" "}
                {selectedContract.technicalCaps.botSourceMaxBytes} bytes, timeout{" "}
                {selectedContract.technicalCaps.botRuntimeTimeoutMs}ms, bộ nhớ{" "}
                {selectedContract.technicalCaps.botMemoryLimitMb}MB
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="grant-ta-input" className="block text-sm font-medium">
                Gán thêm Quản trị giải (TA) vào hợp đồng
              </label>
              <div className="flex gap-2">
                <input
                  id="grant-ta-input"
                  type="text"
                  placeholder="Nhập userId của TA..."
                  value={grantUserId}
                  onChange={(e) => setGrantUserId(e.target.value)}
                  className="flex-1 rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => void handleGrantTa(selectedContract.id)}
                  className="rounded bg-cyan-600 px-3 py-1.5 text-sm font-semibold text-white"
                >
                  Gán quyền TA
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Danh sách TA trên hợp đồng ({selectedContract.taBindings.length})
              </h3>
              {selectedContract.taBindings.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Chưa có Quản trị giải (TA) nào được gán trên hợp đồng này.
                </p>
              ) : (
                <ul className="space-y-2">
                  {selectedContract.taBindings.map((b) => (
                    <li
                      key={b.id}
                      data-testid={`ta-binding-${b.userId}`}
                      className="rounded border border-slate-800 bg-slate-950 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold">{b.userId}</span>
                        <span className="rounded bg-slate-800 px-2 py-0.5">
                          {b.status}
                        </span>
                      </div>

                      {b.status === "ACTIVE" ? (
                        <div className="mt-2 flex gap-2">
                          <label htmlFor={`revoke-reason-${b.userId}`} className="sr-only">
                            Lý do thu hồi quyền TA {b.userId}
                          </label>
                          <input
                            id={`revoke-reason-${b.userId}`}
                            type="text"
                            placeholder="Nhập lý do thu hồi TA..."
                            value={revokeReasonByUser[b.userId] ?? ""}
                            onChange={(e) =>
                              setRevokeReasonByUser((prev) => ({
                                ...prev,
                                [b.userId]: e.target.value,
                              }))
                            }
                            className="flex-1 rounded border border-slate-700 bg-slate-900 px-2 py-1"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              void handleRevokeTa(selectedContract.id, b.userId)
                            }
                            className="rounded border border-red-500/50 px-2.5 py-1 text-red-300"
                          >
                            Thu hồi TA
                          </button>
                        </div>
                      ) : (
                        <p className="mt-1 text-slate-400">
                          Đã thu hồi: {b.revokeReason ?? "Không có ghi chú"}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
      </section>
    </main>
  );
}

export default ContractsAdminPage;
