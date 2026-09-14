/**
 * Password Tools — fuses two former Anchoran OS bundled apps with the
 * same purpose (managing passwords): "passwordgenerator"
 * (PasswordGenerator.tsx) and "passwordvault" (PasswordVault.tsx +
 * crypto.ts). The vault's real client-side encryption is ported
 * verbatim — PBKDF2 (150,000 iterations, SHA-256) deriving an AES-GCM
 * key from the master password via the standard Web Crypto API
 * (crypto.subtle, built into any Chromium renderer — no Anchoran-
 * internal API involved), with a random salt and a random IV per
 * encryption, persisted via this plugin's own namespaced storage
 * instead of Anchoran's internal persist store. The master password is
 * still never stored, and there is still no recovery if forgotten —
 * exactly the original's real security properties, not weakened for
 * the port. New for this migration: a "Check strength" tab that scores
 * any password you paste in (not just a freshly generated one) using
 * the same entropy-estimate heuristic as the generator's own strength
 * meter, extended to detect common weak patterns (all-lowercase,
 * repeated characters, sequential digits).
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.pw-content{display:flex;flex-direction:column;gap:14px;align-items:center;max-width:340px;margin:0 auto;}
.pw-output{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:8px;padding:10px 12px;font-family:"Cascadia Code",Consolas,monospace;font-size:14px;word-break:break-all;}
.pw-output-actions{display:flex;gap:4px;flex-shrink:0;}
.pw-copied{color:var(--anchoran-accent,#5B8DEF);font-size:11.5px;}
.pw-strength{width:100%;display:flex;align-items:center;gap:6px;}
.pw-strength-bar{flex:1;height:4px;border-radius:2px;background:var(--anchoran-border,#2a2c33);}
.pw-strength[data-level="1"] .pw-strength-bar:nth-child(-n+1){background:#E5484D;}
.pw-strength[data-level="2"] .pw-strength-bar:nth-child(-n+2){background:#F5C518;}
.pw-strength[data-level="3"] .pw-strength-bar:nth-child(-n+3){background:#30A46C;}
.pw-strength[data-level="4"] .pw-strength-bar:nth-child(-n+4){background:var(--anchoran-accent,#5B8DEF);}
.pw-row{width:100%;display:flex;align-items:center;gap:8px;font-size:12.5px;}
.pw-check{display:flex;align-items:center;gap:6px;font-size:12.5px;width:100%;}
.pw-gate{display:flex;flex-direction:column;align-items:center;gap:10px;padding:20px;text-align:center;}
.pw-input{width:100%;}
.pw-error{color:#E5484D;font-size:12px;}
.pw-vault-list{width:100%;display:flex;flex-direction:column;gap:8px;}
.pw-entry{border:1px solid var(--anchoran-border,#2a2c33);border-radius:8px;padding:10px;}
.pw-entry-title{font-size:13px;font-weight:500;margin-bottom:4px;}
.pw-entry-row{display:flex;align-items:center;gap:8px;font-size:12px;justify-content:space-between;margin-top:4px;}
.pw-entry-secret{font-family:"Cascadia Code",Consolas,monospace;}
.pw-form{display:flex;flex-direction:column;gap:6px;width:100%;}
`;

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{}";

function generate(length, opts) {
  let pool = "";
  if (opts.lower) pool += LOWER;
  if (opts.upper) pool += UPPER;
  if (opts.digits) pool += DIGITS;
  if (opts.symbols) pool += SYMBOLS;
  if (!pool) return "";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += pool[bytes[i] % pool.length];
  return out;
}

function strengthLabel(length, poolCount) {
  const bits = Math.log2(Math.max(poolCount, 1)) * length;
  if (bits < 40) return { label: "Weak", level: 1 };
  if (bits < 70) return { label: "Fair", level: 2 };
  if (bits < 100) return { label: "Strong", level: 3 };
  return { label: "Very strong", level: 4 };
}

function analyzePassword(pw) {
  if (!pw) return { label: "—", level: 0, notes: [] };
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSymbol = /[^a-zA-Z0-9]/.test(pw);
  const poolCount = (hasLower ? 26 : 0) + (hasUpper ? 26 : 0) + (hasDigit ? 10 : 0) + (hasSymbol ? SYMBOLS.length : 0);
  const base = strengthLabel(pw.length, poolCount || 1);
  const notes = [];
  if (/(.)\1{2,}/.test(pw)) notes.push("Has repeated characters");
  if (/012|123|234|345|456|567|678|789/.test(pw)) notes.push("Has a sequential run of digits");
  if (pw.length < 8) notes.push("Shorter than 8 characters");
  if (!hasUpper && !hasDigit && !hasSymbol) notes.push("Only lowercase letters");
  return { ...base, notes };
}

// ---- crypto.ts, ported verbatim (standard Web Crypto API, no Anchoran-internal dependency) ----
function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function deriveKey(password, salt) {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 150000, hash: "SHA-256" }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}
function randomSaltBase64() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return bufToBase64(salt.buffer);
}
async function encryptJson(password, saltBase64, data) {
  const salt = new Uint8Array(base64ToBuf(saltBase64));
  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `${bufToBase64(iv.buffer)}.${bufToBase64(ciphertext)}`;
}
async function decryptJson(password, saltBase64, blob) {
  try {
    const [ivB64, ctB64] = blob.split(".");
    const salt = new Uint8Array(base64ToBuf(saltBase64));
    const key = await deriveKey(password, salt);
    const iv = new Uint8Array(base64ToBuf(ivB64));
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, base64ToBuf(ctB64));
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch {
    return null;
  }
}
function generateVaultPassword(length = 16) {
  const chars = LOWER + UPPER + DIGITS + SYMBOLS;
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[bytes[i] % chars.length];
  return out;
}

export function mount(container, sdk) {
  injectStyle("password-tools", CSS);
  const store = pluginStorage("password-tools");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useEffect } = React;

  function GeneratorPanel() {
    const [length, setLength] = useState(16);
    const [lower, setLower] = useState(true);
    const [upper, setUpper] = useState(true);
    const [digits, setDigits] = useState(true);
    const [symbols, setSymbols] = useState(true);
    const [password, setPassword] = useState("");
    const [copied, setCopied] = useState(false);

    function regenerate() {
      setPassword(generate(length, { lower, upper, digits, symbols }));
    }
    useEffect(regenerate, [length, lower, upper, digits, symbols]);

    function copy() {
      if (!password) return;
      navigator.clipboard?.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }

    const poolCount = (lower ? 26 : 0) + (upper ? 26 : 0) + (digits ? 10 : 0) + (symbols ? SYMBOLS.length : 0);
    const strength = strengthLabel(length, poolCount);

    return h(
      "div",
      { className: "pk-content pw-content" },
      h(
        "div",
        { className: "pw-output" },
        h("span", null, password || "—"),
        h(
          "div",
          { className: "pw-output-actions" },
          h("button", { className: "pk-btn", onClick: regenerate, "aria-label": "Regenerate" }, Icon ? h(Icon, { name: "restart", size: 14 }) : "↻"),
          h("button", { className: "pk-btn", onClick: copy, "aria-label": "Copy" }, Icon ? h(Icon, { name: "copy", size: 14 }) : "⧉")
        )
      ),
      copied && h("div", { className: "pw-copied" }, "Copied to clipboard"),
      h(
        "div",
        { className: "pw-strength", "data-level": strength.level },
        h("div", { className: "pw-strength-bar" }), h("div", { className: "pw-strength-bar" }), h("div", { className: "pw-strength-bar" }), h("div", { className: "pw-strength-bar" }),
        h("span", null, strength.label)
      ),
      h("div", { className: "pw-row" }, h("label", null, "Length"), h("input", { type: "range", min: 6, max: 40, value: length, onChange: (e) => setLength(Number(e.target.value)), style: { flex: 1 } }), h("span", null, length)),
      h("label", { className: "pw-check" }, h("input", { type: "checkbox", checked: lower, onChange: (e) => setLower(e.target.checked) }), " Lowercase (a-z)"),
      h("label", { className: "pw-check" }, h("input", { type: "checkbox", checked: upper, onChange: (e) => setUpper(e.target.checked) }), " Uppercase (A-Z)"),
      h("label", { className: "pw-check" }, h("input", { type: "checkbox", checked: digits, onChange: (e) => setDigits(e.target.checked) }), " Digits (0-9)"),
      h("label", { className: "pw-check" }, h("input", { type: "checkbox", checked: symbols, onChange: (e) => setSymbols(e.target.checked) }), " Symbols (!@#…)")
    );
  }

  function StrengthPanel() {
    const [pw, setPw] = useState("");
    const result = analyzePassword(pw);
    return h(
      "div",
      { className: "pk-content pw-content" },
      h("input", { className: "pk-input", style: { width: "100%" }, placeholder: "Paste a password to check…", value: pw, onChange: (e) => setPw(e.target.value) }),
      h(
        "div",
        { className: "pw-strength", "data-level": result.level },
        h("div", { className: "pw-strength-bar" }), h("div", { className: "pw-strength-bar" }), h("div", { className: "pw-strength-bar" }), h("div", { className: "pw-strength-bar" }),
        h("span", null, result.label)
      ),
      result.notes.length > 0 && h("div", { style: { fontSize: 11.5, color: "var(--anchoran-text-secondary,#9aa0ab)" } }, result.notes.join(" · "))
    );
  }

  function VaultPanel() {
    const [stage, setStage] = useState("loading");
    const [salt, setSalt] = useState(null);
    const [passwordInput, setPasswordInput] = useState("");
    const [confirmInput, setConfirmInput] = useState("");
    const [masterPassword, setMasterPassword] = useState(null);
    const [entries, setEntries] = useState([]);
    const [error, setError] = useState(null);
    const [revealedId, setRevealedId] = useState(null);
    const [form, setForm] = useState(null);

    useEffect(() => {
      const s = store.get("vaultSalt", null);
      setSalt(s);
      setStage(s ? "locked" : "setup");
    }, []);

    async function createVault() {
      if (passwordInput.length < 6) { setError("Use at least 6 characters for your master password."); return; }
      if (passwordInput !== confirmInput) { setError("Passwords don't match."); return; }
      const newSalt = randomSaltBase64();
      const blob = await encryptJson(passwordInput, newSalt, []);
      store.set("vaultSalt", newSalt);
      store.set("vaultBlob", blob);
      setSalt(newSalt);
      setMasterPassword(passwordInput);
      setEntries([]);
      setPasswordInput("");
      setConfirmInput("");
      setError(null);
      setStage("unlocked");
    }

    async function unlock() {
      if (!salt) return;
      const blob = store.get("vaultBlob", null);
      const decrypted = blob ? await decryptJson(passwordInput, salt, blob) : [];
      if (decrypted === null) { setError("Incorrect master password."); return; }
      setMasterPassword(passwordInput);
      setEntries(decrypted);
      setPasswordInput("");
      setError(null);
      setStage("unlocked");
    }

    async function persistEntries(next) {
      if (!masterPassword || !salt) return;
      setEntries(next);
      const blob = await encryptJson(masterPassword, salt, next);
      store.set("vaultBlob", blob);
    }

    function addEntry() {
      setForm({ title: "", username: "", password: "", url: "", notes: "" });
    }
    function saveForm() {
      if (!form || !form.title.trim()) return;
      persistEntries([...entries, { id: `${Date.now()}`, ...form }]);
      setForm(null);
    }
    function removeEntry(id) {
      persistEntries(entries.filter((e) => e.id !== id));
    }
    function lock() {
      setMasterPassword(null);
      setEntries([]);
      setStage("locked");
    }

    if (stage === "loading") return h("div", { className: "pk-content" });

    if (stage === "setup" || stage === "locked") {
      return h(
        "div",
        { className: "pk-content pw-gate" },
        Icon ? h(Icon, { name: "lock", size: 36 }) : null,
        h("h3", { style: { margin: "8px 0 2px", fontWeight: 500 } }, stage === "setup" ? "Create your vault" : "Vault locked"),
        h(
          "p",
          { style: { color: "var(--anchoran-text-secondary,#9aa0ab)", fontSize: 12.5, textAlign: "center", maxWidth: 260 } },
          stage === "setup" ? "Choose a master password. It never leaves this device and there is no way to recover it if forgotten." : "Enter your master password to unlock."
        ),
        h("input", { type: "password", placeholder: "Master password", value: passwordInput, onChange: (e) => setPasswordInput(e.target.value), onKeyDown: (e) => e.key === "Enter" && (stage === "setup" ? createVault() : unlock()), className: "pk-input", style: { width: "100%" }, autoFocus: true }),
        stage === "setup" && h("input", { type: "password", placeholder: "Confirm password", value: confirmInput, onChange: (e) => setConfirmInput(e.target.value), onKeyDown: (e) => e.key === "Enter" && createVault(), className: "pk-input", style: { width: "100%" } }),
        error && h("div", { className: "pw-error" }, error),
        h("button", { className: "pk-btn", onClick: stage === "setup" ? createVault : unlock }, stage === "setup" ? "Create vault" : "Unlock")
      );
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: addEntry }, Icon ? h(Icon, { name: "plus", size: 14 }) : null, " Add"),
        h("button", { className: "pk-btn", onClick: lock, style: { marginLeft: "auto" } }, Icon ? h(Icon, { name: "lock", size: 13 }) : null, " Lock")
      ),
      h(
        "div",
        { className: "pk-content pw-content" },
        form &&
          h(
            "div",
            { className: "pw-form" },
            h("input", { className: "pk-input", placeholder: "Title", value: form.title, onChange: (e) => setForm({ ...form, title: e.target.value }), autoFocus: true }),
            h("input", { className: "pk-input", placeholder: "Username", value: form.username, onChange: (e) => setForm({ ...form, username: e.target.value }) }),
            h(
              "div",
              { style: { display: "flex", gap: 6 } },
              h("input", { className: "pk-input", placeholder: "Password", value: form.password, onChange: (e) => setForm({ ...form, password: e.target.value }), style: { flex: 1 } }),
              h("button", { className: "pk-btn", type: "button", title: "Generate a strong password", onClick: () => setForm({ ...form, password: generateVaultPassword() }) }, Icon ? h(Icon, { name: "restart", size: 13 }) : null, " Generate")
            ),
            h("input", { className: "pk-input", placeholder: "URL", value: form.url, onChange: (e) => setForm({ ...form, url: e.target.value }) }),
            h("div", { style: { display: "flex", gap: 6 } }, h("button", { className: "pk-btn", onClick: saveForm }, "Save"), h("button", { className: "pk-btn", onClick: () => setForm(null) }, "Cancel"))
          ),
        h(
          "div",
          { className: "pw-vault-list" },
          entries.length === 0 && !form && h("div", { style: { color: "var(--anchoran-text-secondary,#9aa0ab)", fontSize: 12.5 } }, "No entries yet."),
          entries.map((e) =>
            h(
              "div",
              { key: e.id, className: "pw-entry" },
              h("div", { className: "pw-entry-title" }, e.title),
              h("div", { className: "pw-entry-row" }, h("span", null, e.username), h("button", { className: "kb-remove", onClick: () => removeEntry(e.id), "aria-label": "Delete", style: { background: "transparent", border: "none", color: "var(--anchoran-text-secondary,#9aa0ab)", cursor: "pointer" } }, "×")),
              h(
                "div",
                { className: "pw-entry-row" },
                h("span", { className: "pw-entry-secret" }, revealedId === e.id ? e.password : "••••••••"),
                h("button", { className: "pk-btn", onClick: () => setRevealedId((id) => (id === e.id ? null : e.id)) }, revealedId === e.id ? "Hide" : "Show"),
                h("button", { className: "pk-btn", onClick: () => navigator.clipboard?.writeText(e.password) }, Icon ? h(Icon, { name: "copy", size: 12 }) : "⧉")
              ),
              e.url && h("div", { style: { fontSize: 11.5, color: "var(--anchoran-text-secondary,#9aa0ab)", marginTop: 4 } }, e.url)
            )
          )
        )
      )
    );
  }

  function App() {
    const [tab, setTab] = useState("generator");
    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar", style: { borderBottom: "1px solid var(--anchoran-border,#2a2c33)" } },
        h("button", { className: "pk-btn", "data-active": tab === "generator", onClick: () => setTab("generator") }, "Generator"),
        h("button", { className: "pk-btn", "data-active": tab === "strength", onClick: () => setTab("strength") }, "Check Strength"),
        h("button", { className: "pk-btn", "data-active": tab === "vault", onClick: () => setTab("vault") }, "Vault")
      ),
      tab === "generator" ? h(GeneratorPanel) : tab === "strength" ? h(StrengthPanel) : h(VaultPanel)
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
