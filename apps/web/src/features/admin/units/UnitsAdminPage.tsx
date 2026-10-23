import React, { useCallback, useEffect, useState } from "react";
import type {
  CreateUnitInput,
  UnitDto,
  UnitStatus,
  UnitType,
} from "@ottv2/contracts";
import { ApiError } from "../../../services/http/apiError";
import { safeErrorMessage } from "../../../services/http/safeErrorMessage";
import {
  defaultTournamentAdminApi,
  type TournamentAdminApiPort,
} from "../services/tournamentAdminApi";

const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  KHOA: "Khoa",
  VIEN: "Viện",
  CLB: "Câu lạc bộ",
  DOAN_HOI: "Đoàn - Hội",
  DOI_TAC: "Đối tác",
  KHAC: "Khác",
};

const UNIT_STATUS_LABELS: Record<UnitStatus, string> = {
  ACTIVE: "Đang hoạt động",
  INACTIVE: "Tạm ngưng",
  SUSPENDED: "Đình chỉ",
};

export interface UnitsAdminPageProps {
  api?: TournamentAdminApiPort;
}

export function UnitsAdminPage({
  api = defaultTournamentAdminApi,
}: UnitsAdminPageProps) {
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [forbiddenError, setForbiddenError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Form state (F01..F06)
  const [unitCode, setUnitCode] = useState<string>("");
  const [unitName, setUnitName] = useState<string>("");
  const [unitType, setUnitType] = useState<UnitType>("KHOA");
  const [contactName, setContactName] = useState<string>("");
  const [contactEmail, setContactEmail] = useState<string>("");
  const [status, setStatus] = useState<UnitStatus>("ACTIVE");
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadUnits = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const res = await api.listUnits();
      setUnits(res.units);
      setForbiddenError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbiddenError(safeErrorMessage(err, "Bạn không có quyền xem danh sách đơn vị."));
      } else {
        setErrorBanner(safeErrorMessage(err, "Không thể tải danh sách đơn vị."));
      }
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  const handleCreateUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);
    setSuccessBanner(null);

    const trimmedCode = unitCode.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,32}$/.test(trimmedCode)) {
      setErrorBanner(
        "Mã đơn vị (F01) phải gồm 2-32 ký tự chữ in hoa A-Z, số 0-9, gạch ngang (-) hoặc gạch dưới (_)."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload: CreateUnitInput = {
        unitCode: trimmedCode,
        unitName: unitName.trim(),
        unitType,
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        status,
      };
      const res = await api.createUnit(payload);
      setUnits((prev) => [res.unit, ...prev]);
      setUnitCode("");
      setUnitName("");
      setContactName("");
      setContactEmail("");
      setSuccessBanner(`Đã tạo đơn vị "${res.unit.unitCode}" thành công.`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbiddenError(safeErrorMessage(err, "Bạn không có quyền tạo đơn vị."));
      } else {
        setErrorBanner(safeErrorMessage(err, "Tạo đơn vị thất bại."));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (unit: UnitDto, nextStatus: UnitStatus) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      const res = await api.updateUnit(unit.id, { status: nextStatus });
      setUnits((prev) => prev.map((u) => (u.id === unit.id ? res.unit : u)));
      setSuccessBanner(
        `Đã cập nhật trạng thái đơn vị "${unit.unitCode}" sang ${UNIT_STATUS_LABELS[nextStatus]}.`
      );
    } catch (err) {
      setErrorBanner(safeErrorMessage(err, "Cập nhật trạng thái thất bại."));
    }
  };

  const handleDeleteUnit = async (unit: UnitDto) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    try {
      await api.deleteUnit(unit.id);
      setUnits((prev) => prev.filter((u) => u.id !== unit.id));
      setSuccessBanner(`Đã xóa đơn vị "${unit.unitCode}".`);
    } catch (err) {
      setErrorBanner(safeErrorMessage(err, "Không thể xóa đơn vị đang được tham chiếu."));
    }
  };

  if (forbiddenError) {
    return (
      <section aria-labelledby="p06-forbidden-heading" className="admin-page p-6">
        <div role="alert" className="rounded border border-red-500/40 bg-red-950/30 p-4">
          <h1 id="p06-forbidden-heading" className="text-lg font-bold text-red-200">
            Truy cập bị từ chối (403)
          </h1>
          <p className="mt-1 text-sm text-red-100">{forbiddenError}</p>
        </div>
      </section>
    );
  }

  const filteredUnits = units.filter((u) => {
    if (statusFilter !== "ALL" && u.status !== statusFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      u.unitCode.toLowerCase().includes(q) ||
      u.unitName.toLowerCase().includes(q) ||
      u.contactEmail.toLowerCase().includes(q)
    );
  });

  return (
    <main aria-labelledby="p06-heading" className="admin-units-page space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 pb-4">
        <div>
          <h1 id="p06-heading" className="text-2xl font-bold">
            Quản lý Đơn vị &amp; Tổ chức (P06)
          </h1>
          <p className="text-sm text-slate-300">
            Khởi tạo và quản trị danh mục Đơn vị chủ quản phục vụ cấp Hợp đồng giải đấu.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadUnits()}
          className="rounded border border-slate-600 px-3 py-1.5 text-sm"
        >
          Làm mới danh sách
        </button>
      </header>

      {errorBanner && (
        <div
          role="alert"
          data-testid="unit-error-banner"
          className="rounded border border-red-500/50 bg-red-950/40 p-3 text-sm text-red-200"
        >
          {errorBanner}
        </div>
      )}

      {successBanner && (
        <div
          role="status"
          aria-live="polite"
          data-testid="unit-success-banner"
          className="rounded border border-emerald-500/50 bg-emerald-950/40 p-3 text-sm text-emerald-200"
        >
          {successBanner}
        </div>
      )}

      <section
        aria-labelledby="create-unit-heading"
        className="rounded border border-slate-700 bg-slate-900/60 p-4"
      >
        <h2 id="create-unit-heading" className="mb-3 text-lg font-semibold">
          Thêm Đơn vị mới (F01–F06)
        </h2>
        <form onSubmit={(e) => void handleCreateUnit(e)} className="grid gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="unitCode-input" className="block text-sm font-medium">
              Mã đơn vị (F01) *
            </label>
            <input
              id="unitCode-input"
              name="unitCode"
              type="text"
              required
              placeholder="VD: KHOA_CNTT"
              value={unitCode}
              onChange={(e) => setUnitCode(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="unitName-input" className="block text-sm font-medium">
              Tên đơn vị (F02) *
            </label>
            <input
              id="unitName-input"
              name="unitName"
              type="text"
              required
              placeholder="VD: Khoa Công nghệ Thông tin"
              value={unitName}
              onChange={(e) => setUnitName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="unitType-select" className="block text-sm font-medium">
              Loại hình đơn vị (F03) *
            </label>
            <select
              id="unitType-select"
              name="unitType"
              value={unitType}
              onChange={(e) => setUnitType(e.target.value as UnitType)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            >
              {Object.entries(UNIT_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label} ({k})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="contactName-input" className="block text-sm font-medium">
              Người liên hệ (F04) *
            </label>
            <input
              id="contactName-input"
              name="contactName"
              type="text"
              required
              placeholder="VD: Nguyễn Văn A"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="contactEmail-input" className="block text-sm font-medium">
              Email liên hệ (F05) *
            </label>
            <input
              id="contactEmail-input"
              name="contactEmail"
              type="email"
              required
              placeholder="VD: cntt@example.edu.vn"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label htmlFor="unitStatus-select" className="block text-sm font-medium">
              Trạng thái (F06)
            </label>
            <select
              id="unitStatus-select"
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as UnitStatus)}
              className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            >
              {Object.entries(UNIT_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
            >
              {submitting ? "Đang lưu..." : "Tạo đơn vị"}
            </button>
          </div>
        </form>
      </section>

      <section aria-labelledby="units-list-heading" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="units-list-heading" className="text-lg font-semibold">
            Danh sách Đơn vị ({filteredUnits.length})
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="unit-search" className="sr-only">
              Tìm kiếm đơn vị
            </label>
            <input
              id="unit-search"
              type="search"
              placeholder="Tìm mã, tên hoặc email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            />
            <label htmlFor="unit-filter-status" className="sr-only">
              Lọc theo trạng thái
            </label>
            <select
              id="unit-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded border border-slate-600 bg-slate-950 px-3 py-1.5 text-sm"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
              <option value="INACTIVE">Tạm ngưng (INACTIVE)</option>
              <option value="SUSPENDED">Đình chỉ (SUSPENDED)</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p role="status" className="text-sm text-slate-400">
            Đang tải danh sách đơn vị...
          </p>
        ) : filteredUnits.length === 0 ? (
          <div className="rounded border border-slate-800 p-6 text-center text-sm text-slate-400">
            Chưa có đơn vị nào phù hợp với bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-slate-700">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-slate-900 text-xs uppercase text-slate-300">
                <tr>
                  <th className="p-3">Mã đơn vị</th>
                  <th className="p-3">Tên đơn vị</th>
                  <th className="p-3">Loại</th>
                  <th className="p-3">Liên hệ</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3">Tham chiếu</th>
                  <th className="p-3">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredUnits.map((u) => {
                  const isReferenced =
                    u.referencedContractsCount > 0 ||
                    u.referencedTournamentsCount > 0;
                  return (
                    <tr key={u.id} data-testid={`unit-row-${u.unitCode}`}>
                      <td className="p-3 font-mono font-semibold">{u.unitCode}</td>
                      <td className="p-3">{u.unitName}</td>
                      <td className="p-3">{UNIT_TYPE_LABELS[u.unitType]}</td>
                      <td className="p-3">
                        <div>{u.contactName}</div>
                        <div className="text-xs text-slate-400">{u.contactEmail}</div>
                      </td>
                      <td className="p-3">
                        <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-medium">
                          {UNIT_STATUS_LABELS[u.status]} ({u.status})
                        </span>
                      </td>
                      <td className="p-3 text-xs">
                        {u.referencedContractsCount} hợp đồng /{" "}
                        {u.referencedTournamentsCount} giải đấu
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {u.status !== "ACTIVE" ? (
                            <button
                              type="button"
                              onClick={() => void handleToggleStatus(u, "ACTIVE")}
                              className="rounded border border-emerald-500/40 px-2 py-1 text-xs text-emerald-300"
                            >
                              Kích hoạt
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void handleToggleStatus(u, "INACTIVE")}
                              className="rounded border border-amber-500/40 px-2 py-1 text-xs text-amber-300"
                            >
                              Tạm ngưng
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => void handleDeleteUnit(u)}
                            title={
                              isReferenced
                                ? "Đơn vị đã có Hợp đồng/Giải đấu tham chiếu — hệ thống sẽ chặn xóa vật lý."
                                : "Xóa đơn vị chưa có tham chiếu"
                            }
                            className="rounded border border-red-500/40 px-2 py-1 text-xs text-red-300"
                          >
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default UnitsAdminPage;
