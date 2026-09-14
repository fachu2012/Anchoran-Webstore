/**
 * Habit Tracker — ported from Anchoran OS's bundled "habittracker" app
 * (same local-date-safe streak math and 14-day grid). New for this
 * migration: a per-habit best-streak record and an overall "done
 * today" summary in the toolbar.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.ht-summary{margin-left:auto;font-size:12.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.ht-row{margin-bottom:14px;}
.ht-header{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
.ht-name{font-size:13.5px;flex:1;}
.ht-streak{font-size:11.5px;color:var(--anchoran-accent,#5B8DEF);}
.ht-best{font-size:11px;color:var(--anchoran-text-secondary,#9aa0ab);}
.ht-remove{background:transparent;border:none;color:var(--anchoran-text-secondary,#9aa0ab);cursor:pointer;}
.ht-days{display:flex;gap:4px;flex-wrap:wrap;}
.ht-day{width:20px;height:20px;border-radius:4px;border:1px solid var(--anchoran-border,#2a2c33);background:var(--anchoran-surface,#1c1d22);cursor:pointer;}
.ht-day[data-done="true"]{background:var(--anchoran-accent,#5B8DEF);border-color:var(--anchoran-accent,#5B8DEF);}
`;

const STORAGE_KEY = "habits";
const DAYS_SHOWN = 14;

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastNDays(n) {
  const days = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(dateKey(d));
  }
  return days;
}

function currentStreak(doneDates) {
  const set = new Set(doneDates);
  let streak = 0;
  const cursor = new Date();
  while (set.has(dateKey(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function bestStreak(doneDates) {
  const sorted = [...new Set(doneDates)].sort();
  let best = 0, run = 0, prev = null;
  for (const day of sorted) {
    if (prev) {
      const p = new Date(prev);
      p.setDate(p.getDate() + 1);
      if (dateKey(p) === day) run++;
      else run = 1;
    } else run = 1;
    best = Math.max(best, run);
    prev = day;
  }
  return best;
}

export function mount(container, sdk) {
  injectStyle("habittracker", CSS);
  const store = pluginStorage("habittracker");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState } = React;
  const days = lastNDays(DAYS_SHOWN);
  const today = dateKey(new Date());

  function App() {
    const [habits, setHabits] = useState(() => store.get(STORAGE_KEY, []));
    const [draft, setDraft] = useState("");

    function save(next) {
      setHabits(next);
      store.set(STORAGE_KEY, next);
    }

    function addHabit() {
      const name = draft.trim();
      if (!name) return;
      save([...habits, { id: `${Date.now()}`, name, doneDates: [] }]);
      setDraft("");
    }

    function toggleDay(habitId, day) {
      save(habits.map((h2) => (h2.id === habitId ? { ...h2, doneDates: h2.doneDates.includes(day) ? h2.doneDates.filter((d) => d !== day) : [...h2.doneDates, day] } : h2)));
    }

    function removeHabit(id) {
      save(habits.filter((h2) => h2.id !== id));
    }

    const doneToday = habits.filter((h2) => h2.doneDates.includes(today)).length;

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("input", { className: "pk-input", placeholder: "New habit…", value: draft, onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => e.key === "Enter" && addHabit() }),
        h("button", { className: "pk-btn", onClick: addHabit }, Icon ? h(Icon, { name: "plus", size: 14 }) : null, " Add"),
        habits.length > 0 && h("div", { className: "ht-summary" }, `${doneToday}/${habits.length} done today`)
      ),
      h(
        "div",
        { className: "pk-content" },
        habits.length === 0 && h("div", { style: { color: "var(--anchoran-text-secondary,#9aa0ab)", fontSize: 12.5 } }, "No habits yet."),
        habits.map((h2) =>
          h(
            "div",
            { key: h2.id, className: "ht-row" },
            h(
              "div",
              { className: "ht-header" },
              h("span", { className: "ht-name" }, h2.name),
              h("span", { className: "ht-streak" }, `${currentStreak(h2.doneDates)} day streak`),
              h("span", { className: "ht-best" }, `best ${bestStreak(h2.doneDates)}`),
              h("button", { className: "ht-remove", onClick: () => removeHabit(h2.id), "aria-label": "Delete" }, Icon ? h(Icon, { name: "close", size: 12 }) : "×")
            ),
            h("div", { className: "ht-days" }, days.map((day) => h("button", { key: day, className: "ht-day", "data-done": h2.doneDates.includes(day), title: day, onClick: () => toggleDay(h2.id, day) })))
          )
        )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
