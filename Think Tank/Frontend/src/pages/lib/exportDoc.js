/**
 * Printing and PDF, from whatever is already on the screen.
 *
 * Both exports are driven from one hidden, page-width copy of the description
 * — see PrintableDescription — rather than from the editor the author is
 * typing into. A flowchart's arrows are measured from the boxes that were
 * actually laid out, so there is no second implementation of the drawing to
 * keep in step; and it means the four description types need no four exports
 * between them. What is printed is what a reader sees on the discussion page.
 *
 * Printing borrows the app's own stylesheets so the paper matches the screen.
 * The PDF is a real file, saved without a dialog — the reason the browser's
 * "Print to PDF" is not enough on its own, and the reason jsPDF and
 * html2canvas are pulled in only when somebody actually asks for one.
 */

/** A filename that will not upset a filesystem: "Weekend Loan Desk" → weekend-loan-desk. */
export function slugify(text, fallback = 'idea') {
  const slug = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

/** Every stylesheet the app is currently using, to be replayed on paper. */
function appStyles() {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join('\n');
}

/* A4 with a sensible margin, and the few rules the screen does not need:
   nothing may run off the side of the sheet, and a drawing or a bullet is not
   split down the middle by a page break. */
const PAGE_CSS = `
  @page { size: A4; margin: 14mm; }
  html, body {
    background: #fff !important;
    margin: 0;
    padding: 0;
    width: auto;
    min-height: 0;
    overflow: visible;
  }
  body { font-size: 12.5px; }
  .pr-doc { width: 100%; max-width: 100%; }
  .pr-doc img, .pr-doc svg { max-width: 100%; }
  .pr-doc .fc-stage,
  .pr-doc .fc-canvas { break-inside: avoid; page-break-inside: avoid; }
  .pr-doc li, .pr-doc p { break-inside: avoid; page-break-inside: avoid; }
  .pr-doc h1, .pr-doc h2, .pr-doc h3, .pr-doc h4 { break-after: avoid; page-break-after: avoid; }
`;

/** The whole print document, as a string. */
function printDocument(title, bodyHtml) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${String(title).replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</title>
${appStyles()}
<style>${PAGE_CSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

/**
 * Send the node to the printer.
 *
 * An off-screen iframe rather than a popup window: a popup is blocked on a
 * phone as often as not, and this needs no permission. The frame waits for its
 * stylesheets before printing — printing early gives an unstyled sheet — and
 * takes itself away afterwards.
 */
export function printNode(node, title) {
  if (!node) return Promise.reject(new Error('Nothing to print'));

  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(frame);

    const cleanup = () => {
      // After the dialog closes. Removing it immediately cancels the job in Safari.
      setTimeout(() => frame.remove(), 1000);
    };

    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) { frame.remove(); reject(new Error('Could not open the print view')); return; }

      /* Images and fonts settle a beat after load; printing on the same tick
         gives a half-drawn first page. */
      const go = () => {
        try {
          win.focus();
          win.print();
          resolve();
        } catch (err) {
          reject(err);
        } finally {
          cleanup();
        }
      };
      if (win.document.fonts?.ready) win.document.fonts.ready.then(() => setTimeout(go, 120)).catch(go);
      else setTimeout(go, 250);
    };

    const doc = frame.contentDocument;
    doc.open();
    doc.write(printDocument(title, node.outerHTML));
    doc.close();
  });
}

/**
 * Save the node as an A4 PDF.
 *
 * The node is photographed at twice its size, then that picture is laid onto
 * A4 pages at the width of the text column, cutting to a new page each time
 * the sheet fills. A tall flowchart therefore runs over two pages instead of
 * being squeezed until it cannot be read.
 *
 * jsPDF and html2canvas are imported here, not at the top of the file, so the
 * two of them are downloaded the first time somebody saves a PDF and never by
 * anyone who does not.
 */
export async function pdfFromNode(node, filename) {
  if (!node) throw new Error('Nothing to save');

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const canvas = await html2canvas(node, {
    scale: Math.min(2, window.devicePixelRatio * 1.5 || 2),
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: node.scrollWidth,
  });

  const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
  const margin = 34;                                   // ~12mm
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const printW = pageW - margin * 2;
  const printH = pageH - margin * 2;

  // How tall the whole picture is once scaled to the column width.
  const fullH = (canvas.height * printW) / canvas.width;

  if (fullH <= printH) {
    pdf.addImage(canvas, 'PNG', margin, margin, printW, fullH, undefined, 'FAST');
  } else {
    /* Taller than one sheet: slice the canvas into page-height bands and put
       one band on each page. Slicing the source rather than shifting the whole
       image keeps every page the same crispness. */
    const bandPx = Math.floor((printH * canvas.width) / printW);
    const slice = document.createElement('canvas');
    const ctx = slice.getContext('2d');
    slice.width = canvas.width;

    for (let y = 0, page = 0; y < canvas.height; y += bandPx, page += 1) {
      const h = Math.min(bandPx, canvas.height - y);
      slice.height = h;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, h);
      ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);

      if (page > 0) pdf.addPage();
      pdf.addImage(slice, 'PNG', margin, margin, printW, (h * printW) / canvas.width, undefined, 'FAST');
    }
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
