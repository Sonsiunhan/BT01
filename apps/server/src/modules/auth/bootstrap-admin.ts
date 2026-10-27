import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { createRecoveryCode, hashSecret, verifySecret } from "./auth.crypto.js";

function findWorkspaceRoot(fromUrl: string): URL {
  let curr = new URL("./", fromUrl);
  for (let i = 0; i < 8; i++) {
    const pkg = new URL("package.json", curr);
    if (existsSync(fileURLToPath(pkg))) {
      try {
        const content = JSON.parse(readFileSync(fileURLToPath(pkg), "utf8"));
        if (content.name === "ottv2") return curr;
      } catch {
        // Continue searching upwards
      }
    }
    curr = new URL("../", curr);
  }
  return new URL("../../../../../", fromUrl);
}

export async function bootstrapDatabaseAndAdmin(
  prisma: PrismaClient,
  log?: { info: (...args: any[]) => void; warn: (...args: any[]) => void; error: (...args: any[]) => void }
): Promise<void> {
  // 1. Run migrations / schema sync if in production or server startup (skip during tests)
  if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
    try {
      const root = findWorkspaceRoot(import.meta.url);
      const prismaCli = fileURLToPath(new URL("node_modules/prisma/build/index.js", root));
      const schemaPath = fileURLToPath(new URL("prisma/schema.prisma", root));

      if (existsSync(prismaCli) && existsSync(schemaPath) && process.env.DATABASE_URL) {
        log?.info("Checking and deploying database schema...");
        let migrated = false;
        try {
          execFileSync(process.execPath, [prismaCli, "migrate", "deploy", "--schema", schemaPath], {
            stdio: "pipe",
            windowsHide: true,
            env: process.env,
            timeout: 45_000,
          });
          migrated = true;
          log?.info("Database migrations deployed successfully.");
        } catch (deployErr: any) {
          log?.warn({ err: deployErr?.message }, "migrate deploy failed or drifted; attempting db push fallback...");
        }

        if (!migrated) {
          try {
            execFileSync(process.execPath, [prismaCli, "db", "push", "--skip-generate", "--schema", schemaPath], {
              stdio: "pipe",
              windowsHide: true,
              env: process.env,
              timeout: 45_000,
            });
            log?.info("Database schema push completed.");
          } catch (pushErr: any) {
            log?.warn({ err: pushErr?.message }, "db push could not complete; proceeding with existing schema...");
          }
        }
      }
    } catch (err: any) {
      log?.warn({ err: err?.message }, "Failed to execute schema synchronization.");
    }
  }

  // 2. Ensure default SA account (sa_local) exists with SYSTEM_ADMIN role and sa123@ password
  try {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: "sa_local" },
          { usernameNormalized: "sa_local" },
        ],
      },
    });

    if (!existing) {
      const password = "sa123@";
      const passwordHash = await hashSecret(password);
      const recoveryCode = createRecoveryCode();
      const recoveryCodeHash = await hashSecret(recoveryCode);

      await prisma.user.create({
        data: {
          username: "sa_local",
          usernameNormalized: "sa_local",
          fullName: "System Admin",
          displayName: "System Admin",
          role: "SYSTEM_ADMIN",
          passwordHash,
          recoveryCodeHash,
          profile: {
            create: {
              theme: "system",
              avatarPreset: "robot",
              presenceVisibility: "FRIENDS",
              friendListVisibility: "PRIVATE",
              fullNameVisibility: "PRIVATE",
            },
          },
          stats: {
            create: {
              elo: 1000,
              rankedWins: 0,
              rankedLosses: 0,
              quickWins: 0,
              quickLosses: 0,
            },
          },
        },
      });
      log?.info("Default SA account (sa_local) bootstrapped successfully.");
    } else {
      const isMatch = await verifySecret("sa123@", existing.passwordHash);
      const updates: { role?: "SYSTEM_ADMIN"; passwordHash?: string } = {};
      if (existing.role !== "SYSTEM_ADMIN") {
        updates.role = "SYSTEM_ADMIN";
      }
      if (!isMatch) {
        updates.passwordHash = await hashSecret("sa123@");
      }
      if (Object.keys(updates).length > 0) {
        await prisma.user.update({
          where: { id: existing.id },
          data: updates,
        });
        log?.info({ updates: Object.keys(updates) }, "Existing sa_local account updated to SYSTEM_ADMIN with valid credentials.");
      }
    }
  } catch (err: any) {
    log?.warn({ err: err?.message }, "Could not ensure default SA account (database might be initializing or unreachable).");
  }

  // 3. Ensure default unit (unit-fit-vnu) and contract (HD-2026-CHUNG) exist
  try {
    const existingUnit = await prisma.unit.findFirst({
      where: {
        OR: [
          { id: "unit-fit-vnu" },
          { unitCode: "UNIT-FIT-VNU" },
        ],
      },
    });

    let unitId = existingUnit?.id;
    if (!existingUnit) {
      const createdUnit = await prisma.unit.create({
        data: {
          id: "unit-fit-vnu",
          unitCode: "UNIT-FIT-VNU",
          unitName: "Khoa Công nghệ Thông tin - Trường ĐH Công nghệ, ĐHQGHN",
          unitType: "KHOA",
          contactName: "Ban Quản trị FIT",
          contactEmail: "contact@fit.vnu.edu.vn",
          status: "ACTIVE",
        },
      });
      unitId = createdUnit.id;
      log?.info("Default Unit (unit-fit-vnu) bootstrapped successfully.");
    }

    const existingContract = await prisma.tournamentContract.findFirst({
      where: {
        OR: [
          { id: "HD-2026-CHUNG" },
          { contractCode: "HD-2026-CHUNG" },
        ],
      },
    });

    if (!existingContract && unitId) {
      await prisma.tournamentContract.create({
        data: {
          id: "HD-2026-CHUNG",
          contractCode: "HD-2026-CHUNG",
          unitId,
          status: "ACTIVE",
          validFrom: new Date("2026-01-01T00:00:00.000Z"),
          validTo: new Date("2030-12-31T23:59:59.000Z"),
          maxTournamentsTotal: 100,
          quotaReservedCount: 0,
          quotaConsumedCount: 0,
          maxParticipantsPerTournament: 256,
          maxParticipantsTotal: 1000,
          allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
          policyEnvelope: {
            allowedModes: ["HUMAN_ONLINE", "BOT_VS_BOT"],
            turnSecondsMin: 5,
            turnSecondsMax: 300,
            totalMatchSecondsMin: 30,
            totalMatchSecondsMax: 3600,
            turnLimitMin: 10,
            turnLimitMax: 500,
            allowedNoProgressPlies: [10, 20, 30, 40, 50, 60, 80, 100],
            allowedRepetitionThresholds: [2, 3, 4, 5, 6],
            allowedTieBreakPolicies: [
              "RANDOM_SEEDED",
              "BLUE_ADVANTAGE",
              "RED_ADVANTAGE",
              "REPLAY_ONCE_THEN_SEEDED",
              "MANUAL_REFEREE",
            ],
          },
          technicalCaps: {
            botSourceMaxBytes: 65536,
            botRuntimeTimeoutMs: 1000,
            botMemoryLimitMb: 64,
            maxConcurrentMatchesPerTournament: 16,
            rosterImportMaxRows: 2000,
          },
        },
      });
      log?.info("Default Contract (HD-2026-CHUNG) bootstrapped successfully.");
    }
  } catch (contractErr: any) {
    log?.warn({ err: contractErr?.message }, "Could not ensure default unit or contract (schema may not be ready).");
  }
}
