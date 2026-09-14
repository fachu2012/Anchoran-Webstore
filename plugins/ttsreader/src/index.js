/**
 * TTS Reader — ported from Anchoran OS's bundled "ttsreader" app.
 * Same Web Speech API usage (speechSynthesis is a standard browser
 * API, works identically from a plugin window). New for this
 * migration: your last-used voice/rate persist across sessions.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.tts-voice-select{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;padding:5px 6px;max-width:180px;}
.tts-content{display:flex;flex-direction:column;gap:12px;height:100%;}
.tts-textarea{flex:1;resize:none;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:8px;color:var(--anchoran-text-primary,#F3F4F6);padding:10px;font:inherit;}
.tts-rate-row{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.tts-warning{color:#E5484D;font-size:12.5px;}
`;

export function mount(container, sdk) {
  injectStyle("ttsreader", CSS);
  const store = pluginStorage("ttsreader");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useEffect } = React;

  function App() {
    const [text, setText] = useState("");
    const [voices, setVoices] = useState([]);
    const [voiceIndex, setVoiceIndex] = useState(0);
    const [rate, setRate] = useState(() => store.get("rate", 1));
    const [speaking, setSpeaking] = useState(false);
    const [paused, setPaused] = useState(false);
    const supported = typeof window !== "undefined" && "speechSynthesis" in window;

    useEffect(() => {
      if (!supported) return;
      function loadVoices() {
        const list = window.speechSynthesis.getVoices();
        setVoices(list);
        const savedURI = store.get("voiceURI", null);
        if (savedURI) {
          const idx = list.findIndex((v) => v.voiceURI === savedURI);
          if (idx >= 0) setVoiceIndex(idx);
        }
      }
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
      return () => {
        window.speechSynthesis.onvoiceschanged = null;
        window.speechSynthesis.cancel();
      };
    }, [supported]);

    function speak() {
      if (!supported || !text.trim()) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      if (voices[voiceIndex]) utterance.voice = voices[voiceIndex];
      utterance.rate = rate;
      utterance.onend = () => { setSpeaking(false); setPaused(false); };
      utterance.onstart = () => setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }

    function togglePause() {
      if (!supported) return;
      if (paused) { window.speechSynthesis.resume(); setPaused(false); }
      else { window.speechSynthesis.pause(); setPaused(true); }
    }

    function stop() {
      if (!supported) return;
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setPaused(false);
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        !speaking
          ? h("button", { className: "pk-btn", onClick: speak, disabled: !supported || !text.trim() }, Icon ? h(Icon, { name: "volume", size: 14 }) : null, " Read aloud")
          : h(
              React.Fragment,
              null,
              h("button", { className: "pk-btn", onClick: togglePause }, paused ? "Resume" : "Pause"),
              h("button", { className: "pk-btn", onClick: stop }, "Stop")
            ),
        h(
          "select",
          {
            value: voiceIndex,
            onChange: (e) => {
              const idx = Number(e.target.value);
              setVoiceIndex(idx);
              if (voices[idx]) store.set("voiceURI", voices[idx].voiceURI);
            },
            className: "tts-voice-select",
          },
          voices.length === 0 && h("option", null, "Default voice"),
          voices.map((v, i) => h("option", { key: v.voiceURI, value: i }, v.name))
        )
      ),
      h(
        "div",
        { className: "pk-content tts-content" },
        !supported && h("div", { className: "tts-warning" }, "Text-to-speech isn't available in this environment."),
        h("textarea", { className: "tts-textarea", placeholder: "Paste or type text to have it read aloud…", value: text, onChange: (e) => setText(e.target.value) }),
        h(
          "div",
          { className: "tts-rate-row" },
          h("span", null, "Speed"),
          h("input", { type: "range", min: 0.5, max: 2, step: 0.1, value: rate, onChange: (e) => { const v = Number(e.target.value); setRate(v); store.set("rate", v); } }),
          h("span", null, `${rate.toFixed(1)}x`)
        )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
