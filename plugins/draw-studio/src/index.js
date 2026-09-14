/**
 * Draw Studio — fuses two former Anchoran OS bundled apps with the
 * same purpose (freehand image creation): "paint" (Paint.tsx, a
 * continuous raster canvas) and "pixelart" (PixelArt.tsx, a fixed
 * pixel grid) — kept as two tabs since they're genuinely different
 * drawing paradigms, not the same tool twice. Per this migration's
 * explicit brief to make fused apps worth installing rather than
 * porting them as-is, this plugin adds real value on top of both
 * originals: a custom color picker (not just a fixed palette) on both
 * tabs, a fill/bucket tool, basic shapes (line/rectangle/ellipse) and
 * an adjustable brush size on the Canvas tab, simple layers (add,
 * delete, toggle visibility, reorder-free stack composited live) on
 * the Canvas tab, and undo/redo history on both tabs. "Save to Files"
 * (Anchoran's internal Pictures folder) is replaced with a real PNG
 * download, since a plugin can't write into Anchoran's own folders.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.ds-content{display:flex;flex-direction:column;gap:10px;height:100%;}
.ds-body{display:flex;gap:10px;flex:1;min-height:0;}
.ds-palette{display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;width:150px;flex-shrink:0;}
.ds-swatch{width:22px;height:22px;border-radius:5px;border:2px solid transparent;cursor:pointer;}
.ds-swatch[data-active="true"]{border-color:var(--anchoran-accent,#5B8DEF);}
.ds-color-input{width:32px;height:32px;padding:0;border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;cursor:pointer;}
.ds-canvas-wrap{flex:1;display:flex;align-items:center;justify-content:center;overflow:auto;background:var(--anchoran-bg,#141519);border-radius:8px;}
.ds-canvas{border:1px solid var(--anchoran-border,#2a2c33);background:#fff;touch-action:none;cursor:crosshair;}
.ds-pixel-grid{display:grid;border:1px solid var(--anchoran-border,#2a2c33);background:#fff;}
.ds-pixel-cell{box-sizing:border-box;border:1px solid rgba(0,0,0,.05);}
.ds-layers{width:130px;flex-shrink:0;display:flex;flex-direction:column;gap:4px;}
.ds-layer-row{display:flex;align-items:center;gap:4px;font-size:11px;padding:4px 6px;border-radius:6px;border:1px solid var(--anchoran-border,#2a2c33);}
.ds-layer-row[data-active="true"]{border-color:var(--anchoran-accent,#5B8DEF);}
.ds-layer-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;}
.ds-layer-btn{background:transparent;border:none;color:var(--anchoran-text-secondary,#9aa0ab);cursor:pointer;padding:2px;}
.ds-size-row{display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
`;

const PALETTE = ["#14161B", "#FFFFFF", "#E5484D", "#F5A623", "#F5C518", "#2ECC71", "#1E9BF0", "#7C3AED", "#EC4899", "#8B5A2B"];

function downloadDataUrl(filename, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function mount(container, sdk) {
  injectStyle("draw-studio", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef, useEffect, useCallback } = React;

  // ---- Canvas tab: layered raster drawing with brush/eraser/fill/shapes ----
  function CanvasPanel() {
    const CANVAS_W = 760;
    const CANVAS_H = 460;
    const visibleRef = useRef(null);
    const drawing = useRef(false);
    const shapeStart = useRef(null);
    const snapshotBeforeStroke = useRef(null);

    const [layers, setLayers] = useState(() => [{ id: "1", name: "Layer 1", visible: true, canvas: makeLayerCanvas() }]);
    const [activeLayerId, setActiveLayerId] = useState("1");
    const [color, setColor] = useState(PALETTE[0]);
    const [size, setSize] = useState(4);
    const [tool, setTool] = useState("brush"); // brush | eraser | fill | line | rect | ellipse
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);

    function makeLayerCanvas() {
      const c = document.createElement("canvas");
      c.width = CANVAS_W;
      c.height = CANVAS_H;
      return c;
    }

    const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];

    const composite = useCallback(() => {
      const visible = visibleRef.current;
      if (!visible) return;
      const ctx = visible.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      for (const l of layers) if (l.visible) ctx.drawImage(l.canvas, 0, 0);
    }, [layers]);

    useEffect(composite, [composite]);

    function pushUndo() {
      const snap = activeLayer.canvas.getContext("2d").getImageData(0, 0, CANVAS_W, CANVAS_H);
      setUndoStack((s) => [...s, { layerId: activeLayer.id, data: snap }].slice(-30));
      setRedoStack([]);
    }

    function undo() {
      setUndoStack((stack) => {
        if (stack.length === 0) return stack;
        const last = stack[stack.length - 1];
        const layer = layers.find((l) => l.id === last.layerId);
        if (layer) {
          const ctx = layer.canvas.getContext("2d");
          const redoSnap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
          setRedoStack((r) => [...r, { layerId: last.layerId, data: redoSnap }]);
          ctx.putImageData(last.data, 0, 0);
          composite();
        }
        return stack.slice(0, -1);
      });
    }
    function redo() {
      setRedoStack((stack) => {
        if (stack.length === 0) return stack;
        const last = stack[stack.length - 1];
        const layer = layers.find((l) => l.id === last.layerId);
        if (layer) {
          const ctx = layer.canvas.getContext("2d");
          const undoSnap = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
          setUndoStack((u) => [...u, { layerId: last.layerId, data: undoSnap }]);
          ctx.putImageData(last.data, 0, 0);
          composite();
        }
        return stack.slice(0, -1);
      });
    }

    function getPos(e) {
      const canvas = visibleRef.current;
      const rect = canvas.getBoundingClientRect();
      return { x: ((e.clientX - rect.left) / rect.width) * CANVAS_W, y: ((e.clientY - rect.top) / rect.height) * CANVAS_H };
    }

    function floodFill(ctx, startX, startY, fillColor) {
      const imgData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      const data = imgData.data;
      const w = CANVAS_W;
      const idx = (x, y) => (y * w + x) * 4;
      const sx = Math.floor(startX), sy = Math.floor(startY);
      if (sx < 0 || sy < 0 || sx >= w || sy >= CANVAS_H) return;
      const target = data.slice(idx(sx, sy), idx(sx, sy) + 4);
      const fill = hexToRgba(fillColor);
      if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2] && target[3] === fill[3]) return;
      const stack = [[sx, sy]];
      const matches = (i) => data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2] && data[i + 3] === target[3];
      while (stack.length) {
        const [x, y] = stack.pop();
        if (x < 0 || y < 0 || x >= w || y >= CANVAS_H) continue;
        const i = idx(x, y);
        if (!matches(i)) continue;
        data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = fill[3];
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      ctx.putImageData(imgData, 0, 0);
    }
    function hexToRgba(hex) {
      const n = parseInt(hex.replace("#", ""), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    }

    function onPointerDown(e) {
      const ctx = activeLayer.canvas.getContext("2d");
      const pos = getPos(e);
      pushUndo();
      if (tool === "fill") {
        floodFill(ctx, pos.x, pos.y, color);
        composite();
        return;
      }
      if (tool === "line" || tool === "rect" || tool === "ellipse") {
        shapeStart.current = pos;
        snapshotBeforeStroke.current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
        return;
      }
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    function drawShapePreview(pos) {
      const ctx = activeLayer.canvas.getContext("2d");
      ctx.putImageData(snapshotBeforeStroke.current, 0, 0);
      ctx.lineWidth = size;
      ctx.strokeStyle = color;
      ctx.beginPath();
      if (tool === "line") {
        ctx.moveTo(shapeStart.current.x, shapeStart.current.y);
        ctx.lineTo(pos.x, pos.y);
      } else if (tool === "rect") {
        ctx.rect(shapeStart.current.x, shapeStart.current.y, pos.x - shapeStart.current.x, pos.y - shapeStart.current.y);
      } else if (tool === "ellipse") {
        const rx = Math.abs(pos.x - shapeStart.current.x) / 2;
        const ry = Math.abs(pos.y - shapeStart.current.y) / 2;
        const cx = (pos.x + shapeStart.current.x) / 2;
        const cy = (pos.y + shapeStart.current.y) / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
      composite();
    }

    function onPointerMove(e) {
      const pos = getPos(e);
      if (shapeStart.current) {
        drawShapePreview(pos);
        return;
      }
      if (!drawing.current) return;
      const ctx = activeLayer.canvas.getContext("2d");
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = size;
      ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      composite();
    }

    function onPointerUp() {
      drawing.current = false;
      shapeStart.current = null;
      snapshotBeforeStroke.current = null;
    }

    function addLayer() {
      const id = `${Date.now()}`;
      setLayers((ls) => [...ls, { id, name: `Layer ${ls.length + 1}`, visible: true, canvas: makeLayerCanvas() }]);
      setActiveLayerId(id);
    }
    function removeLayer(id) {
      if (layers.length <= 1) return;
      setLayers((ls) => ls.filter((l) => l.id !== id));
      if (activeLayerId === id) setActiveLayerId(layers[0].id);
    }
    function toggleLayer(id) {
      setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)));
    }

    function clearActiveLayer() {
      pushUndo();
      const ctx = activeLayer.canvas.getContext("2d");
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      composite();
    }

    function exportPng() {
      composite();
      downloadDataUrl(`Painting ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.png`, visibleRef.current.toDataURL("image/png"));
      sdk.pushNotification("Draw Studio", "Image downloaded.");
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        ["brush", "eraser", "fill", "line", "rect", "ellipse"].map((t) => h("button", { key: t, className: "pk-btn", "data-active": tool === t, onClick: () => setTool(t) }, t[0].toUpperCase() + t.slice(1))),
        h("div", { className: "ds-size-row" }, "Size", h("input", { type: "range", min: 1, max: 40, value: size, onChange: (e) => setSize(Number(e.target.value)) }), size),
        h("button", { className: "pk-btn", onClick: undo, disabled: undoStack.length === 0 }, "Undo"),
        h("button", { className: "pk-btn", onClick: redo, disabled: redoStack.length === 0 }, "Redo"),
        h("button", { className: "pk-btn", onClick: clearActiveLayer }, Icon ? h(Icon, { name: "restart", size: 13 }) : null, " Clear layer"),
        h("button", { className: "pk-btn", onClick: exportPng, style: { marginLeft: "auto" } }, "Download PNG")
      ),
      h(
        "div",
        { className: "pk-content ds-content" },
        h(
          "div",
          { className: "ds-body" },
          h(
            "div",
            { className: "ds-palette" },
            h("input", { type: "color", className: "ds-color-input", value: color, onChange: (e) => setColor(e.target.value) }),
            PALETTE.map((c) => h("button", { key: c, className: "ds-swatch", "data-active": color === c, style: { background: c }, onClick: () => setColor(c) }))
          ),
          h(
            "div",
            { className: "ds-canvas-wrap" },
            h("canvas", { ref: visibleRef, width: CANVAS_W, height: CANVAS_H, className: "ds-canvas", onPointerDown, onPointerMove, onPointerUp, onPointerLeave: onPointerUp })
          ),
          h(
            "div",
            { className: "ds-layers" },
            h("div", { style: { fontSize: 11, color: "var(--anchoran-text-secondary,#9aa0ab)" } }, "Layers"),
            layers.map((l) =>
              h(
                "div",
                { key: l.id, className: "ds-layer-row", "data-active": l.id === activeLayerId },
                h("span", { className: "ds-layer-name", onClick: () => setActiveLayerId(l.id) }, l.name),
                h("button", { className: "ds-layer-btn", onClick: () => toggleLayer(l.id) }, l.visible ? "👁" : "—"),
                layers.length > 1 && h("button", { className: "ds-layer-btn", onClick: () => removeLayer(l.id) }, "×")
              )
            ),
            h("button", { className: "pk-btn", onClick: addLayer }, "+ Layer")
          )
        )
      )
    );
  }

  // ---- Pixel Art tab: fixed grid with fill/undo/custom color ----
  function PixelArtPanel() {
    const GRID = 16;
    const CELL_PX = 20;
    function emptyGrid() {
      return new Array(GRID * GRID).fill(null);
    }
    const [pixels, setPixels] = useState(emptyGrid);
    const [color, setColor] = useState(PALETTE[0]);
    const [erasing, setErasing] = useState(false);
    const [history, setHistory] = useState([]);
    const [future, setFuture] = useState([]);
    const painting = useRef(false);

    function commit(next) {
      setHistory((h2) => [...h2, pixels].slice(-30));
      setFuture([]);
      setPixels(next);
    }
    function paint(index) {
      const next = [...pixels];
      next[index] = erasing ? null : color;
      commit(next);
    }
    function fillBucket(index) {
      const target = pixels[index];
      if (target === color) return;
      const next = [...pixels];
      const stack = [index];
      const seen = new Set();
      while (stack.length) {
        const i = stack.pop();
        if (seen.has(i) || i < 0 || i >= GRID * GRID) continue;
        seen.add(i);
        if (next[i] !== target) continue;
        next[i] = color;
        const x = i % GRID, y = Math.floor(i / GRID);
        if (x > 0) stack.push(i - 1);
        if (x < GRID - 1) stack.push(i + 1);
        if (y > 0) stack.push(i - GRID);
        if (y < GRID - 1) stack.push(i + GRID);
      }
      commit(next);
    }
    function undo() {
      setHistory((h2) => {
        if (h2.length === 0) return h2;
        setFuture((f) => [...f, pixels]);
        setPixels(h2[h2.length - 1]);
        return h2.slice(0, -1);
      });
    }
    function redo() {
      setFuture((f) => {
        if (f.length === 0) return f;
        setHistory((h2) => [...h2, pixels]);
        setPixels(f[f.length - 1]);
        return f.slice(0, -1);
      });
    }
    function clearGrid() {
      commit(emptyGrid());
    }
    function exportPng() {
      const canvas = document.createElement("canvas");
      canvas.width = GRID;
      canvas.height = GRID;
      const ctx = canvas.getContext("2d");
      pixels.forEach((c, i) => {
        if (!c) return;
        ctx.fillStyle = c;
        ctx.fillRect(i % GRID, Math.floor(i / GRID), 1, 1);
      });
      downloadDataUrl(`Pixel Art ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.png`, canvas.toDataURL("image/png"));
      sdk.pushNotification("Draw Studio", "Image downloaded.");
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", "data-active": !erasing, onClick: () => setErasing(false) }, "Draw"),
        h("button", { className: "pk-btn", "data-active": erasing, onClick: () => setErasing(true) }, "Erase"),
        h("button", { className: "pk-btn", onClick: undo, disabled: history.length === 0 }, "Undo"),
        h("button", { className: "pk-btn", onClick: redo, disabled: future.length === 0 }, "Redo"),
        h("button", { className: "pk-btn", onClick: clearGrid }, "Clear"),
        h("button", { className: "pk-btn", onClick: exportPng, style: { marginLeft: "auto" } }, "Download PNG")
      ),
      h(
        "div",
        { className: "pk-content ds-content" },
        h(
          "div",
          { className: "ds-body" },
          h(
            "div",
            { className: "ds-palette" },
            h("input", { type: "color", className: "ds-color-input", value: color, onChange: (e) => setColor(e.target.value) }),
            PALETTE.map((c) => h("button", { key: c, className: "ds-swatch", "data-active": color === c && !erasing, style: { background: c }, onClick: () => { setColor(c); setErasing(false); } }))
          ),
          h(
            "div",
            {
              className: "ds-pixel-grid",
              style: { gridTemplateColumns: `repeat(${GRID}, ${CELL_PX}px)`, width: GRID * CELL_PX, height: GRID * CELL_PX },
              onPointerDown: () => (painting.current = true),
              onPointerUp: () => (painting.current = false),
              onPointerLeave: () => (painting.current = false),
            },
            pixels.map((c, i) =>
              h("div", {
                key: i,
                className: "ds-pixel-cell",
                style: { background: c ?? "#fff", width: CELL_PX, height: CELL_PX },
                onPointerDown: (e) => (e.shiftKey ? fillBucket(i) : paint(i)),
                onPointerEnter: () => painting.current && paint(i),
              })
            )
          )
        )
      )
    );
  }

  function App() {
    const [tab, setTab] = useState("canvas");
    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar", style: { borderBottom: "1px solid var(--anchoran-border,#2a2c33)" } },
        h("button", { className: "pk-btn", "data-active": tab === "canvas", onClick: () => setTab("canvas") }, "Canvas"),
        h("button", { className: "pk-btn", "data-active": tab === "pixel", onClick: () => setTab("pixel") }, "Pixel Art (shift-click = fill)")
      ),
      tab === "canvas" ? h(CanvasPanel) : h(PixelArtPanel)
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
