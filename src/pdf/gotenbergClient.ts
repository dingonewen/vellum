export interface PdfRenderer {
  renderHtmlToPdf(html: string): Promise<Buffer>;
}

export function createGotenbergClient(baseUrl: string): PdfRenderer {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return {
    async renderHtmlToPdf(html: string): Promise<Buffer> {
      const form = new FormData();
      form.append("files", new Blob([html], { type: "text/html" }), "index.html");

      const response = await fetch(`${normalizedBaseUrl}/forms/chromium/convert/html`, {
        method: "POST",
        body: form,
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Gotenberg PDF generation failed (${response.status}): ${details}`);
      }

      return Buffer.from(await response.arrayBuffer());
    },
  };
}
