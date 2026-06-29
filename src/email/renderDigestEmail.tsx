import { render } from "@react-email/render";
import type { SummaryResult } from "../summarizer/types";
import { DigestEmail } from "./templates/DigestEmail";

export async function renderDigestEmail(summary: SummaryResult): Promise<string> {
  return Promise.resolve(render(<DigestEmail summary={summary} />));
}
