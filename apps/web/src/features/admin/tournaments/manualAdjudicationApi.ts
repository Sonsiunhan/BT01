import {
  ManualAdjudicationViewSchema,
  SubmitManualAdjudicationVerdictInputSchema,
  type ManualAdjudicationViewDto,
  type SubmitManualAdjudicationVerdictInput,
} from "@ottv2/contracts";

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
const api = (path: string) => `${apiBase}${path}`;

export class ManualAdjudicationHttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ManualAdjudicationHttpError";
  }
}

function messageFor(status: number): string {
  if (status === 401) return "Phiên làm việc đã hết hạn. Hãy đăng nhập lại.";
  if (status === 403) return "Chỉ quản trị giải sở hữu giải mới được xem và phân xử exact-tie.";
  if (status === 409) return "Trạng thái trận đã thay đổi hoặc hết hạn. Hãy tải lại danh sách.";
  return "Không thể kết nối dịch vụ phân xử. Hãy thử lại.";
}

async function responseError(response: Response): Promise<never> {
  const payload = await response.json().catch(() => ({})) as { message?: string };
  throw new ManualAdjudicationHttpError(response.status, payload.message ?? messageFor(response.status));
}

export async function listManualAdjudications(tournamentId: string): Promise<ManualAdjudicationViewDto[]> {
  const response = await fetch(api(`/api/tournaments/${encodeURIComponent(tournamentId)}/adjudications`), {
    headers: { Accept: "application/json", "X-OTT-Request": "1" },
    credentials: "include",
  });
  if (!response.ok) await responseError(response);
  const payload = await response.json() as { adjudications?: unknown };
  if (!Array.isArray(payload.adjudications)) throw new Error("Máy chủ trả về dữ liệu phân xử không hợp lệ.");
  return payload.adjudications.map((value) => ManualAdjudicationViewSchema.parse(value));
}

export async function submitManualAdjudicationVerdict(
  adjudicationRequestId: string,
  input: SubmitManualAdjudicationVerdictInput
): Promise<ManualAdjudicationViewDto> {
  const body = SubmitManualAdjudicationVerdictInputSchema.parse(input);
  const response = await fetch(api(`/api/tournaments/adjudications/${encodeURIComponent(adjudicationRequestId)}/verdict`), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-OTT-Request": "1" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!response.ok) await responseError(response);
  const payload = await response.json() as { adjudication?: unknown };
  if (!payload.adjudication) throw new Error("Máy chủ chưa trả về kết quả phân xử.");
  return ManualAdjudicationViewSchema.parse(payload.adjudication);
}
