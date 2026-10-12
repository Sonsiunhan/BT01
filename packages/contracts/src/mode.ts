import { z } from "zod";

export const MatchEnvironmentSchema = z.enum(["ONLINE", "OFFLINE"]);
export type MatchEnvironment = z.infer<typeof MatchEnvironmentSchema>;

export const MatchControllerSchema = z.enum(["HUMAN", "PYTHON", "BUILTIN_AI"]);
export type MatchController = z.infer<typeof MatchControllerSchema>;

export const GameModeConfigSchema = z.object({
  environment: MatchEnvironmentSchema,
  mode: z.enum(["RANKED", "UNRANKED"]),
  controllers: z.object({
    BLUE: MatchControllerSchema,
    RED: MatchControllerSchema,
  }),
  training: z.boolean().default(false),
});
export type GameModeConfig = z.infer<typeof GameModeConfigSchema>;

export interface ModeValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateGameModeConfig(
  config: GameModeConfig,
  principalContext: { isGuest: boolean }
): ModeValidationResult {
  const parsed = GameModeConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { valid: false, reason: "INVALID_CONFIG_SCHEMA" };
  }

  const { environment, mode, controllers, training } = parsed.data;

  if (mode === "RANKED") {
    if (principalContext.isGuest) {
      return { valid: false, reason: "GUEST_CANNOT_PLAY_RANKED" };
    }
    if (environment !== "ONLINE") {
      return { valid: false, reason: "RANKED_REQUIRES_ONLINE" };
    }
    if (controllers.BLUE !== "HUMAN" || controllers.RED !== "HUMAN") {
      return { valid: false, reason: "RANKED_REQUIRES_HUMAN_CONTROLLERS" };
    }
    if (training) {
      return { valid: false, reason: "RANKED_CANNOT_BE_TRAINING" };
    }
    return { valid: true };
  }

  // UNRANKED modes
  if (training) {
    // Training allows HUMAN/PYTHON or PYTHON/PYTHON
    const hasPython = controllers.BLUE === "PYTHON" || controllers.RED === "PYTHON";
    if (!hasPython) {
      return { valid: false, reason: "TRAINING_REQUIRES_PYTHON_CONTROLLER" };
    }
    return { valid: true };
  }

  return { valid: true };
}

export const PrincipalKindSchema = z.enum(["ACCOUNT", "GUEST"]);
export type PrincipalKind = z.infer<typeof PrincipalKindSchema>;

import { RoomRoleSchema, type RoomRole } from "./rooms.js";
export { RoomRoleSchema, type RoomRole };


export const RoomMemberContextSchema = z
  .object({
    principalId: z.string().min(1),
    principalKind: PrincipalKindSchema,
    role: RoomRoleSchema,
    isHost: z.boolean(),
  })
  .refine(
    (member) => {
      if (
        member.principalKind === "GUEST" &&
        (member.role === "REFEREE" || member.role === "REPLACEMENT_CANDIDATE")
      ) {
        return false;
      }
      return true;
    },
    {
      message: "Guest cannot be referee or replacement candidate",
      path: ["role"],
    }
  );
export type RoomMemberContext = z.infer<typeof RoomMemberContextSchema>;
