/**
 * Weather — ported from Anchoran OS's bundled "weather" app (same
 * Open-Meteo geocoding + forecast calls — already external network
 * APIs, not Anchoran-internal, so no adaptation needed there). New
 * for this migration: up to 5 saved cities with quick-switch chips,
 * instead of remembering only the single last-searched city.
 */
import { injectStyle, SHELL_CSS, pluginStorage } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.wx-content{display:flex;flex-direction:column;align-items:center;gap:14px;}
.wx-status{color:var(--anchoran-text-secondary,#9aa0ab);font-size:12.5px;}
.wx-current{display:flex;flex-direction:column;align-items:center;gap:4px;}
.wx-temp{font-size:34px;}
.wx-place{font-size:13.5px;}
.wx-desc{font-size:12px;color:var(--anchoran-text-secondary,#9aa0ab);}
.wx-daily{display:flex;gap:10px;}
.wx-day{display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11.5px;color:var(--anchoran-text-secondary,#9aa0ab);}
.wx-saved{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;}
.wx-chip{background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:14px;padding:4px 10px;font-size:11.5px;cursor:pointer;color:var(--anchoran-text-primary,#F3F4F6);}
`;

const WEATHER_CODES = {
  0: "Clear sky", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Depositing rime fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle", 61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 80: "Light showers", 81: "Showers", 82: "Violent showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Severe thunderstorm with hail",
};
function describeWeatherCode(code) {
  return WEATHER_CODES[code] ?? "Unknown";
}

export function mount(container, sdk) {
  injectStyle("weather", CSS);
  const store = pluginStorage("weather");
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useEffect } = React;

  function App() {
    const [query, setQuery] = useState("");
    const [forecast, setForecast] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [saved, setSaved] = useState(() => store.get("savedCities", []));

    async function search(city) {
      if (!city.trim()) return;
      setLoading(true);
      setError(null);
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`);
        const geo = await geoRes.json();
        const place = geo.results?.[0];
        if (!place) { setError("City not found."); setForecast(null); return; }
        const wRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`);
        const w = await wRes.json();
        setForecast({
          city: place.name,
          country: place.country,
          currentTemp: w.current.temperature_2m,
          currentCode: w.current.weather_code,
          daily: w.daily.time.map((date, i) => ({ date, max: w.daily.temperature_2m_max[i], min: w.daily.temperature_2m_min[i], code: w.daily.weather_code[i] })),
        });
        setQuery(place.name);
        const nextSaved = [place.name, ...saved.filter((c) => c !== place.name)].slice(0, 5);
        setSaved(nextSaved);
        store.set("savedCities", nextSaved);
      } catch {
        setError("Couldn't fetch weather. Check your connection.");
      } finally {
        setLoading(false);
      }
    }

    useEffect(() => {
      const last = store.get("savedCities", [])[0];
      if (last) { setQuery(last); search(last); }
      // eslint-disable-next-line
    }, []);

    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar" },
        h("input", { className: "pk-input", style: { flex: 1 }, placeholder: "Search a city…", value: query, onChange: (e) => setQuery(e.target.value), onKeyDown: (e) => e.key === "Enter" && search(query) }),
        h("button", { className: "pk-btn", onClick: () => search(query) }, Icon ? h(Icon, { name: "search", size: 13 }) : "Go")
      ),
      h(
        "div",
        { className: "pk-content wx-content" },
        saved.length > 0 && h("div", { className: "wx-saved" }, saved.map((c) => h("button", { key: c, className: "wx-chip", onClick: () => { setQuery(c); search(c); } }, c))),
        loading && h("div", { className: "wx-status" }, "Loading…"),
        error && h("div", { className: "wx-status", style: { color: "#E5484D" } }, error),
        !loading && !error && forecast &&
          h(
            React.Fragment,
            null,
            h(
              "div",
              { className: "wx-current" },
              Icon ? h(Icon, { name: "weather", size: 40 }) : null,
              h("div", { className: "wx-temp" }, `${Math.round(forecast.currentTemp)}°C`),
              h("div", { className: "wx-place" }, `${forecast.city}, ${forecast.country}`),
              h("div", { className: "wx-desc" }, describeWeatherCode(forecast.currentCode))
            ),
            h(
              "div",
              { className: "wx-daily" },
              forecast.daily.slice(0, 5).map((d) =>
                h(
                  "div",
                  { key: d.date, className: "wx-day" },
                  h("span", null, new Date(d.date).toLocaleDateString([], { weekday: "short" })),
                  h("span", null, `${Math.round(d.max)}° / ${Math.round(d.min)}°`)
                )
              )
            )
          ),
        !loading && !error && !forecast && h("div", { className: "wx-status" }, "Search for a city to see its forecast.")
      )
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
