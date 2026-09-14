/**
 * Color Picker — ported from Anchoran OS's bundled "colorpicker" app.
 * Same EyeDropper-API screen picker (a standard Chromium API, works
 * identically from a plugin window) and HEX/RGB/HSL copy rows. New
 * for this migration: saved swatches now persist across sessions
 * (plugin-namespaced localStorage instead of in-memory-only), and a
 * "Harmony" row shows the current color's complementary + two
 * analogous colors, one click away from becoming the active color.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.cp-content{display:flex;flex-direction:column;gap:14px;align-items:center;}
.cp-preview{position:relative;width:140px;height:140px;border-radius:50%;border:4px solid var(--anchoran-border,#2a2c33);overflow:hidden;}
.cp-input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;}
.cp-values{width:100%;max-width:280px;display:flex;flex-direction:column;gap:4px;}
.cp-copy-row{display:flex;align-items:center;gap:10px;width:100%;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:8px;padding:8px 10px;color:var(--anchoran-text-primary,#F3F4F6);cursor:pointer;font-size:12.5px;}
.cp-copy-label{width:36px;color:var(--anchoran-text-secondary,#9aa0ab);}
.cp-copy-value{flex:1;text-align:left;}
.cp-swatches,.cp-harmony{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;max-width:280px;}
.cp-swatch{width:28px;height:28px;border-radius:50%;border:2px solid var(--anchoran-border,#2a2c33);cursor:pointer;}
`;

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hh = 0;
  if (max === r) hh = ((g - b) / d + (g < b ? 6 : 0)) * 60;
  else if (max === g) hh = ((b - r) / d + 2) * 60;
  else hh = ((r - g) / d + 4) * 60;
  return [Math.round(hh), Math.round(s * 100), Math.round(l * 100)];
}
function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

export function mount(container, sdk) {
  injectStyle("colorpicker", CSS);
  const store = pluginStorage("colorpicker");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useMemo } = React;

  function CopyRow({ label, value }) {
    const [copied, setCopied] = useState(false);
    return h(
      "button",
      {
        className: "cp-copy-row",
        onClick: () => {
          navigator.clipboard?.writeText(value).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1000);
        },
      },
      h("span", { className: "cp-copy-label" }, label),
      h("span", { className: "cp-copy-value" }, value),
      Icon ? h(Icon, { name: copied ? "check" : "copy", size: 14 }) : null
    );
  }

  function App() {
    const [color, setColor] = useState(() => store.get("lastColor", "#6E9BF7"));
    const [swatches, setSwatches] = useState(() => store.get("swatches", ["#6E9BF7", "#1E3A8A", "#0F766E", "#7C3AED", "#B45309"]));
    const eyeDropperSupported = typeof window !== "undefined" && !!window.EyeDropper;

    function updateColor(next) {
      setColor(next);
      store.set("lastColor", next);
    }

    const [r, g, b] = useMemo(() => hexToRgb(color), [color]);
    const [hh, ss, ll] = useMemo(() => rgbToHsl(r, g, b), [r, g, b]);
    const harmony = useMemo(() => {
      const complementary = rgbToHex(...hslToRgb((hh + 180) % 360, ss, ll));
      const analogous1 = rgbToHex(...hslToRgb((hh + 30) % 360, ss, ll));
      const analogous2 = rgbToHex(...hslToRgb((hh + 330) % 360, ss, ll));
      return [complementary, analogous1, analogous2];
    }, [hh, ss, ll]);

    async function pickFromScreen() {
      if (!window.EyeDropper) return;
      try {
        const result = await new window.EyeDropper().open();
        updateColor(result.sRGBHex);
      } catch {
        /* user cancelled */
      }
    }

    function saveSwatch() {
      if (swatches.includes(color)) return;
      const next = [...swatches, color].slice(-10);
      setSwatches(next);
      store.set("swatches", next);
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-content cp-content" },
        h(
          "div",
          { className: "cp-preview", style: { background: color } },
          h("input", { type: "color", value: color, onChange: (e) => updateColor(e.target.value), className: "cp-input", "aria-label": "Pick a color" })
        ),
        eyeDropperSupported
          ? h("button", { className: "pk-btn", onClick: pickFromScreen }, Icon ? h(Icon, { name: "colorPicker", size: 14 }) : null, " Pick from screen")
          : h("div", { style: { fontSize: 11.5, color: "var(--anchoran-text-secondary,#9aa0ab)" } }, "Picking from anywhere on screen isn't available on this build — use the wheel above instead."),
        h(
          "div",
          { className: "cp-values" },
          h(CopyRow, { label: "HEX", value: color.toUpperCase() }),
          h(CopyRow, { label: "RGB", value: `rgb(${r}, ${g}, ${b})` }),
          h(CopyRow, { label: "HSL", value: `hsl(${hh}, ${ss}%, ${ll}%)` })
        ),
        h("div", { style: { fontSize: 11, color: "var(--anchoran-text-secondary,#9aa0ab)" } }, "Harmony (complementary + analogous)"),
        h(
          "div",
          { className: "cp-harmony" },
          harmony.map((sw) => h("button", { key: sw, className: "cp-swatch", style: { background: sw }, onClick: () => updateColor(sw), "aria-label": sw }))
        ),
        h(
          "div",
          { className: "cp-swatches" },
          swatches.map((sw) => h("button", { key: sw, className: "cp-swatch", style: { background: sw }, onClick: () => updateColor(sw), "aria-label": sw })),
          h("button", { className: "cp-swatch", onClick: saveSwatch, "aria-label": "Save current color", style: { display: "flex", alignItems: "center", justifyContent: "center", background: "var(--anchoran-surface,#1c1d22)" } }, Icon ? h(Icon, { name: "plus", size: 14 }) : "+")
        )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
