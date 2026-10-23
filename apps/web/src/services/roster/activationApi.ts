import {
  ClaimActivationResponseSchema,
  SetupCredentialResponseSchema,
  type ClaimActivationRequest,
  type ClaimActivationResponse,
  type SetupCredentialRequest,
  type SetupCredentialResponse,
} from "@ottv2/contracts";

async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  parser?: { parse: (value: unknown) => T },
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      (body as { message?: string }).message ?? "Không thể kết nối dịch vụ kích hoạt tài khoản.",
    );
    Object.assign(error, { statusCode: response.status, code: (body as { code?: string }).code });
    throw error;
  }
  return parser ? parser.parse(body) : (body as T);
}

export const activationApi = {
  claim(payload: ClaimActivationRequest): Promise<ClaimActivationResponse> {
    return requestJson("/roster/activation/claim", {
      method: "POST",
      body: JSON.stringify(payload),
    }, ClaimActivationResponseSchema);
  },

  setupCredential(payload: SetupCredentialRequest): Promise<SetupCredentialResponse> {
    return requestJson("/roster/activation/credential", {
      method: "POST",
      body: JSON.stringify(payload),
    }, SetupCredentialResponseSchema);
  },
};

export type ActivationApi = typeof activationApi;
