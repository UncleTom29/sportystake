import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free LLM Powered Sports Analytics & AI Match Predictions",
  description:
    "Free real-time AI sports predictions, EV+ value odds scanner, and probabilistic match insights powered by Anthropic Claude Fable AI LLM for all sports fixtures.",
  keywords: [
    "free ai sports analytics",
    "llm match predictions",
    "claude fable betting picks",
    "value odds scanner",
    "ai sports predictions",
  ],
};

export default function AIAnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
