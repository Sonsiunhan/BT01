import type {
  ClaimActivationRequest,
  ClaimActivationResponse,
  SetupCredentialRequest,
  SetupCredentialResponse,
} from "@ottv2/contracts";
import { requestJson } from "../http/httpClient";

export const activationApi = {
  claim(payload: ClaimActivationRequest): Promise<ClaimActivationResponse> {
    return requestJson<ClaimActivationResponse>("/roster/activation/claim", {
      method: "POST",
      body: payload,
    });
  },

  setupCredential(payload: SetupCredentialRequest): Promise<SetupCredentialResponse> {
    return requestJson<SetupCredentialResponse>("/roster/activation/credential", {
      method: "POST",
      body: payload,
    });
  },
};

export type ActivationApi = typeof activationApi;
