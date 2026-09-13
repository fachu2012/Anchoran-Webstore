/**
 * "Hello, Anchoran" — the pilot plugin app, proving the whole pipeline
 * end to end: built independently of Anchoran OS's own source tree,
 * published as its own versioned release in this repo, downloaded and
 * mounted by a running Anchoran OS install with no code changes to
 * Anchoran itself required for this app to exist or update.
 *
 * Talks only to the Anchoran App SDK (`sdk`, handed to mount() below)
 * — never to Anchoran's own internal modules, since those carry no
 * compatibility promise across versions. See this repo's README for
 * the SDK contract every plugin is built against.
 */

/** @type {import("./types").AnchoranPluginModule} */
export function mount(container, sdk, ctx) {
  const { React, ReactDOM } = sdk;
  const { createElement: h, useState, useEffect } = React;

  function App() {
    const [now, setNow] = useState(new Date());
    useEffect(() => {
      const id = setInterval(() => setNow(new Date()), 1000);
      return () => clearInterval(id);
    }, []);

    const accent = sdk.getAccentColor();

    return h(
      "div",
      {
        style: {
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          fontFamily: "system-ui, sans-serif",
          color: sdk.getThemeMode() === "dark" ? "#F3F4F6" : "#14161B",
          textAlign: "center",
          padding: 20,
        },
      },
      h("div", { style: { fontSize: 15, fontWeight: 600 } }, "Hello, Anchoran"),
      h(
        "div",
        { style: { fontSize: 12, opacity: 0.65, maxWidth: 280 } },
        "A community plugin, downloaded from a repo Anchoran OS itself never had to know about ahead of time."
      ),
      h(
        "div",
        {
          style: {
            fontFamily: "'Cascadia Code', Consolas, monospace",
            fontSize: 28,
            fontVariantNumeric: "tabular-nums",
            color: accent,
          },
        },
        now.toLocaleTimeString()
      ),
      h(
        "button",
        {
          onClick: () => sdk.pushNotification("Hello, Anchoran", `Said hi from window ${ctx.windowId}.`),
          style: {
            border: "none",
            borderRadius: 8,
            padding: "8px 16px",
            background: accent,
            color: "#fff",
            fontSize: 12.5,
            cursor: "pointer",
          },
        },
        "Say hi back"
      ),
      h("div", { style: { fontSize: 10.5, opacity: 0.45 } }, "SDK v" + sdk.version)
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
