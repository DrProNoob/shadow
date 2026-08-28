import { describe, expect, it } from "vitest";
import {
  compareShadowsInputSchema,
  copyChangeBetweenShadowsInputSchema,
  forkShadowInputSchema,
  toWebMcpJsonSchema,
} from "@/webmcp/schemas";

describe("Slice 6 WebMCP schemas", () => {
  it("requires a source Shadow and bounded child name for forks", () => {
    expect(
      forkShadowInputSchema.safeParse({
        sourceShadowId: "shadow-001",
        name: "Hybrid",
      }).success,
    ).toBe(true);
    expect(
      forkShadowInputSchema.safeParse({
        sourceShadowId: "shadow-001",
        name: "Hybrid",
        inheritFutureChanges: true,
      }).success,
    ).toBe(false);
    expect(toWebMcpJsonSchema(forkShadowInputSchema)).toMatchObject({
      type: "object",
      required: ["sourceShadowId", "name"],
      additionalProperties: false,
    });
  });

  it("compares exactly two identified Shadows", () => {
    expect(
      compareShadowsInputSchema.safeParse({
        leftShadowId: "shadow-001",
        rightShadowId: "shadow-002",
      }).success,
    ).toBe(true);
    expect(
      compareShadowsInputSchema.safeParse({
        leftShadowId: "shadow-001",
        rightShadowId: "shadow-002",
        includeRealityWrite: true,
      }).success,
    ).toBe(false);
    expect(toWebMcpJsonSchema(compareShadowsInputSchema)).toMatchObject({
      type: "object",
      required: ["leftShadowId", "rightShadowId"],
      additionalProperties: false,
    });
  });

  it("identifies one source change and one target Shadow for copying", () => {
    expect(
      copyChangeBetweenShadowsInputSchema.safeParse({
        sourceShadowId: "shadow-002",
        targetShadowId: "shadow-003",
        changeId: "change-009",
      }).success,
    ).toBe(true);
    expect(
      copyChangeBetweenShadowsInputSchema.safeParse({
        sourceShadowId: "shadow-002",
        targetShadowId: "shadow-003",
      }).success,
    ).toBe(false);
    expect(
      toWebMcpJsonSchema(copyChangeBetweenShadowsInputSchema),
    ).toMatchObject({
      type: "object",
      required: ["sourceShadowId", "targetShadowId", "changeId"],
      additionalProperties: false,
    });
  });
});
