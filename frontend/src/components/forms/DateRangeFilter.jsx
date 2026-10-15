import DateInput from "./DateInput";
import Select from "./Select";
// A single "Date Range" preset dropdown (Today / Yesterday / Last 7 Days /
// Last 1 Month / Custom Range) that replaces a filter bar's separate,
// always-visible From/To date pickers — those only reappear when "Custom
// Range" is chosen, so picking a quick preset is a single click the rest of
// the time.
export const DATE_RANGE_PRESETS = ["Today", "Yesterday", "Last 7 Days", "Last 1 Month", "Custom Range"];

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// Given a preset label, returns the {dateFrom, dateTo} (YYYY-MM-DD) the rest
// of the page's filter logic already expects — same format the old plain
// <DateInput > fields produced, so nothing else needs to change.
export function presetToRange(preset) {
  const from = new Date();
  const to = new Date();
  switch (preset) {
    case "Today":
      break;
    case "Yesterday":
      from.setDate(from.getDate() - 1);
      to.setDate(to.getDate() - 1);
      break;
    case "Last 7 Days":
      from.setDate(from.getDate() - 6);
      break;
    case "Last 1 Month":
      from.setMonth(from.getMonth() - 1);
      from.setDate(from.getDate() + 1);
      break;
    default:
      return { dateFrom: "", dateTo: "" };
  }
  return { dateFrom: isoDate(from), dateTo: isoDate(to) };
}

// `value`: { preset, dateFrom, dateTo }. `onChange` receives the same shape.
export default function DateRangeFilter({ value, onChange }) {
  const { preset = "", dateFrom = "", dateTo = "" } = value || {};

  return (
    <>
      <div className="filter-field">
        <label>Date Range</label>
        <Select
          value={preset}
          onChange={(e) => {
            const next = e.target.value;
            onChange({ preset: next, ...presetToRange(next) });
          }}
        >
          <option value="">All Dates</option>
          {DATE_RANGE_PRESETS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </Select>
      </div>
      {preset === "Custom Range" && (
        <>
          <div className="filter-field">
            <label>From Date</label>
            <DateInput value={dateFrom} onChange={(e) => onChange({ preset, dateFrom: e.target.value, dateTo })} />
          </div>
          <div className="filter-field">
            <label>To Date</label>
            <DateInput value={dateTo} onChange={(e) => onChange({ preset, dateFrom, dateTo: e.target.value })} />
          </div>
        </>
      )}
    </>
  );
}
