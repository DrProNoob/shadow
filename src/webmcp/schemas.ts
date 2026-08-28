import { z } from "zod";

const boundedId = z.string().trim().min(1).max(100);

export const emptyInputSchema = z.strictObject({});

export const subscriptionInputSchema = z.strictObject({
  subscriptionId: boundedId.describe(
    "The subscription ID returned by list_subscriptions.",
  ),
});

export const shadowInputSchema = z.strictObject({
  shadowId: boundedId.describe("The Shadow ID returned by begin_shadow."),
});

export const beginShadowInputSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe("A short human-readable name for the proposed future."),
  strategy: z
    .enum(["conservative", "aggressive", "custom"])
    .optional()
    .describe("The planning strategy represented by this Shadow."),
  intent: z
    .strictObject({
      minimumSavingsBasisPoints: z
        .number()
        .int()
        .min(0)
        .max(10_000)
        .optional()
        .describe("Minimum savings target where 2000 means 20%."),
      protectedTeamIds: z
        .array(boundedId)
        .max(8)
        .optional()
        .describe("Teams whose active users must remain unaffected."),
      maximumContractPenaltyCents: z
        .number()
        .int()
        .min(0)
        .max(100_000_000)
        .optional()
        .describe("Maximum acceptable one-time contract penalty in cents."),
    })
    .optional(),
});

export const stageSeatChangeInputSchema = z.strictObject({
  shadowId: boundedId.describe("The draft Shadow to change."),
  subscriptionId: boundedId.describe(
    "The subscription whose projected seat count should change.",
  ),
  seatCount: z
    .number()
    .int()
    .min(0)
    .max(100_000)
    .describe("The proposed total seat count in the Shadow."),
});

export const stagePlanChangeInputSchema = z.strictObject({
  shadowId: boundedId.describe("The draft Shadow to change."),
  subscriptionId: boundedId.describe(
    "The subscription whose projected plan should change.",
  ),
  planId: boundedId.describe(
    "The proposed plan ID for the subscription's product.",
  ),
});

export const stageCancellationInputSchema = z.strictObject({
  shadowId: boundedId.describe("The draft Shadow to change."),
  subscriptionId: boundedId.describe(
    "The subscription to cancel in the projected future.",
  ),
});

export const removeShadowChangeInputSchema = z.strictObject({
  shadowId: boundedId.describe("The draft Shadow containing the change."),
  changeId: boundedId.describe("The staged change to remove."),
});

export const getChangeProofInputSchema = z.strictObject({
  shadowId: boundedId.describe("The Shadow containing the change."),
  changeId: boundedId.describe("The staged change whose Proof is requested."),
});

export const forkShadowInputSchema = z.strictObject({
  sourceShadowId: boundedId.describe("The current draft Shadow to snapshot."),
  name: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .describe("A short human-readable name for the child Shadow."),
});

export const copyChangeBetweenShadowsInputSchema = z.strictObject({
  sourceShadowId: boundedId.describe(
    "The Shadow that currently contains the source change.",
  ),
  targetShadowId: boundedId.describe(
    "The current draft Shadow that should receive the change.",
  ),
  changeId: boundedId.describe("The source change to copy."),
});

export const compareShadowsInputSchema = z.strictObject({
  leftShadowId: boundedId.describe("The first Shadow to compare."),
  rightShadowId: boundedId.describe("The second Shadow to compare."),
});

export type BeginShadowToolInput = z.infer<typeof beginShadowInputSchema>;
export type SubscriptionToolInput = z.infer<typeof subscriptionInputSchema>;
export type ShadowToolInput = z.infer<typeof shadowInputSchema>;
export type StageSeatChangeToolInput = z.infer<
  typeof stageSeatChangeInputSchema
>;
export type StagePlanChangeToolInput = z.infer<
  typeof stagePlanChangeInputSchema
>;
export type StageCancellationToolInput = z.infer<
  typeof stageCancellationInputSchema
>;
export type RemoveShadowChangeToolInput = z.infer<
  typeof removeShadowChangeInputSchema
>;
export type GetChangeProofToolInput = z.infer<typeof getChangeProofInputSchema>;
export type ForkShadowToolInput = z.infer<typeof forkShadowInputSchema>;
export type CopyChangeBetweenShadowsToolInput = z.infer<
  typeof copyChangeBetweenShadowsInputSchema
>;
export type CompareShadowsToolInput = z.infer<typeof compareShadowsInputSchema>;

export function toWebMcpJsonSchema(schema: z.ZodType): object {
  const jsonSchema = { ...z.toJSONSchema(schema) };
  delete jsonSchema.$schema;
  return jsonSchema;
}
