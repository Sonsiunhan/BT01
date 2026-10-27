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
}
