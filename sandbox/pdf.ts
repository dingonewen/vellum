/**
 * Minimal PDF generator — produces valid PDFs without external dependencies.
 * Suitable for simple text-based documents like purchase orders.
 *
 * Uses only the built-in Helvetica font (no embedding required).
 */

/**
 * Escape PDF string literals: backslash, parens, and non-printable chars.
 */
function escapePdfString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r/g, '');
}

/**
 * Wrap text to fit within a given width at the specified font size.
 * Simple word-wrap; assumes Helvetica ~0.6 * fontSize average char width.
 */
function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
  const avgCharWidth = fontSize * 0.6;
  const maxChars = Math.floor(maxWidth / avgCharWidth);
  const lines: string[] = [];

  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      lines.push('');
      continue;
    }
    let line = '';
    for (const word of paragraph.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (test.length > maxChars && line.length > 0) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export interface PdfOptions {
  title: string;
  /** Body text — paragraphs separated by blank lines. Supports basic ASCII. */
  body: string;
  fontSize?: number;    // default 11
  margin?: number;      // default 50
}

/**
 * Generate a minimal single-page PDF and return it as a Buffer.
 */
export function generatePdf(options: PdfOptions): Buffer {
  const fontSize = options.fontSize ?? 11;
  const margin = options.margin ?? 50;
  const pageWidth = 612;
  const pageHeight = 792;
  const lineHeight = fontSize * 1.6;
  const usableWidth = pageWidth - 2 * margin;
  const titleSize = 18;
  const titleLineHeight = titleSize * 1.6;

  // Build all text lines
  const content: string[] = [];
  let y = pageHeight - margin;

  // Title
  content.push(
    `BT /F1 ${titleSize} Tf ${margin} ${y} Td (${escapePdfString(options.title)}) Tj ET`
  );
  y -= titleLineHeight + 6;

  // Separator
  const sep = '─'.repeat(Math.floor(usableWidth / (titleSize * 0.6)));
  content.push(
    `BT /F1 ${fontSize} Tf ${margin} ${y} Td (${escapePdfString(sep)}) Tj ET`
  );
  y -= lineHeight + 4;

  // Body
  const bodyLines = wrapText(options.body, usableWidth, fontSize);
  for (const line of bodyLines) {
    if (y < margin + lineHeight) break; // stop at page bottom
    const escaped = line ? escapePdfString(line) : ' ';
    content.push(
      `BT /F1 ${fontSize} Tf ${margin} ${y} Td (${escaped}) Tj ET`
    );
    y -= lineHeight;
  }

  const streamContent = content.join('\n');

  // Build PDF objects
  const catalog = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj';
  const pages = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj';
  const page = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}]\n/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj`;
  const contents = `4 0 obj\n<< /Length ${streamContent.length + 1} >>\nstream\n${streamContent}\nendstream\nendobj`;
  const font = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj';

  // Build PDF
  const header = '%PDF-1.4\n%âãÏÓ\n';
  const objects = [catalog, pages, page, contents, font];

  // Build xref table
  const offsets: number[] = [];
  let pos = header.length;
  for (const obj of objects) {
    offsets.push(pos);
    pos += obj.length + 1; // +1 for newline
  }

  const xrefStart = pos;
  let xref = 'xref\n';
  xref += `0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (const offset of offsets) {
    xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const pdf = header + objects.join('\n') + '\n' + xref + trailer;
  return Buffer.from(pdf, 'latin1');
}
