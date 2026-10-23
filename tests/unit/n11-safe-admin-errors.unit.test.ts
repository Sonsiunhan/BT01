import { describe, expect, it } from "vitest";
import { ApiError } from "../../apps/web/src/services/http/apiError";
import { safeErrorMessage } from "../../apps/web/src/services/http/safeErrorMessage";

describe("N11 safe admin error copy", () => {
  it("never exposes an unexpected Error message", () => {
    expect(
      safeErrorMessage(
        new Error("Prisma query failed: password=secret-token"),
        "Không thể tải dữ liệu hợp đồng."
      )
    ).toBe("Không thể tải dữ liệu hợp đồng.");
  });

  it("maps authorization failures to stable Vietnamese copy", () => {
    expect(
      safeErrorMessage(new ApiError("internal details", 403, "UNAUTHORIZED"), "fallback")
    ).toBe("Bạn không có quyền thực hiện thao tác này.");
  });
});
