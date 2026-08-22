import { z } from "zod";

const appSelectionSchema = z.object({
  source: z.literal("app"),
  marketId: z.string(),
  outcome: z.number(),
  marketType: z.string(),
  label: z.string(),
  reasoning: z.string(),
});

const webSelectionSchema = z.object({
  source: z.literal("web"),
  webId: z.number(),
  label: z.string(),
  reasoning: z.string(),
});

const selectionSchema = z.discriminatedUnion("source", [appSelectionSchema, webSelectionSchema]);

export const picksLlmSchema = z.discriminatedUnion("verdict", [
  z.object({
    verdict: z.literal("BET"),
    selections: z.array(selectionSchema).length(2),
    summary: z.string(),
  }),
  z.object({
    verdict: z.literal("SKIP"),
    skipReason: z.string(),
  }),
]);

export type PicksLlmOutput = z.infer<typeof picksLlmSchema>;
