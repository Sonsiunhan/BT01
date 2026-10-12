import { z } from "zod";

export const PROTOCOL_VERSION = "0.1" as const;
export const PROTOCOL_VERSION_V2 = "0.2" as const;
export const APPLICATION_VERSION = "0.1.0" as const;

export const ProtocolVersionSchema = z.enum([PROTOCOL_VERSION, PROTOCOL_VERSION_V2]);
export const ProtocolVersionV2Schema = z.literal(PROTOCOL_VERSION_V2);
export type ProtocolVersion = z.infer<typeof ProtocolVersionSchema>;
export type ProtocolVersionV2 = z.infer<typeof ProtocolVersionV2Schema>;

