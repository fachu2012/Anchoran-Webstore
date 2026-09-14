/**
 * Chat — ported from Anchoran OS's bundled "chat" app, which was
 * already just an embedded external site (the user's own Firebase-
 * backed chat app), not an Anchoran-internal feature. The original
 * used a privileged <webview> tag inside the main Anchoran window with
 * a fallback to a plain <iframe> outside Electron; a plugin window has
 * no webviewTag privilege, so this always uses the iframe path — the
 * same code path the original already exercised in its own dev/browser
 * fallback, not a new or untested one.
 */
const CHAT_URL = "https://fprichat.vercel.app/";

export function mount(container) {
  container.innerHTML = "";
  container.style.height = "100%";
  const iframe = document.createElement("iframe");
  iframe.title = "Anchoran Chat";
  iframe.src = CHAT_URL;
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.style.display = "block";
  container.appendChild(iframe);
  return () => {
    container.innerHTML = "";
  };
}
