import { describe, expect, it } from "vitest";
import {
  stageCancellationInputSchema,
  stagePlanChangeInputSchema,
  toWebMcpJsonSchema,
} from "@/webmcp/schemas";

describe("Slice 5 WebMCP schemas", () => {
  it("accepts only a Shadow, subscription, and product-compatible plan ID", () => {
    expect(
      stagePlanChangeInputSchema.safeParse({
        shadowId: "shadow-001",
        subscriptionId: "subscription-notion",
        planId: "plan-notion-business",
      }).success,
    ).toBe(true);
    expect(
      stagePlanChangeInputSchema.safeParse({
        shadowId: "shadow-001",
        subscriptionId: "subscription-notion",
        planId: "plan-notion-business",
        source: "webmcp",
      }).success,
    ).toBe(false);
    expect(toWebMcpJsonSchema(stagePlanChangeInputSchema)).toMatchObject({
      type: "object",
      required: ["shadowId", "subscriptionId", "planId"],
      additionalProperties: false,
    });
  });

  it("keeps cancellation input deliberately narrow", () => {
    expect(
      stageCancellationInputSchema.safeParse({
        shadowId: "shadow-001",
        subscriptionId: "subscription-miro",
      }).success,
    ).toBe(true);
    expect(
      stageCancellationInputSchema.safeParse({
        shadowId: "shadow-001",
        subscriptionId: "subscription-miro",
        force: true,
      }).success,
    ).toBe(false);
    expect(toWebMcpJsonSchema(stageCancellationInputSchema)).toMatchObject({
      type: "object",
      required: ["shadowId", "subscriptionId"],
      additionalProperties: false,
    });
  });
});
