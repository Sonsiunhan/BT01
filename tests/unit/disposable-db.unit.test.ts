import { describe, expect, it } from "vitest";
import {
  GuardError,
  validateDisposableDbUrl,
  getSanitizedIdentifier,
  generateDisposableDbName,
  runGuardSelfCheck,
} from "../../scripts/network/disposable-db.mjs";

describe("L06-W0 Disposable DB Guard (L-05.01)", () => {
  describe("Guard 3-Case Rejection Invariants", () => {
    it("Case 1: Rejects when TEST_DATABASE_URL matches or collides with DATABASE_URL", () => {
      // 1A: Exact string match
      expect(() =>
        validateDisposableDbUrl(
          "postgresql://ottv2_user:secret@127.0.0.1:5432/ottv2_test",
          {
            databaseUrl:
              "postgresql://ottv2_user:secret@127.0.0.1:5432/ottv2_test",
          }
        )
      ).toThrowError(/TEST_DATABASE_URL must not match/);

      // 1B: Equivalent localhost alias match
      try {
        validateDisposableDbUrl(
          "postgresql://ottv2_user:secret@127.0.0.1:5432/ottv2_test",
          {
            databaseUrl:
              "postgresql://other_user:other_pass@localhost:5432/ottv2_test",
          }
        );
        expect.unreachable("Should have thrown GuardError");
      } catch (err) {
        expect(err).toBeInstanceOf(GuardError);
        expect((err as GuardError).code).toBe("GUARD_REJECT_IDENTICAL_URL");
      }
    });

    it("Case 2: Rejects when host is not an allowed disposable test host", () => {
      const remoteHosts = [
        "postgresql://user:pass@render.com:5432/ottv2_test",
        "postgresql://user:pass@dpg-c123.oregon-postgres.render.com:5432/ottv2_test",
        "postgresql://user:pass@neon.tech:5432/ottv2_test",
        "postgresql://user:pass@192.168.1.100:5432/ottv2_test",
      ];

      for (const remoteUrl of remoteHosts) {
        try {
          validateDisposableDbUrl(remoteUrl);
          expect.unreachable(`Should have rejected host: ${remoteUrl}`);
        } catch (err) {
          expect(err).toBeInstanceOf(GuardError);
          expect((err as GuardError).code).toBe("GUARD_REJECT_DISALLOWED_HOST");
          expect((err as GuardError).message).toContain("not in the allowed");
        }
      }
    });

    it("Case 3: Rejects when database name lacks required disposable marker", () => {
      const nonDisposableDbs = [
        "postgresql://user:pass@127.0.0.1:5432/ottv2_prod",
        "postgresql://user:pass@127.0.0.1:5432/ottv2_dev",
        "postgresql://user:pass@127.0.0.1:5432/postgres",
        "postgresql://user:pass@127.0.0.1:5432/ottv2_main",
        "postgresql://user:pass@127.0.0.1:5432/",
      ];

      for (const nonDisposableUrl of nonDisposableDbs) {
        try {
          validateDisposableDbUrl(nonDisposableUrl);
          expect.unreachable(`Should have rejected database: ${nonDisposableUrl}`);
        } catch (err) {
          expect(err).toBeInstanceOf(GuardError);
          expect((err as GuardError).code).toBe("GUARD_REJECT_MISSING_MARKER");
          expect((err as GuardError).message).toContain("lacks required disposable marker");
        }
      }
    });
  });

  describe("Additional Validation & Sanitization", () => {
    it("Rejects missing or invalid URLs", () => {
      expect(() => validateDisposableDbUrl(undefined)).toThrowError(
        /TEST_DATABASE_URL is required/
      );
      expect(() => validateDisposableDbUrl("")).toThrowError(
        /TEST_DATABASE_URL is required/
      );
      expect(() => validateDisposableDbUrl("not-a-url")).toThrowError(
        /not a valid URL/
      );
      expect(() =>
        validateDisposableDbUrl("mysql://user:pass@127.0.0.1:3306/test_db")
      ).toThrowError(/must use postgresql: or postgres: protocol/);
    });

    it("Accepts valid disposable database URLs and produces sanitized identifier without credentials", () => {
      const validUrl = "postgresql://sensitive_user:super_secret_pw@127.0.0.1:5432/ottv2_acceptance_test";
      const { url, sanitizedIdentifier } = validateDisposableDbUrl(validUrl, {
        databaseUrl: "postgresql://dev_user:dev_pw@127.0.0.1:5432/ottv2_dev",
      });

      expect(url).toBeDefined();
      expect(sanitizedIdentifier).toEqual({
        host: "127.0.0.1",
        port: 5432,
        database: "ottv2_acceptance_test",
        protocol: "postgresql",
        productionMutation: false,
        disposable: true,
      });

      // Crucial security invariant: sanitized identifier must NOT contain credentials
      const serialized = JSON.stringify(sanitizedIdentifier);
      expect(serialized).not.toContain("sensitive_user");
      expect(serialized).not.toContain("super_secret_pw");
    });

    it("Generates unique disposable database names with timestamp and nonce", () => {
      const name1 = generateDisposableDbName();
      const name2 = generateDisposableDbName();

      expect(name1).toMatch(/^ottv2_test_\d+_[0-9a-f]{8}$/);
      expect(name2).toMatch(/^ottv2_test_\d+_[0-9a-f]{8}$/);
      expect(name1).not.toBe(name2);
    });

    it("runGuardSelfCheck passes all 3 canonical rejection cases", () => {
      const check = runGuardSelfCheck();
      expect(check.passed).toBe(true);
      expect(check.cases).toHaveLength(3);
      expect(check.cases.every((c) => c.passed)).toBe(true);
    });
  });
});
