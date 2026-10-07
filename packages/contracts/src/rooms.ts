import { z } from "zod";

export const RoomVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export const RoomModeSchema = z.enum(["UNRANKED", "RANKED"]);
export const RoomPlayModeSchema = z.enum(["MANUAL", "BOT"]);
export const RoomStatusSchema = z.enum(["WAITING", "PLAYING", "ENDED", "ABORTED"]);
export const RoomHostRoleSchema = z.enum(["PLAYER", "REFEREE"]);
export const RoomRoleSchema = z.enum(["PLAYER", "REFEREE", "SPECTATOR"]);
export const TimerSecondsSchema = z.union([z.literal(30), z.literal(60), z.literal(300), z.literal(600), z.literal(1800), z.literal(3600)]);
export const SpectatorCapacitySchema = z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10), z.literal(50), z.literal(100)]);

export const CreateRoomRequestSchema = z.object({
  name: z.string().trim().max(30).optional().default(""),
  visibility: RoomVisibilitySchema,
  password: z.string().min(1).max(12).optional(),
  timerSeconds: TimerSecondsSchema,
  playMode: RoomPlayModeSchema.default("MANUAL"),
  spectatorsEnabled: z.boolean().default(false),
  spectatorCapacity: SpectatorCapacitySchema.optional(),
  refereeEnabled: z.boolean().default(false),
  hostRole: RoomHostRoleSchema.default("PLAYER"),
}).superRefine((input, context) => {
  if (input.visibility === "PUBLIC" && input.password !== undefined) context.addIssue({ code: "custom", path: ["password"], message: "Phòng Public không được đặt mật khẩu." });
  if (input.visibility === "PRIVATE" && input.password === undefined) context.addIssue({ code: "custom", path: ["password"], message: "Phòng Private cần mật khẩu." });
  if (input.spectatorsEnabled && input.spectatorCapacity === undefined) context.addIssue({ code: "custom", path: ["spectatorCapacity"], message: "Hãy chọn sức chứa spectator." });
  if (!input.spectatorsEnabled && input.spectatorCapacity !== undefined) context.addIssue({ code: "custom", path: ["spectatorCapacity"], message: "Tắt spectator thì không cần sức chứa." });
  if (!input.refereeEnabled && input.hostRole === "REFEREE") context.addIssue({ code: "custom", path: ["hostRole"], message: "Bật trọng tài trước khi chọn vai trò Trọng tài." });
  if (input.visibility === "PUBLIC" && input.refereeEnabled && input.hostRole === "REFEREE") context.addIssue({ code: "custom", path: ["hostRole"], message: "Phòng có chủ phòng làm trọng tài phải là Private để mời người chơi." });
});

export const JoinRoomRequestSchema = z.object({ password: z.string().min(1).max(12).optional() });
export const InviteRefereeRequestSchema = z.object({ targetUserId: z.string().min(1), ttlSeconds: z.number().int().min(30).max(300).optional().default(300) });
export const RefereeInviteSchema = z.object({
  inviteId: z.string().min(1),
  roomId: z.string().length(6),
  targetUserId: z.string().min(1),
  from: z.object({ userId: z.string().min(1), username: z.string().min(1), displayName: z.string().min(1) }).optional(),
  role: z.literal("REFEREE"),
  expiresAt: z.number().int().positive(),
  status: z.enum(["PENDING", "ACCEPTED", "DECLINED", "EXPIRED"])
});

export const RoomMemberSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1),
  displayName: z.string().min(1),
  isHost: z.boolean(),
});

export const RoomSummarySchema = z.object({
  roomId: z.string().length(6),
  name: z.string().min(1).max(30),
  players: z.number().int().min(0).max(2),
  playerCapacity: z.literal(2),
  waitingPlayerRating: z.number().int().nullable(),
  mode: RoomModeSchema,
  playMode: RoomPlayModeSchema.default("MANUAL"),
  visibility: RoomVisibilitySchema,
  timerSeconds: TimerSecondsSchema,
  spectators: z.number().int().min(0),
  spectatorsEnabled: z.boolean(),
  spectatorCapacity: SpectatorCapacitySchema.nullable(),
  refereeEnabled: z.boolean().default(false),
  refereeUserId: z.string().min(1).nullable().default(null),
  refereeConnected: z.boolean().default(false),
  status: RoomStatusSchema,
});

export const RoomDetailSchema = RoomSummarySchema.extend({
  hostUserId: z.string().min(1).nullable(),
  isMember: z.boolean(),
  requiresPassword: z.boolean(),
  role: RoomRoleSchema.default("PLAYER"),
  isReferee: z.boolean().default(false),
  referee: z.object({ userId: z.string().min(1), username: z.string().min(1), displayName: z.string().min(1), connected: z.boolean() }).nullable().default(null),
  members: z.array(RoomMemberSchema),
});

export type CreateRoomRequest = z.input<typeof CreateRoomRequestSchema>;
export type JoinRoomRequest = z.infer<typeof JoinRoomRequestSchema>;
export type InviteRefereeRequest = z.infer<typeof InviteRefereeRequestSchema>;
export type RefereeInvite = z.infer<typeof RefereeInviteSchema>;
export type RoomPlayMode = z.infer<typeof RoomPlayModeSchema>;
export type RoomHostRole = z.infer<typeof RoomHostRoleSchema>;
export type RoomRole = z.infer<typeof RoomRoleSchema>;
export type RoomSummary = z.infer<typeof RoomSummarySchema>;
export type RoomDetail = z.infer<typeof RoomDetailSchema>;
