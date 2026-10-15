import { Children, Fragment, isValidElement } from "react";
import SearchableSelect from "./SearchableSelect";

// Drop-in replacement for a native <select>: same <option>/<optgroup>
// children, same `value`, same onChange(e) with e.target.value — but drawn
// with the app's dropdown (SearchableSelect) so every screen looks the same.
//
//   <Select value={status} onChange={(e) => setStatus(e.target.value)}>
//     <option value="">All Statuses</option>
//     <option value="Draft">Draft</option>
//   </Select>
//
// A disabled option with an empty value is the native "placeholder" idiom and
// becomes the control's placeholder text instead of a selectable row.

function textOf(node) {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf(node.props.children);
  return "";
}

function collect(children, out) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === Fragment) {
      collect(child.props.children, out);
    } else if (child.type === "optgroup") {
      out.push({ header: child.props.label });
      collect(child.props.children, out);
    } else if (child.type === "option") {
      const label = textOf(child.props.children);
      const value = child.props.value !== undefined ? String(child.props.value) : label;
      out.push({ value, label, disabled: Boolean(child.props.disabled) });
    }
  });
  return out;
}

export default function Select({
  value,
  onChange,
  children,
  disabled,
  className,
  style,
  name,
  title,
  searchable,
  placeholder,
  "aria-label": ariaLabel,
}) {
  const all = collect(children, []);
  const placeholderOption = all.find((o) => o.value === "" && o.disabled);
  const options = all.filter((o) => o !== placeholderOption);

  return (
    <SearchableSelect
      value={value}
      options={options}
      disabled={disabled}
      className={className}
      style={style}
      title={title}
      ariaLabel={ariaLabel}
      searchable={searchable}
      placeholder={placeholder || (placeholderOption && placeholderOption.label) || "Select..."}
      onChange={(val) => onChange && onChange({ target: { value: val, name }, currentTarget: { value: val, name } })}
    />
  );
}
