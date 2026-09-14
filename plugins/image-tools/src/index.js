/**
 * Image Tools — fuses two former Anchoran OS bundled apps that both
 * generate/capture an image: "screenshot" (Screenshot.tsx) and
 * "wallpapermaker" (WallpaperMaker.tsx). ("photoviewer" was originally
 * planned as a third tab here, but Files.tsx's `openEntry` uses
 * "photoViewer" directly as the OS's default handler for opening an
 * image file — the same kind of internal file-type-handler wiring
 * "notes", "mediaPlayer" and "browser" turned out to have, discovered
 * mid-migration — so photoViewer stays CORE and bundled, unmigrated,
 * same as those three. See this repo's migration notes / Anchoran
 * OS's CHANGELOG for the full final core list.) Both remaining apps
 * needed real ADAPTATION for the plugin sandbox:
 *
 * - Screenshot: the original used a privileged Electron-only capture
 *   path (window.anchoran.getCaptureSources() + a hide-my-own-window
 *   trick via the internal window store) — this uses the standard
 *   navigator.mediaDevices.getDisplayMedia() picker instead (the same
 *   adaptation as Magnifier/Recorder), with the same region-crop tool
 *   applied to the captured frame, and clipboard copy via the
 *   standard Clipboard API (navigator.clipboard.write with a
 *   ClipboardItem) instead of window.anchoran.copyImageToClipboard.
 * - Wallpaper Maker: the original called Anchoran's internal
 *   usePreferencesStore.setCustomWallpaper() directly — the SDK has no
 *   "set the desktop wallpaper" call (a real gap, not something a
 *   plugin should reach around via internal stores), so "Set as
 *   wallpaper" is replaced with "Download" everywhere across this
 *   plugin; a downloaded image can still be set as wallpaper from
 *   Settings the normal way. This is the one feature this migration
 *   could not preserve 1:1 — flagged here rather than silently
 *   dropped or faked.
 *
 * All three keep their real generation/editing logic (canvas rotation,
 * pattern rendering, region-crop math) unchanged.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.it-content{display:flex;flex-direction:column;gap:10px;height:100%;}
.it-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px;}
.it-thumb{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font-size:11px;}
.it-thumb img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;border:1px solid var(--anchoran-border,#2a2c33);}
.it-full{flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;}
.it-full img{max-width:100%;max-height:100%;}
.it-hint{color:var(--anchoran-text-secondary,#9aa0ab);font-size:12.5px;text-align:center;padding:30px;}
.it-error{color:#E5484D;font-size:12.5px;}
.it-preview{flex:1;display:flex;align-items:center;justify-content:center;}
.it-preview img{max-width:100%;max-height:100%;border-radius:8px;}
.it-region-overlay{position:fixed;inset:0;z-index:900;background-size:cover;cursor:crosshair;}
.it-region-box{position:absolute;border:2px solid var(--anchoran-accent,#5B8DEF);background:rgba(91,141,239,.15);}
.it-region-hint{position:absolute;top:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.7);color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;}
.it-wallpaper-canvas{border-radius:8px;border:1px solid var(--anchoran-border,#2a2c33);}
.it-wallpaper-palettes{display:flex;gap:8px;}
.it-wallpaper-palette-btn{width:32px;height:32px;border-radius:8px;border:2px solid transparent;cursor:pointer;}
.it-wallpaper-palette-btn[data-active="true"]{border-color:var(--anchoran-accent,#5B8DEF);}
`;

function downloadDataUrl(filename, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function mount(container, sdk) {
  injectStyle("image-tools", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef, useEffect } = React;

  // ---- Screenshot ----
  function ScreenshotPanel() {
    const [captured, setCaptured] = useState(null);
    const [error, setError] = useState(null);
    const [copied, setCopied] = useState(false);
    const [selecting, setSelecting] = useState(null);

    async function captureToCanvas() {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((r) => setTimeout(r, 150));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      return canvas;
    }

    async function capture() {
      setError(null);
      if (!navigator.mediaDevices?.getDisplayMedia) { setError("Screen capture isn't available in this environment."); return; }
      try {
        const canvas = await captureToCanvas();
        setCaptured(canvas.toDataURL("image/png"));
      } catch {
        setError("Couldn't capture the screen (permission denied or cancelled).");
      }
    }

    async function captureForRegion() {
      setError(null);
      if (!navigator.mediaDevices?.getDisplayMedia) { setError("Screen capture isn't available in this environment."); return; }
      try {
        const canvas = await captureToCanvas();
        setSelecting({ canvas, snapshotUrl: canvas.toDataURL("image/png") });
      } catch {
        setError("Couldn't capture the screen (permission denied or cancelled).");
      }
    }

    function onRegionSelected(rect) {
      if (!selecting) return;
      const scaleX = selecting.canvas.width / window.innerWidth;
      const scaleY = selecting.canvas.height / window.innerHeight;
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = Math.max(1, Math.round(rect.width * scaleX));
      cropCanvas.height = Math.max(1, Math.round(rect.height * scaleY));
      cropCanvas.getContext("2d").drawImage(selecting.canvas, rect.x * scaleX, rect.y * scaleY, rect.width * scaleX, rect.height * scaleY, 0, 0, cropCanvas.width, cropCanvas.height);
      setCaptured(cropCanvas.toDataURL("image/png"));
      setSelecting(null);
    }

    function download() {
      if (!captured) return;
      downloadDataUrl(`Screenshot ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.png`, captured);
    }

    async function copyToClipboard() {
      if (!captured) return;
      try {
        const blob = await (await fetch(captured)).blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      } catch {
        setError("Couldn't copy to clipboard in this environment.");
      }
    }

    function RegionSelector({ snapshotUrl, onSelect, onCancel }) {
      const [start, setStart] = useState(null);
      const [current, setCurrent] = useState(null);
      useEffect(() => {
        function onKeyDown(e) { if (e.key === "Escape") onCancel(); }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
      }, [onCancel]);
      const rect = start && current ? { x: Math.min(start.x, current.x), y: Math.min(start.y, current.y), width: Math.abs(current.x - start.x), height: Math.abs(current.y - start.y) } : null;
      return h(
        "div",
        {
          className: "it-region-overlay",
          style: { backgroundImage: `url(${snapshotUrl})` },
          onMouseDown: (e) => { setStart({ x: e.clientX, y: e.clientY }); setCurrent({ x: e.clientX, y: e.clientY }); },
          onMouseMove: (e) => start && setCurrent({ x: e.clientX, y: e.clientY }),
          onMouseUp: () => { if (rect && rect.width > 4 && rect.height > 4) onSelect(rect); else { setStart(null); setCurrent(null); } },
        },
        rect && h("div", { className: "it-region-box", style: { left: rect.x, top: rect.y, width: rect.width, height: rect.height } }),
        h("div", { className: "it-region-hint" }, "Drag to select an area — Esc to cancel")
      );
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: capture }, Icon ? h(Icon, { name: "screenshot", size: 14 }) : null, " Capture"),
        h("button", { className: "pk-btn", onClick: captureForRegion }, "Select area…"),
        captured && h(React.Fragment, null, h("button", { className: "pk-btn", onClick: copyToClipboard }, copied ? "Copied" : "Copy"), h("button", { className: "pk-btn", onClick: download }, "Download"))
      ),
      h(
        "div",
        { className: "pk-content" },
        error && h("div", { className: "it-error" }, error),
        captured ? h("div", { className: "it-preview" }, h("img", { src: captured, alt: "Captured screenshot" })) : !error && h("div", { className: "it-hint" }, "Click Capture for a full screen/window, or Select area… to crop a region.")
      ),
      selecting && h(RegionSelector, { snapshotUrl: selecting.snapshotUrl, onSelect: onRegionSelected, onCancel: () => setSelecting(null) })
    );
  }

  // ---- Wallpaper Maker ----
  const WALLPAPER_PALETTES = [
    ["#1E3A8A", "#6E9BF7"], ["#0F766E", "#2ECC71"], ["#7C3AED", "#EC4899"],
    ["#B45309", "#F5C518"], ["#111827", "#374151"], ["#DC2626", "#F97316"],
  ];
  function renderWallpaper(ctx, w, hgt, pattern, colors) {
    ctx.clearRect(0, 0, w, hgt);
    if (pattern === "gradient") {
      const g = ctx.createLinearGradient(0, 0, w, hgt);
      g.addColorStop(0, colors[0]); g.addColorStop(1, colors[1]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, hgt);
    } else if (pattern === "radial") {
      const g = ctx.createRadialGradient(w / 2, hgt / 2, 0, w / 2, hgt / 2, Math.max(w, hgt) / 1.2);
      g.addColorStop(0, colors[1]); g.addColorStop(1, colors[0]);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, hgt);
    } else if (pattern === "stripes") {
      ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, w, hgt);
      ctx.fillStyle = colors[1];
      const stripeWidth = 40;
      for (let x = -hgt; x < w; x += stripeWidth * 2) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, 0); ctx.lineTo(x + hgt, hgt); ctx.lineTo(x + hgt + stripeWidth, hgt); ctx.lineTo(x + stripeWidth, 0);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    } else if (pattern === "dots") {
      ctx.fillStyle = colors[0]; ctx.fillRect(0, 0, w, hgt);
      ctx.fillStyle = colors[1];
      const spacing = 36;
      for (let y = spacing / 2; y < hgt; y += spacing) for (let x = spacing / 2; x < w; x += spacing) { ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function WallpaperPanel() {
    const canvasRef = useRef(null);
    const [pattern, setPattern] = useState("gradient");
    const [palette, setPalette] = useState(WALLPAPER_PALETTES[0]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      renderWallpaper(canvas.getContext("2d"), canvas.width, canvas.height, pattern, palette);
    }, [pattern, palette]);

    function exportDataUrl() {
      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      renderWallpaper(canvas.getContext("2d"), canvas.width, canvas.height, pattern, palette);
      return canvas.toDataURL("image/png");
    }

    function download() {
      downloadDataUrl(`Wallpaper ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.png`, exportDataUrl());
      sdk.pushNotification("Image Tools", "Wallpaper downloaded — set it from Settings > Appearance.");
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        ["gradient", "radial", "stripes", "dots"].map((p) => h("button", { key: p, className: "pk-btn", "data-active": pattern === p, onClick: () => setPattern(p) }, p[0].toUpperCase() + p.slice(1)))
      ),
      h(
        "div",
        { className: "pk-content", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14 } },
        h("canvas", { ref: canvasRef, width: 480, height: 270, className: "it-wallpaper-canvas" }),
        h("div", { className: "it-wallpaper-palettes" }, WALLPAPER_PALETTES.map((p, i) => h("button", { key: i, className: "it-wallpaper-palette-btn", "data-active": palette[0] === p[0] && palette[1] === p[1], style: { background: `linear-gradient(135deg, ${p[0]}, ${p[1]})` }, onClick: () => setPalette(p) }))),
        h("button", { className: "pk-btn", onClick: download }, "Download (set from Settings)")
      )
    );
  }

  function App() {
    const [tab, setTab] = useState("screenshot");
    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar", style: { borderBottom: "1px solid var(--anchoran-border,#2a2c33)" } },
        h("button", { className: "pk-btn", "data-active": tab === "screenshot", onClick: () => setTab("screenshot") }, "Screenshot"),
        h("button", { className: "pk-btn", "data-active": tab === "wallpaper", onClick: () => setTab("wallpaper") }, "Wallpaper Maker")
      ),
      tab === "screenshot" ? h(ScreenshotPanel) : h(WallpaperPanel)
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
