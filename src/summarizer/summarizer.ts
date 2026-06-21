import type { EmailMessage } from "../nylas/types";
import type { SummaryResult } from "./types";

export interface Summarizer {
  summarize(messages: EmailMessage[]): Promise<SummaryResult>;
}
