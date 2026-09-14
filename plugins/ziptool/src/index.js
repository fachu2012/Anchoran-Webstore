/**
 * Zip Tool — ported from Anchoran OS's bundled "ziptool" app, ADAPTED
 * for the plugin sandbox: the original operated directly on Anchoran's
 * own virtual filesystem (window.anchoran.fsReadBinary/fsWriteDataUrl/
 * AnchoranFilePicker) to export a real OS folder to .zip, or extract/
 * add into one in place — a plugin has no such privileged filesystem
 * access and genuinely cannot browse or write Anchoran's own folders.
 * This version keeps the same real compression engine (JSZip) but
 * works against files the user explicitly picks via the standard
 * `<input type="file">` picker, and hands results back the same way —
 * as a real downloadable .zip, or as individual extracted files you
 * save — instead of writing into Anchoran's virtual folders directly.
 */
import JSZip from "jszip";
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.zt-content{display:flex;flex-direction:column;gap:18px;}
.zt-section{display:flex;flex-direction:column;gap:8px;}
.zt-section-title{font-size:12.5px;font-weight:500;}
.zt-status{font-size:12px;color:var(--anchoran-text-secondary,#9aa0ab);white-space:pre-wrap;}
.zt-file-list{display:flex;flex-direction:column;gap:4px;}
.zt-file-row{display:flex;align-items:center;justify-content:space-between;font-size:12px;padding:4px 8px;border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;}
`;

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function mount(container, sdk) {
  injectStyle("ziptool", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef } = React;

  function App() {
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState(null);
    const [extracted, setExtracted] = useState(null);
    const compressInputRef = useRef(null);
    const extractInputRef = useRef(null);

    async function onCompressFiles(e) {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) return;
      setBusy(true);
      setStatus(null);
      try {
        const zip = new JSZip();
        for (const file of files) zip.file(file.name, await file.arrayBuffer());
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(files.length === 1 ? `${files[0].name}.zip` : "archive.zip", blob);
        setStatus(`Compressed ${files.length} file${files.length === 1 ? "" : "s"} — download started.`);
        sdk.pushNotification("Zip Tool", "Your zip file is ready.");
      } catch (err) {
        setStatus(`Couldn't compress: ${err?.message ?? err}`);
      } finally {
        setBusy(false);
        e.target.value = "";
      }
    }

    async function onPickZipToExtract(e) {
      const file = e.target.files?.[0];
      if (!file) return;
      setBusy(true);
      setStatus(null);
      setExtracted(null);
      try {
        const zip = await JSZip.loadAsync(file);
        const entries = [];
        for (const [path, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          entries.push({ path, entry });
        }
        setExtracted({ zipName: file.name, entries });
        setStatus(`Found ${entries.length} file${entries.length === 1 ? "" : "s"} in "${file.name}". Click one below to save it.`);
      } catch (err) {
        setStatus(`Couldn't read that zip: ${err?.message ?? err}`);
      } finally {
        setBusy(false);
        e.target.value = "";
      }
    }

    async function saveExtractedEntry(path, entry) {
      const blob = await entry.async("blob");
      downloadBlob(path.split("/").pop(), blob);
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-content zt-content" },
        h(
          "div",
          { className: "zt-section" },
          h("div", { className: "zt-section-title" }, "Compress files into a .zip"),
          h("input", { ref: compressInputRef, type: "file", multiple: true, style: { display: "none" }, onChange: onCompressFiles }),
          h("button", { className: "pk-btn", onClick: () => compressInputRef.current?.click(), disabled: busy }, Icon ? h(Icon, { name: "zipTool", size: 14 }) : null, " Choose files to compress…")
        ),
        h(
          "div",
          { className: "zt-section" },
          h("div", { className: "zt-section-title" }, "Extract a .zip"),
          h("input", { ref: extractInputRef, type: "file", accept: ".zip", style: { display: "none" }, onChange: onPickZipToExtract }),
          h("button", { className: "pk-btn", onClick: () => extractInputRef.current?.click(), disabled: busy }, "Choose a .zip file…"),
          extracted &&
            h(
              "div",
              { className: "zt-file-list" },
              extracted.entries.map(({ path, entry }) =>
                h(
                  "div",
                  { key: path, className: "zt-file-row" },
                  h("span", null, path),
                  h("button", { className: "pk-btn", onClick: () => saveExtractedEntry(path, entry) }, "Save")
                )
              )
            )
        ),
        status && h("div", { className: "zt-status" }, status)
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
