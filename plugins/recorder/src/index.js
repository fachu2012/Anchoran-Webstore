/**
 * Recorder — fuses two former Anchoran OS bundled apps with the same
 * purpose (record something with MediaRecorder and save the result):
 * "screenrecorder" (ScreenRecorder.tsx) and "voicerecorder"
 * (VoiceRecorder.tsx). Voice recording needed no adaptation at all
 * (navigator.mediaDevices.getUserMedia({audio:true}) is a standard Web
 * API). Screen recording is ADAPTED the same way Magnifier is: the
 * original used a privileged Electron-only capture path
 * (window.anchoran.getCaptureSources() + chromeMediaSourceId) with no
 * plugin equivalent, so this uses the standard
 * navigator.mediaDevices.getDisplayMedia() picker instead. "Save to
 * Files" (Anchoran's internal virtual filesystem) is replaced with a
 * real file download, since a plugin can't write into Anchoran's own
 * folders. New for this migration: a quality selector for both modes
 * (screen: capture frame rate; voice: audio bitrate) instead of one
 * fixed setting.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.rc-content{display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:20px;}
.rc-dot{width:14px;height:14px;border-radius:50%;background:var(--anchoran-border,#2a2c33);}
.rc-dot[data-recording="true"]{background:#E5484D;animation:rc-pulse 1.2s infinite;}
@keyframes rc-pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
.rc-time{font-size:26px;font-variant-numeric:tabular-nums;}
.rc-error{color:#E5484D;font-size:12.5px;}
.rc-result{display:flex;flex-direction:column;align-items:center;gap:8px;margin-top:10px;}
.rc-result video{max-width:280px;}
.rc-quality{margin-left:auto;}
`;

const CANDIDATE_VIDEO_MIME_TYPES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
function pickSupportedVideoMimeType() {
  return CANDIDATE_VIDEO_MIME_TYPES.find((type) => window.MediaRecorder?.isTypeSupported(type));
}

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
  injectStyle("recorder", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useRef, useEffect } = React;

  function useRecorderState() {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState(null);
    const [lastBlob, setLastBlob] = useState(null);
    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const timerRef = useRef(null);

    useEffect(
      () => () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        if (timerRef.current) window.clearInterval(timerRef.current);
      },
      []
    );

    function stopRecording() {
      recorderRef.current?.stop();
      setRecording(false);
      if (timerRef.current) window.clearInterval(timerRef.current);
    }

    return { recording, setRecording, seconds, setSeconds, error, setError, lastBlob, setLastBlob, recorderRef, streamRef, timerRef, stopRecording };
  }

  function ScreenPanel() {
    const s = useRecorderState();
    const [frameRate, setFrameRate] = useState(30);

    async function start() {
      s.setError(null);
      if (!navigator.mediaDevices?.getDisplayMedia) {
        s.setError("Screen capture isn't available in this environment.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate }, audio: false });
        s.streamRef.current = stream;
        const chunks = [];
        const mimeType = pickSupportedVideoMimeType();
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
        recorder.onerror = (e) => {
          s.setError(`Recording failed: ${e?.error?.message ?? "unknown error"}`);
          s.setRecording(false);
          if (s.timerRef.current) window.clearInterval(s.timerRef.current);
          stream.getTracks().forEach((t) => t.stop());
        };
        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          if (chunks.length === 0) { s.setError("The recording didn't capture any data — try again."); return; }
          const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
          if (blob.size === 0) { s.setError("The recording came out empty — try again."); return; }
          s.setLastBlob(blob);
        };
        recorder.start(1000);
        s.recorderRef.current = recorder;
        s.setRecording(true);
        s.setSeconds(0);
        s.timerRef.current = window.setInterval(() => s.setSeconds((n) => n + 1), 1000);
      } catch (err) {
        s.setError(err?.message ? `Couldn't start screen recording: ${err.message}` : "Couldn't start screen recording.");
      }
    }

    function save() {
      if (!s.lastBlob) return;
      downloadBlob(`Screen Recording ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.webm`, s.lastBlob);
      sdk.pushNotification("Recorder", "Screen recording downloaded.");
      s.setLastBlob(null);
    }

    const mm = String(Math.floor(s.seconds / 60)).padStart(2, "0");
    const ss = String(s.seconds % 60).padStart(2, "0");
    const videoUrl = s.lastBlob ? URL.createObjectURL(s.lastBlob) : null;

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        h(
          "select",
          { className: "pk-input rc-quality", value: frameRate, onChange: (e) => setFrameRate(Number(e.target.value)), disabled: s.recording },
          h("option", { value: 15 }, "15 fps (smaller file)"),
          h("option", { value: 30 }, "30 fps (standard)"),
          h("option", { value: 60 }, "60 fps (smooth)")
        )
      ),
      h(
        "div",
        { className: "pk-content rc-content" },
        s.error && h("div", { className: "rc-error" }, s.error),
        h("div", { className: "rc-dot", "data-recording": s.recording }),
        h("div", { className: "rc-time" }, `${mm}:${ss}`),
        !s.recording ? h("button", { className: "pk-btn", onClick: start }, Icon ? h(Icon, { name: "screenshot", size: 16 }) : null, " Start recording") : h("button", { className: "pk-btn", onClick: s.stopRecording }, "Stop"),
        s.lastBlob && h("div", { className: "rc-result" }, h("video", { src: videoUrl, controls: true }), h("button", { className: "pk-btn", onClick: save }, "Download recording"))
      )
    );
  }

  function VoicePanel() {
    const s = useRecorderState();
    const [bitrate, setBitrate] = useState(128000);

    async function start() {
      s.setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.streamRef.current = stream;
        const chunks = [];
        const recorder = new MediaRecorder(stream, { audioBitsPerSecond: bitrate });
        recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "audio/webm" });
          s.setLastBlob(blob);
          stream.getTracks().forEach((t) => t.stop());
        };
        recorder.start();
        s.recorderRef.current = recorder;
        s.setRecording(true);
        s.setSeconds(0);
        s.timerRef.current = window.setInterval(() => s.setSeconds((n) => n + 1), 1000);
      } catch {
        s.setError("Couldn't access the microphone.");
      }
    }

    function save() {
      if (!s.lastBlob) return;
      downloadBlob(`Voice Memo ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.webm`, s.lastBlob);
      sdk.pushNotification("Recorder", "Voice memo downloaded.");
      s.setLastBlob(null);
    }

    const mm = String(Math.floor(s.seconds / 60)).padStart(2, "0");
    const ss = String(s.seconds % 60).padStart(2, "0");
    const audioUrl = s.lastBlob ? URL.createObjectURL(s.lastBlob) : null;

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        h(
          "select",
          { className: "pk-input rc-quality", value: bitrate, onChange: (e) => setBitrate(Number(e.target.value)), disabled: s.recording },
          h("option", { value: 64000 }, "64 kbps (smaller file)"),
          h("option", { value: 128000 }, "128 kbps (standard)"),
          h("option", { value: 256000 }, "256 kbps (high quality)")
        )
      ),
      h(
        "div",
        { className: "pk-content rc-content" },
        s.error && h("div", { className: "rc-error" }, s.error),
        h("div", { className: "rc-dot", "data-recording": s.recording }),
        h("div", { className: "rc-time" }, `${mm}:${ss}`),
        !s.recording ? h("button", { className: "pk-btn", onClick: start }, Icon ? h(Icon, { name: "voiceRecorder", size: 16 }) : null, " Start recording") : h("button", { className: "pk-btn", onClick: s.stopRecording }, "Stop"),
        s.lastBlob && h("div", { className: "rc-result" }, h("audio", { src: audioUrl, controls: true }), h("button", { className: "pk-btn", onClick: save }, "Download recording"))
      )
    );
  }

  function App() {
    const [tab, setTab] = useState("screen");
    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar", style: { borderBottom: "1px solid var(--anchoran-border,#2a2c33)" } },
        h("button", { className: "pk-btn", "data-active": tab === "screen", onClick: () => setTab("screen") }, "Screen"),
        h("button", { className: "pk-btn", "data-active": tab === "voice", onClick: () => setTab("voice") }, "Voice")
      ),
      tab === "screen" ? h(ScreenPanel) : h(VoicePanel)
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
