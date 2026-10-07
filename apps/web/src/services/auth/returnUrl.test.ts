import { describe, expect, it } from "vitest";
import { safeReturnTo } from "./returnUrl";

describe("R16 safe in-app return URLs", () => {
  it("keeps an internal path with query/hash", () => {
    expect(safeReturnTo("/bot-lab?draft=1#upload", "/ho-so")).toBe("/bot-lab?draft=1#upload");
  });

  it("rejects external, protocol-relative and auth-loop targets", () => {
    expect(safeReturnTo("https://evil.example/phish", "/ho-so")).toBe("/ho-so");
    expect(safeReturnTo("//evil.example/phish", "/ho-so")).toBe("/ho-so");
    expect(safeReturnTo("/dang-nhap?returnTo=/dang-ky", "/ho-so")).toBe("/ho-so");
  });
});
