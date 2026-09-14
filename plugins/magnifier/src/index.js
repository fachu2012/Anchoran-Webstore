/**
 * Magnifier — ported from Anchoran OS's bundled "magnifier" app,
 * ADAPTED for the plugin sandbox: the original used a privileged
 * Electron-only capture path (window.anchoran.getCaptureSources() +
 * chromeMediaSourceId), which a plugin has no access to. This version
 * uses the standard `navigator.mediaDevices.getDisplayMedia()` Web API
 * instead — the browser/Electron's own "choose a screen or window to
 * share" picker — which needs no Anchoran-internal API at all. Once a
 * stream is picked, the same requestAnimationFrame lens-drawing logic
 * as the original runs unchanged.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.mg-hint-row{margin-left:auto;font-size:12px;color:var(--anchoran-text-secondary,#9aa0ab);}
.mg-zoom-row{display:flex;gap:6px;margin-left:auto;}
.mg-stage{position:relative;flex:1;display:flex;align-items:center;justify-content:center;background:var(--anchoran-bg,#141519);overflow:hidden;}
.mg-canvas{border:1px solid var(--anchoran-border,#2a2c33);border-radius:8px;max-width:100%;max-height:100%;}
.mg-error{position:absolute;color:#E5484D;font-size:12.5px;padding:16px;text-align:center;}
.mg-hint{position:absolute;color:var(--anchoran-text-secondary,#9aa0ab);font-size:12.5px;}
`;

const ZOOM_LEVELS = [2, 3, 4];

export function mount(container, sdk) {
  injectStyle("magnifier", CSS);
  const { React, ReactDOM } = sdk;
  const { createElement: h, useState, useRef, useEffect } = React;

  function App() {
    const stageRef = useRef(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mouse = useRef({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(2);
    const [error, setError] = useState(null);
    const [active, setActive] = useState(false);

    function stopCurrentStream() {
      const stream = videoRef.current?.srcObject;
      stream?.getTracks().forEach((t) => t.stop());
      videoRef.current = null;
    }

    async function start() {
      setError(null);
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setError("Screen capture isn't available in this environment.");
        return;
      }
      stopCurrentStream();
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const video = document.createElement("video");
        video.srcObject = stream;
        await video.play();
        videoRef.current = video;
        setActive(true);
      } catch (err) {
        setError(`Couldn't start screen capture${err && err.message ? `: ${err.message}` : "."}`);
      }
    }

    useEffect(() => {
      if (!active) return;
      let raf;
      function draw() {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        const stage = stageRef.current;
        if (canvas && video && video.videoWidth && stage) {
          const ctx = canvas.getContext("2d");
          const rect = stage.getBoundingClientRect();
          const scaleX = video.videoWidth / window.innerWidth;
          const scaleY = video.videoHeight / window.innerHeight;
          const srcW = (rect.width / zoom) * scaleX;
          const srcH = (rect.height / zoom) * scaleY;
          const srcX = mouse.current.x * scaleX - srcW / 2;
          const srcY = mouse.current.y * scaleY - srcH / 2;
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
        }
        raf = requestAnimationFrame(draw);
      }
      raf = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(raf);
    }, [active, zoom]);

    useEffect(() => stopCurrentStream, []);

    useEffect(() => {
      function onMove(e) {
        mouse.current = { x: e.clientX, y: e.clientY };
      }
      window.addEventListener("mousemove", onMove);
      return () => window.removeEventListener("mousemove", onMove);
    }, []);

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        !active ? h("button", { className: "pk-btn", onClick: start }, "Start magnifier") : h("span", { className: "mg-hint-row" }, "Move your mouse over the panel below"),
        h("div", { className: "mg-zoom-row" }, ZOOM_LEVELS.map((z) => h("button", { key: z, className: "pk-btn", "data-active": zoom === z, onClick: () => setZoom(z) }, `${z}x`)))
      ),
      h(
        "div",
        { ref: stageRef, className: "mg-stage" },
        error && h("div", { className: "mg-error" }, error),
        !active && !error && h("div", { className: "mg-hint" }, 'Click "Start magnifier" to begin.'),
        h("canvas", { ref: canvasRef, width: 640, height: 400, className: "mg-canvas" })
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
