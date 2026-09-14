/**
 * Tasks & Reminders — fuses two former Anchoran OS bundled apps with
 * almost the same purpose (a personal task list): "todo" (Todo.tsx,
 * a plain checklist) and "reminders" (Reminders.tsx, a checklist with
 * a fire time + repeat rule). Same once-a-minute-check firing logic
 * (real setInterval, not a placeholder), same "once" reminders
 * disabling themselves after firing — ported verbatim, just backed by
 * this plugin's own storage and sdk.pushNotification instead of
 * Anchoran's internal notification store. New for this migration: a
 * task on the Tasks tab can optionally get a due date (shown inline,
 * overdue ones highlighted) — a small, natural extension of "a
 * checklist" that doesn't duplicate what the Reminders tab already
 * does (time-of-day alarms).
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.tr-list{display:flex;flex-direction:column;gap:2px;}
.tr-row{display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--anchoran-border,#2a2c33);}
.tr-check{width:18px;height:18px;border-radius:5px;border:1px solid var(--anchoran-border,#2a2c33);background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;color:var(--anchoran-accent,#5B8DEF);}
.tr-check[data-done="true"]{background:var(--anchoran-accent,#5B8DEF);border-color:var(--anchoran-accent,#5B8DEF);color:#fff;}
.tr-text{flex:1;font-size:12.5px;}
.tr-text[data-done="true"]{text-decoration:line-through;opacity:.55;}
.tr-due{font-size:11px;color:var(--anchoran-text-secondary,#9aa0ab);}
.tr-due[data-overdue="true"]{color:#E5484D;}
.tr-remove{background:transparent;border:none;color:var(--anchoran-text-secondary,#9aa0ab);cursor:pointer;}
.tr-footer{font-size:11.5px;color:var(--anchoran-text-secondary,#9aa0ab);padding:8px 4px;}
.tr-time-input,.tr-date-input{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;color:var(--anchoran-text-primary,#F3F4F6);padding:6px 8px;font-size:12px;}
.tr-time{font-size:12px;font-variant-numeric:tabular-nums;color:var(--anchoran-text-secondary,#9aa0ab);width:44px;}
.tr-repeat{font-size:11px;color:var(--anchoran-text-secondary,#9aa0ab);width:70px;}
`;

const REPEAT_LABELS = { once: "Once", daily: "Every day", weekdays: "Weekdays" };

function isDueToday(repeat, now) {
  if (repeat === "weekdays") return now.getDay() >= 1 && now.getDay() <= 5;
  return true;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function mount(container, sdk) {
  injectStyle("tasks-reminders", CSS);
  const store = pluginStorage("tasks-reminders");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useEffect, useRef } = React;

  function TasksPanel() {
    const [items, setItems] = useState(() => store.get("todoItems", []));
    const [draft, setDraft] = useState("");
    const [dueDraft, setDueDraft] = useState("");
    const [hideDone, setHideDone] = useState(false);

    function save(next) {
      setItems(next);
      store.set("todoItems", next);
    }
    function addItem() {
      const text = draft.trim();
      if (!text) return;
      save([{ id: `${Date.now()}`, text, done: false, createdAt: Date.now(), due: dueDraft || null }, ...items]);
      setDraft("");
      setDueDraft("");
    }
    function toggle(id) {
      save(items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
    }
    function remove(id) {
      save(items.filter((i) => i.id !== id));
    }

    const visible = hideDone ? items.filter((i) => !i.done) : items;
    const remaining = items.filter((i) => !i.done).length;
    const today = todayKey();

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        h("input", { className: "pk-input", placeholder: "Add a task…", value: draft, onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => e.key === "Enter" && addItem(), style: { flex: 1 } }),
        h("input", { type: "date", className: "tr-date-input", value: dueDraft, onChange: (e) => setDueDraft(e.target.value) }),
        h("button", { className: "pk-btn", onClick: addItem }, Icon ? h(Icon, { name: "plus", size: 14 }) : null, " Add"),
        h("button", { className: "pk-btn", "data-active": hideDone, onClick: () => setHideDone((v) => !v) }, "Hide done")
      ),
      h(
        "div",
        { className: "pk-content" },
        h(
          "div",
          { className: "tr-list" },
          visible.map((item) =>
            h(
              "div",
              { key: item.id, className: "tr-row" },
              h("button", { className: "tr-check", "data-done": item.done, onClick: () => toggle(item.id) }, item.done && (Icon ? h(Icon, { name: "check", size: 12 }) : "✓")),
              h("span", { className: "tr-text", "data-done": item.done }, item.text),
              item.due && h("span", { className: "tr-due", "data-overdue": !item.done && item.due < today }, item.due),
              h("button", { className: "tr-remove", onClick: () => remove(item.id), "aria-label": "Delete" }, Icon ? h(Icon, { name: "close", size: 13 }) : "×")
            )
          ),
          visible.length === 0 && h("div", { style: { color: "var(--anchoran-text-secondary,#9aa0ab)", fontSize: 12.5, padding: 20, textAlign: "center" } }, items.length === 0 ? "No tasks yet. Add one above to get started." : "Nothing left to do.")
        ),
        items.length > 0 && h("div", { className: "tr-footer" }, `${remaining} of ${items.length} remaining`)
      )
    );
  }

  function RemindersPanel() {
    const [reminders, setReminders] = useState(() => store.get("reminders", []).map((r) => ({ ...r, repeat: r.repeat ?? "daily" })));
    const [titleDraft, setTitleDraft] = useState("");
    const [timeDraft, setTimeDraft] = useState("09:00");
    const [repeatDraft, setRepeatDraft] = useState("daily");
    const remindersRef = useRef(reminders);
    remindersRef.current = reminders;

    function save(next) {
      setReminders(next);
      store.set("reminders", next);
    }

    useEffect(() => {
      const interval = setInterval(() => {
        const now = new Date();
        const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        const today = todayKey();
        let changed = false;
        const next = remindersRef.current.map((r) => {
          if (r.enabled && r.time === hhmm && r.firedToday !== today && isDueToday(r.repeat, now)) {
            sdk.pushNotification("Reminder", r.title);
            changed = true;
            return { ...r, firedToday: today, enabled: r.repeat === "once" ? false : r.enabled };
          }
          return r;
        });
        if (changed) save(next);
      }, 15000);
      return () => clearInterval(interval);
      // eslint-disable-next-line
    }, []);

    function addReminder() {
      const title = titleDraft.trim();
      if (!title) return;
      save([...reminders, { id: `${Date.now()}`, title, time: timeDraft, enabled: true, firedToday: null, repeat: repeatDraft }]);
      setTitleDraft("");
    }
    function toggle(id) {
      save(reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
    }
    function remove(id) {
      save(reminders.filter((r) => r.id !== id));
    }

    const sorted = [...reminders].sort((a, b) => a.time.localeCompare(b.time));

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        h("input", { className: "pk-input", placeholder: "Reminder title…", value: titleDraft, onChange: (e) => setTitleDraft(e.target.value), onKeyDown: (e) => e.key === "Enter" && addReminder(), style: { flex: 1 } }),
        h("input", { type: "time", value: timeDraft, onChange: (e) => setTimeDraft(e.target.value), className: "tr-time-input" }),
        h("select", { value: repeatDraft, onChange: (e) => setRepeatDraft(e.target.value), className: "tr-time-input" }, Object.keys(REPEAT_LABELS).map((r) => h("option", { key: r, value: r }, REPEAT_LABELS[r]))),
        h("button", { className: "pk-btn", onClick: addReminder }, Icon ? h(Icon, { name: "plus", size: 14 }) : null, " Add")
      ),
      h(
        "div",
        { className: "pk-content" },
        sorted.length === 0 && h("div", { style: { color: "var(--anchoran-text-secondary,#9aa0ab)", fontSize: 12.5 } }, "No reminders set."),
        sorted.map((r) =>
          h(
            "div",
            { key: r.id, className: "tr-row" },
            h("button", { className: "tr-check", "data-done": r.enabled, onClick: () => toggle(r.id) }, r.enabled && (Icon ? h(Icon, { name: "check", size: 12 }) : "✓")),
            h("span", { className: "tr-time" }, r.time),
            h("span", { className: "tr-text", "data-done": !r.enabled }, r.title),
            h("span", { className: "tr-repeat" }, REPEAT_LABELS[r.repeat]),
            h("button", { className: "tr-remove", onClick: () => remove(r.id), "aria-label": "Delete" }, Icon ? h(Icon, { name: "close", size: 13 }) : "×")
          )
        )
      )
    );
  }

  function App() {
    const [tab, setTab] = useState("tasks");
    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar", style: { borderBottom: "1px solid var(--anchoran-border,#2a2c33)" } },
        h("button", { className: "pk-btn", "data-active": tab === "tasks", onClick: () => setTab("tasks") }, "Tasks"),
        h("button", { className: "pk-btn", "data-active": tab === "reminders", onClick: () => setTab("reminders") }, "Reminders")
      ),
      tab === "tasks" ? h(TasksPanel) : h(RemindersPanel)
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
