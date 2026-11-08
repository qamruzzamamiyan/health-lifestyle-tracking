import { csvRoadmapToText, jsonRoadmapToText } from "./roadmapParser";

// All processing happens in the browser. Files are never sent to an API.
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TEXT = 160000;
const allowed = ".txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp";
export const roadmapFileAccept = allowed;

function xmlDoc(text) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Invalid office document XML.");
  return doc;
}
function tags(parent, localName) { return Array.from(parent.getElementsByTagName("*")).filter((node) => node.localName === localName); }
function textTags(parent, name = "t") { return tags(parent, name).map((node) => node.textContent || "").join(""); }
function xmlEntry(zip, path) { return zip.file(path)?.async("text"); }

async function readOffice(file, ext) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const lines = [];
  if (ext === "docx") {
    const xml = await xmlEntry(zip, "word/document.xml");
    if (!xml) throw new Error("DOCX document content was not found.");
    const doc = xmlDoc(xml);
    for (const p of tags(doc, "p")) {
      const content = textTags(p).trim(); if (!content) continue;
      const style = tags(p, "pStyle")[0]?.getAttribute("w:val") || "";
      const numbered = tags(p, "numPr").length > 0;
      lines.push(/^Heading\d?/i.test(style) ? `## ${content}` : numbered ? `- ${content}` : content);
    }
  } else if (ext === "pptx") {
    const names = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/i.test(path))
      .sort((a,b) => Number(a.match(/slide(\d+)/i)[1]) - Number(b.match(/slide(\d+)/i)[1]));
    if (!names.length) throw new Error("No readable PPTX slides found.");
    for (const path of names.slice(0, 100)) {
      const doc = xmlDoc(await xmlEntry(zip, path));
      const fragments = tags(doc, "p").map((p) => textTags(p).trim()).filter(Boolean);
      if (fragments.length) {
        lines.push(`## Slide ${path.match(/slide(\d+)/i)[1]}`);
        lines.push(...fragments.map((x) => `- ${x}`));
      }
    }
  } else if (ext === "xlsx") {
    const shared = await xmlEntry(zip, "xl/sharedStrings.xml");
    const strings = shared ? tags(xmlDoc(shared), "si").map((si) => textTags(si)) : [];
    const sheets = Object.keys(zip.files).filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(path))
      .sort((a,b) => Number(a.match(/sheet(\d+)/i)[1]) - Number(b.match(/sheet(\d+)/i)[1]));
    for (const path of sheets.slice(0, 10)) {
      const doc = xmlDoc(await xmlEntry(zip, path));
      lines.push(`## Sheet ${path.match(/sheet(\d+)/i)[1]}`);
      for (const r of tags(doc, "row").slice(0, 2000)) {
        const cells = tags(r, "c").map((cell) => {
          const value = tags(cell, "v")[0]?.textContent || "";
          if (cell.getAttribute("t") === "s") return strings[Number(value)] || "";
          if (cell.getAttribute("t") === "inlineStr") return textTags(cell);
          return value;
        }).map((x) => x.trim()).filter(Boolean);
        if (cells.length) lines.push(`- ${cells.join(" — ")}`);
      }
    }
  }
  return lines.join("\n").slice(0, MAX_TEXT);
}

async function readPdf(file) {
  const pdfjs = await import("pdfjs-dist");
  const workerModule = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loading.promise;
  const result = [];
  const pageLimit = Math.min(pdf.numPages, 40);
  try {
    for (let p = 1; p <= pageLimit; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();
      let previousY = null, buffer = "";
      const lines = [];
      for (const item of content.items) {
        if (!item.str) continue;
        const y = item.transform?.[5] ?? 0;
        if (previousY !== null && Math.abs(y - previousY) > 3) {
          if (buffer.trim()) lines.push(buffer.trim());
          buffer = "";
        }
        buffer += (buffer ? " " : "") + item.str;
        previousY = y;
      }
      if (buffer.trim()) lines.push(buffer.trim());
      if (lines.length) result.push(...lines);
    }
  } finally { await pdf.destroy(); }
  if (!result.join("").trim()) throw new Error("This PDF appears scanned/image-only. Upload its page screenshot (PNG/JPG) for OCR, or paste its text.");
  return result.join("\n").slice(0, MAX_TEXT);
}

async function readImage(file) {
  // OCR is executed locally; Tesseract may download/caches its language model on first use.
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  try {
    const data = await worker.recognize(file);
    if (!data?.data?.text?.trim()) throw new Error("No readable English text detected. Try a sharper picture or paste the list.");
    return data.data.text.slice(0, MAX_TEXT);
  } finally { await worker.terminate(); }
}

export async function readRoadmapFile(file) {
  if (!file) throw new Error("Choose a file.");
  if (file.size > MAX_FILE_BYTES) throw new Error("File is too large (15 MB limit). Paste text or use a smaller file.");
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!["txt", "md", "markdown", "csv", "tsv", "json", "html", "htm", "pdf", "docx", "pptx", "xlsx", "png", "jpg", "jpeg", "webp"].includes(ext)) {
    throw new Error("Unsupported file format. Use TXT, MD, CSV, JSON, HTML, PDF, DOCX, PPTX, XLSX, or PNG/JPG/WEBP—or paste the AI response.");
  }
  let text = "";
  if (["txt", "md", "markdown"].includes(ext)) text = await file.text();
  else if (["csv", "tsv"].includes(ext)) text = csvRoadmapToText(await file.text());
  else if (ext === "json") {
    try { text = jsonRoadmapToText(JSON.parse(await file.text())); }
    catch { throw new Error("Invalid JSON file."); }
  } else if (ext === "html" || ext === "htm") {
    const doc = new DOMParser().parseFromString(await file.text(), "text/html");
    doc.querySelectorAll("script,style,noscript,svg").forEach((node) => node.remove());
    doc.querySelectorAll("li").forEach((node) => node.prepend("• "));
    text = doc.body.innerText || doc.body.textContent || "";
  } else if (["docx", "pptx", "xlsx"].includes(ext)) text = await readOffice(file, ext);
  else if (ext === "pdf") text = await readPdf(file);
  else text = await readImage(file);
  return text.slice(0, MAX_TEXT);
}
