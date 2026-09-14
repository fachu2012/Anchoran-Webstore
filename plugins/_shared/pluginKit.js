/**
 * Small shared helpers imported by several plugins in this repo.
 * Bundled inline into each plugin's own dist/index.js by esbuild
 * (bundle: true) — this file never ships on its own, so plugins keep
 * their "one downloadable file" contract with Anchoran OS while the
 * plugin authors here (us) don't repeat the same boilerplate in every
 * plugins/<id>/src/index.js.
 */

/** Injects a <style> tag exactly once per `id`, no matter how many times mount() runs (e.g. re-opening the same plugin's window). */
export function injectStyle(id, css) {
  const tagId = `anchoran-plugin-style-${id}`;
  if (document.getElementById(tagId)) return;
  const style = document.createElement("style");
  style.id = tagId;
  style.textContent = css;
  document.head.appendChild(style);
}

/** The generic app-shell classes (toolbar/content/root) every bundled Anchoran app used to get for free from apps.css, reproduced here under plugin-namespaced class names so a plugin's own styling never collides with Anchoran's own remaining core apps or with another plugin's window. */
export const SHELL_CSS = `
.pk-root{height:100%;display:flex;flex-direction:column;color:var(--anchoran-text-primary,#F3F4F6);font-family:system-ui,sans-serif;}
.pk-toolbar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#1c1d22);flex-shrink:0;flex-wrap:wrap;}
.pk-btn{display:flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-sm,6px);background:var(--anchoran-surface,#1c1d22);color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;cursor:pointer;}
.pk-btn:hover{background:var(--anchoran-border,#2a2c33);}
.pk-btn:disabled{opacity:.45;cursor:default;pointer-events:none;}
.pk-btn[data-active="true"],.pk-btn[data-op="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));border-color:var(--anchoran-accent,#5B8DEF);color:var(--anchoran-accent,#5B8DEF);}
.pk-content{flex:1;min-height:0;overflow:auto;padding:16px;}
.pk-input{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:var(--anchoran-radius-sm,6px);color:var(--anchoran-text-primary,#F3F4F6);font-size:12.5px;padding:6px 8px;}
.pk-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:40px 20px;color:var(--anchoran-text-secondary,#9aa0ab);text-align:center;}
`;

/** A localStorage-backed getter/setter namespaced per plugin, so two plugins (or a plugin and the host) never collide on key names. Falls back silently to in-memory-only behavior if localStorage throws (private/blocked contexts). */
export function pluginStorage(pluginId) {
  const prefix = `anchoran-plugin:${pluginId}:`;
  let memory = {};
  return {
    get(key, fallback) {
      try {
        const raw = window.localStorage.getItem(prefix + key);
        return raw == null ? fallback : JSON.parse(raw);
      } catch {
        return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : fallback;
      }
    },
    set(key, value) {
      memory[key] = value;
      try {
        window.localStorage.setItem(prefix + key, JSON.stringify(value));
      } catch {
        /* ignore — in-memory fallback above still holds this session's value */
      }
    },
  };
}
