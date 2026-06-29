import type { NylasClient } from "../nylas/client";
import type { SummaryResult } from "../summarizer/types";
import { config } from "../config";
import { createGotenbergClient } from "../pdf/gotenbergClient";
import { renderDigestEmail } from "./renderDigestEmail";

export interface EmailSender {
  send(grantId: string, destEmail: string, summary: SummaryResult): Promise<void>;
}

export function createEmailSender(client: NylasClient): EmailSender {
  const pdfRenderer = createGotenbergClient(config.GOTENBERG_URL);

  return {
    async send(grantId: string, destEmail: string, summary: SummaryResult): Promise<void> {
      const htmlBody = await renderDigestEmail(summary);
      const attachments = [];

      if (config.ENABLE_PDF_ATTACHMENTS) {
        const pdf = await pdfRenderer.renderHtmlToPdf(htmlBody);
        attachments.push({
          filename: `vellum-digest-${new Date(summary.generatedAt).toISOString().slice(0, 10)}.pdf`,
          contentType: "application/pdf",
          content: pdf,
          size: pdf.byteLength,
        });
      }

      await client.sendMessage(grantId, destEmail, summary.subject, htmlBody, attachments);
    },
  };
}
