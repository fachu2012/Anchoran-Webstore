/**
 * QR Code — ported from Anchoran OS's bundled "qrcode" app. Same
 * behavior: renders a QR code for typed text via the public
 * api.qrserver.com image endpoint (this was already an external
 * network call in the original, not an Anchoran-internal API, so it
 * needs no adaptation) and lets you copy the image URL.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.qr-content{display:flex;flex-direction:column;gap:12px;align-items:center;}
.qr-input{width:100%;resize:vertical;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-sm,6px);color:var(--anchoran-text-primary,#F3F4F6);padding:8px;font:inherit;}
.qr-preview{width:220px;height:220px;display:flex;align-items:center;justify-content:center;border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-md,10px);}
.qr-placeholder{font-size:12px;color:var(--anchoran-text-secondary,#9aa0ab);text-align:center;padding:12px;}
`;

export function mount(container, sdk) {
  injectStyle("qrcode", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useEffect, useMemo } = React;

  function App() {
    const [text, setText] = useState("");
    const [copied, setCopied] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);

    const qrUrl = useMemo(() => {
      const value = text.trim();
      if (!value) return null;
      return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(value)}`;
    }, [text]);

    useEffect(() => setLoadFailed(false), [qrUrl]);

    function copyImageUrl() {
      if (!qrUrl) return;
      navigator.clipboard?.writeText(qrUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-content qr-content" },
        h("textarea", {
          className: "qr-input",
          placeholder: "Enter text or a link…",
          value: text,
          onChange: (e) => setText(e.target.value),
          rows: 3,
        }),
        h(
          "div",
          { className: "qr-preview" },
          qrUrl && !loadFailed
            ? h("img", { src: qrUrl, alt: "Generated QR code", width: 220, height: 220, onError: () => setLoadFailed(true) })
            : qrUrl && loadFailed
            ? h("div", { className: "qr-placeholder" }, "Couldn't load the QR code. Check your connection.")
            : h("div", { className: "qr-placeholder" }, "Your QR code will appear here")
        ),
        qrUrl &&
          h(
            "button",
            { className: "pk-btn", onClick: copyImageUrl },
            Icon ? h(Icon, { name: "copy", size: 14 }) : null,
            " ",
            copied ? "Copied" : "Copy image link"
          )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
