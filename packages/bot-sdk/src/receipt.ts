import {
  BotExecutionReceiptSchema,
  type BotExecutionReceipt,
} from "@ottv2/contracts";

export type BotReceiptContext = Omit<BotExecutionReceipt, "outcome" | "computeMs" | "errorCode">;

export type BotReceiptResult = Readonly<{
  outcome: BotExecutionReceipt["outcome"];
  computeMs: number;
  errorCode?: string;
}>;

export type { BotExecutionReceipt };

/**
 * Receipts are created after the host validates a result. The adapter never
 * trusts receipt fields supplied by player code and returns a frozen snapshot.
 */
export function createBotExecutionReceipt(
  context: BotReceiptContext,
  result: BotReceiptResult,
): BotExecutionReceipt {
  if (!Number.isInteger(result.computeMs) || result.computeMs < 0) {
    throw new Error("INVALID_RECEIPT_COMPUTE");
  }
  const candidate = {
    ...context,
    outcome: result.outcome,
    computeMs: result.computeMs,
    ...(result.errorCode === undefined ? {} : { errorCode: result.errorCode }),
  };
  const receipt = BotExecutionReceiptSchema.parse(candidate);
  return Object.freeze(receipt);
}
