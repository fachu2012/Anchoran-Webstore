/**
 * Calendar — ported from Anchoran OS's bundled "calendar" app (month/
 * week/day views, same date-key math). New for this migration: a
 * "Notify today's events" toolbar button that pushes a real Anchoran
 * notification (sdk.pushNotification) for each event on today's date.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.cal-title{font-size:13px;font-weight:500;min-width:130px;text-align:center;}
.cal-views{margin-left:auto;display:flex;gap:4px;}
.cal-content{display:flex;gap:16px;flex-wrap:wrap;}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;flex:1;min-width:260px;}
.cal-weekday{text-align:center;font-size:11px;color:var(--anchoran-text-secondary,#9aa0ab);padding:4px 0;}
.cal-cell{aspect-ratio:1/1;border:1px solid transparent;border-radius:6px;background:var(--anchoran-surface,#1c1d22);color:var(--anchoran-text-primary,#F3F4F6);cursor:pointer;position:relative;font-size:12.5px;}
.cal-cell:disabled{background:transparent;cursor:default;}
.cal-cell[data-today="true"]{border-color:var(--anchoran-accent,#5B8DEF);}
.cal-cell[data-selected="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));}
.cal-dot{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:var(--anchoran-accent,#5B8DEF);}
.cal-week-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;flex:1;min-width:260px;}
.cal-week-day{border:1px solid var(--anchoran-border,#2a2c33);border-radius:8px;padding:6px;background:var(--anchoran-surface,#1c1d22);cursor:pointer;text-align:left;min-height:70px;}
.cal-week-day[data-today="true"]{border-color:var(--anchoran-accent,#5B8DEF);}
.cal-week-day[data-selected="true"]{background:var(--anchoran-accent-soft,rgba(91,141,239,.15));}
.cal-week-day-label{font-size:11px;color:var(--anchoran-text-secondary,#9aa0ab);margin-bottom:4px;}
.cal-week-event{font-size:11px;background:var(--anchoran-accent-soft,rgba(91,141,239,.15));color:var(--anchoran-accent,#5B8DEF);border-radius:4px;padding:1px 4px;margin-bottom:2px;}
.cal-side{width:220px;flex-shrink:0;}
.cal-side-title{font-size:12.5px;font-weight:500;margin-bottom:8px;}
.cal-event-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--anchoran-border,#2a2c33);font-size:12.5px;}
.cal-add{display:flex;gap:6px;margin-top:10px;}
`;

const STORAGE_KEY = "calendarEvents";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function todayKey() {
  const t = new Date();
  return toKey(t.getFullYear(), t.getMonth(), t.getDate());
}
function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function mount(container, sdk) {
  injectStyle("calendar", CSS);
  const store = pluginStorage("calendar");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useMemo } = React;

  function App() {
    const [cursor, setCursor] = useState(() => {
      const t = new Date();
      return { year: t.getFullYear(), month: t.getMonth() };
    });
    const [events, setEvents] = useState(() => store.get(STORAGE_KEY, []));
    const [selectedDate, setSelectedDate] = useState(todayKey());
    const [draft, setDraft] = useState("");
    const [viewMode, setViewMode] = useState("month");

    function save(next) {
      setEvents(next);
      store.set(STORAGE_KEY, next);
    }

    function addEvent() {
      const title = draft.trim();
      if (!title) return;
      save([...events, { id: `${Date.now()}`, date: selectedDate, title }]);
      setDraft("");
    }

    function removeEvent(id) {
      save(events.filter((e) => e.id !== id));
    }

    function notifyToday() {
      const list = eventsByDate.get(todayKey()) ?? [];
      if (list.length === 0) {
        sdk.pushNotification("Calendar", "No events today.");
        return;
      }
      for (const e of list) sdk.pushNotification("Today", e.title);
    }

    const cells = useMemo(() => {
      const { year, month } = cursor;
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const list = [];
      for (let i = 0; i < firstDay; i++) list.push({ key: `pad-${i}`, day: null });
      for (let d = 1; d <= daysInMonth; d++) list.push({ key: toKey(year, month, d), day: d });
      return list;
    }, [cursor]);

    const eventsByDate = useMemo(() => {
      const map = new Map();
      for (const e of events) {
        if (!map.has(e.date)) map.set(e.date, []);
        map.get(e.date).push(e);
      }
      return map;
    }, [events]);

    const selectedEvents = eventsByDate.get(selectedDate) ?? [];

    const weekCells = useMemo(() => {
      const anchor = keyToDate(selectedDate);
      const start = new Date(anchor);
      start.setDate(anchor.getDate() - anchor.getDay());
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return toKey(d.getFullYear(), d.getMonth(), d.getDate());
      });
    }, [selectedDate]);

    function step(direction) {
      if (viewMode === "month") {
        setCursor((c) => (direction === -1 ? (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }) : c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }));
        return;
      }
      const days = viewMode === "week" ? 7 : 1;
      const next = keyToDate(selectedDate);
      next.setDate(next.getDate() + days * direction);
      const key = toKey(next.getFullYear(), next.getMonth(), next.getDate());
      setSelectedDate(key);
      setCursor({ year: next.getFullYear(), month: next.getMonth() });
    }

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("button", { className: "pk-btn", onClick: () => step(-1) }, "‹"),
        h("span", { className: "cal-title" }, viewMode === "day" ? keyToDate(selectedDate).toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" }) : `${MONTHS[cursor.month]} ${cursor.year}`),
        h("button", { className: "pk-btn", onClick: () => step(1) }, "›"),
        h(
          "button",
          {
            className: "pk-btn",
            onClick: () => {
              const t = new Date();
              setCursor({ year: t.getFullYear(), month: t.getMonth() });
              setSelectedDate(todayKey());
            },
          },
          "Today"
        ),
        h("button", { className: "pk-btn", onClick: notifyToday }, Icon ? h(Icon, { name: "bell", size: 13 }) : null, " Notify today's events"),
        h(
          "div",
          { className: "cal-views" },
          ["month", "week", "day"].map((v) => h("button", { key: v, className: "pk-btn", "data-active": viewMode === v, onClick: () => setViewMode(v) }, v[0].toUpperCase() + v.slice(1)))
        )
      ),
      h(
        "div",
        { className: "pk-content cal-content" },
        viewMode === "month" &&
          h(
            "div",
            { className: "cal-grid" },
            WEEKDAYS.map((w) => h("div", { key: w, className: "cal-weekday" }, w)),
            cells.map((c) =>
              h(
                "button",
                {
                  key: c.key,
                  className: "cal-cell",
                  disabled: c.day === null,
                  "data-today": c.key === todayKey(),
                  "data-selected": c.key === selectedDate,
                  onClick: () => c.day !== null && setSelectedDate(c.key),
                },
                c.day,
                eventsByDate.has(c.key) && h("span", { className: "cal-dot" })
              )
            )
          ),
        viewMode === "week" &&
          h(
            "div",
            { className: "cal-week-grid" },
            weekCells.map((key) => {
              const d = keyToDate(key);
              return h(
                "button",
                { key, className: "cal-week-day", "data-today": key === todayKey(), "data-selected": key === selectedDate, onClick: () => setSelectedDate(key) },
                h("div", { className: "cal-week-day-label" }, `${WEEKDAYS[d.getDay()]} ${d.getDate()}`),
                h("div", null, (eventsByDate.get(key) ?? []).map((e) => h("div", { key: e.id, className: "cal-week-event" }, e.title)))
              );
            })
          ),
        h(
          "div",
          { className: "cal-side" },
          h("div", { className: "cal-side-title" }, selectedDate),
          h(
            "div",
            null,
            selectedEvents.length === 0 && h("div", { style: { color: "var(--anchoran-text-secondary,#9aa0ab)", fontSize: 12.5 } }, "No events."),
            selectedEvents.map((e) => h("div", { key: e.id, className: "cal-event-row" }, h("span", null, e.title), h("button", { className: "cm-remove", onClick: () => removeEvent(e.id), "aria-label": "Delete", style: { background: "transparent", border: "none", color: "var(--anchoran-text-secondary,#9aa0ab)", cursor: "pointer" } }, "×")))
          ),
          h(
            "div",
            { className: "cal-add" },
            h("input", { className: "pk-input", style: { flex: 1 }, placeholder: "Add event…", value: draft, onChange: (e) => setDraft(e.target.value), onKeyDown: (e) => e.key === "Enter" && addEvent() }),
            h("button", { className: "pk-btn", onClick: addEvent }, Icon ? h(Icon, { name: "plus", size: 13 }) : "+")
          )
        )
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
