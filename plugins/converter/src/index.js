/**
 * Converter — fuses two former Anchoran OS bundled apps with the same
 * purpose (convert a value from one unit to another): "converter"
 * (Converter.tsx: length/weight/temperature/data) and
 * "currencyconverter" (CurrencyConverter.tsx: live exchange rates via
 * the Frankfurter API — already an external network call, unchanged
 * here). New for this migration: two more unit categories, Area and
 * Speed, using the same linear-factor pattern as the original's own
 * length/weight/data categories.
 */
import { injectStyle, SHELL_CSS } from "../../_shared/pluginKit.js";

const CSS =
  SHELL_CSS +
  `
.cv-content{display:flex;flex-direction:column;align-items:center;gap:12px;}
.cv-row{display:flex;gap:8px;width:100%;max-width:320px;}
.cv-input{flex:1;}
.cv-select{flex:1;}
.cv-equals{font-size:18px;color:var(--anchoran-text-secondary,#9aa0ab);}
.cv-result{flex:1;background:var(--anchoran-surface,#1c1d22);border:1px solid var(--anchoran-border,#2a2c33);border-radius:6px;padding:6px 10px;font-size:15px;display:flex;align-items:center;}
.cv-currency-amount{width:100%;max-width:320px;font-size:20px;text-align:center;}
.cv-currency-result{text-align:center;}
.cv-currency-result-value{font-size:22px;}
.cv-currency-result-meta{font-size:11.5px;color:var(--anchoran-text-secondary,#9aa0ab);margin-top:4px;}
.cv-error{color:#E5484D;font-size:12.5px;}
.cv-loading{color:var(--anchoran-text-secondary,#9aa0ab);font-size:12.5px;}
`;

const LINEAR_UNITS = {
  length: [
    { label: "Millimeters", toBase: 0.001 }, { label: "Centimeters", toBase: 0.01 }, { label: "Meters", toBase: 1 },
    { label: "Kilometers", toBase: 1000 }, { label: "Inches", toBase: 0.0254 }, { label: "Feet", toBase: 0.3048 }, { label: "Miles", toBase: 1609.344 },
  ],
  weight: [
    { label: "Grams", toBase: 1 }, { label: "Kilograms", toBase: 1000 }, { label: "Ounces", toBase: 28.3495 }, { label: "Pounds", toBase: 453.592 },
  ],
  data: [
    { label: "Bytes", toBase: 1 }, { label: "Kilobytes", toBase: 1024 }, { label: "Megabytes", toBase: 1024 ** 2 }, { label: "Gigabytes", toBase: 1024 ** 3 },
  ],
  area: [
    { label: "Square meters", toBase: 1 }, { label: "Square kilometers", toBase: 1e6 }, { label: "Square feet", toBase: 0.092903 },
    { label: "Acres", toBase: 4046.86 }, { label: "Hectares", toBase: 10000 },
  ],
  speed: [
    { label: "Meters/sec", toBase: 1 }, { label: "Kilometers/hour", toBase: 0.277778 }, { label: "Miles/hour", toBase: 0.44704 }, { label: "Knots", toBase: 0.514444 },
  ],
};
const TEMPERATURE_UNITS = ["Celsius", "Fahrenheit", "Kelvin"];
function celsiusFrom(unit, value) {
  if (unit === "Celsius") return value;
  if (unit === "Fahrenheit") return ((value - 32) * 5) / 9;
  return value - 273.15;
}
function celsiusTo(unit, celsius) {
  if (unit === "Celsius") return celsius;
  if (unit === "Fahrenheit") return (celsius * 9) / 5 + 32;
  return celsius + 273.15;
}
const CATEGORY_LABELS = { length: "Length", weight: "Weight", temperature: "Temperature", data: "Data Size", area: "Area", speed: "Speed" };
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "ARS", "BRL", "CAD", "AUD", "CHF", "CNY", "MXN"];

export function mount(container, sdk) {
  injectStyle("converter", CSS);
  const { React, ReactDOM, Icon } = sdk;
  const { createElement: h, useState, useMemo, useEffect } = React;

  function UnitsPanel() {
    const [category, setCategory] = useState("length");
    const [fromUnit, setFromUnit] = useState(0);
    const [toUnit, setToUnit] = useState(1);
    const [input, setInput] = useState("1");

    const options = category === "temperature" ? TEMPERATURE_UNITS : LINEAR_UNITS[category].map((u) => u.label);

    const result = useMemo(() => {
      const value = parseFloat(input);
      if (Number.isNaN(value)) return "";
      if (category === "temperature") {
        const celsius = celsiusFrom(TEMPERATURE_UNITS[fromUnit], value);
        return String(Math.round(celsiusTo(TEMPERATURE_UNITS[toUnit], celsius) * 1000) / 1000);
      }
      const units = LINEAR_UNITS[category];
      const base = value * units[fromUnit].toBase;
      return String(Math.round((base / units[toUnit].toBase) * 100000) / 100000);
    }, [category, fromUnit, toUnit, input]);

    function onCategoryChange(next) {
      setCategory(next);
      setFromUnit(0);
      setToUnit(1);
    }

    return h(
      React.Fragment,
      null,
      h(
        "div",
        { className: "pk-toolbar" },
        Object.keys(CATEGORY_LABELS).map((c) => h("button", { key: c, className: "pk-btn", "data-active": category === c, onClick: () => onCategoryChange(c) }, CATEGORY_LABELS[c]))
      ),
      h(
        "div",
        { className: "pk-content cv-content" },
        h(
          "div",
          { className: "cv-row" },
          h("input", { className: "pk-input cv-input", type: "number", value: input, onChange: (e) => setInput(e.target.value) }),
          h("select", { className: "pk-input cv-select", value: fromUnit, onChange: (e) => setFromUnit(Number(e.target.value)) }, options.map((label, i) => h("option", { key: label, value: i }, label)))
        ),
        h("div", { className: "cv-equals" }, "="),
        h(
          "div",
          { className: "cv-row" },
          h("div", { className: "cv-result" }, result),
          h("select", { className: "pk-input cv-select", value: toUnit, onChange: (e) => setToUnit(Number(e.target.value)) }, options.map((label, i) => h("option", { key: label, value: i }, label)))
        )
      )
    );
  }

  function CurrencyPanel() {
    const [amount, setAmount] = useState("100");
    const [from, setFrom] = useState("USD");
    const [to, setTo] = useState("EUR");
    const [rate, setRate] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [updatedAt, setUpdatedAt] = useState(null);

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setError(null);
      fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`)
        .then((r) => { if (!r.ok) throw new Error("Request failed"); return r.json(); })
        .then((data) => { if (cancelled) return; setRate(data.rates[to]); setUpdatedAt(data.date); })
        .catch(() => { if (!cancelled) setError("Couldn't fetch exchange rates. Check your connection."); })
        .finally(() => !cancelled && setLoading(false));
      return () => { cancelled = true; };
    }, [from, to]);

    const numericAmount = Number(amount) || 0;
    const converted = rate !== null ? numericAmount * rate : null;

    return h(
      "div",
      { className: "pk-content cv-content" },
      h("input", { className: "pk-input cv-currency-amount", type: "number", value: amount, onChange: (e) => setAmount(e.target.value) }),
      h(
        "div",
        { className: "cv-row" },
        h("select", { className: "pk-input cv-select", value: from, onChange: (e) => setFrom(e.target.value) }, CURRENCIES.map((c) => h("option", { key: c, value: c }, c))),
        h("button", { className: "pk-btn", onClick: () => { setFrom(to); setTo(from); }, "aria-label": "Swap" }, Icon ? h(Icon, { name: "converter", size: 14 }) : "⇄"),
        h("select", { className: "pk-input cv-select", value: to, onChange: (e) => setTo(e.target.value) }, CURRENCIES.map((c) => h("option", { key: c, value: c }, c)))
      ),
      error ? h("div", { className: "cv-error" }, error) : loading ? h("div", { className: "cv-loading" }, "Fetching rates…") : converted !== null && h(
        "div",
        { className: "cv-currency-result" },
        h("div", { className: "cv-currency-result-value" }, `${converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${to}`),
        h("div", { className: "cv-currency-result-meta" }, `1 ${from} = ${rate?.toFixed(4)} ${to} · ${updatedAt}`)
      )
    );
  }

  function App() {
    const [tab, setTab] = useState("units");
    return h(
      "div",
      { className: "pk-root" },
      h(
        "div",
        { className: "pk-toolbar", style: { borderBottom: "1px solid var(--anchoran-border,#2a2c33)" } },
        h("button", { className: "pk-btn", "data-active": tab === "units", onClick: () => setTab("units") }, "Units"),
        h("button", { className: "pk-btn", "data-active": tab === "currency", onClick: () => setTab("currency") }, "Currency")
      ),
      tab === "units" ? h(UnitsPanel) : h(CurrencyPanel)
    );
  }

  const root = ReactDOM.createRoot(container);
  root.render(h(App));
  return () => root.unmount();
}
