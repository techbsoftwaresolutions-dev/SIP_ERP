import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme";
import { Button, ErrorBox, Icon, IconButton, usePrimary } from "../ui";

// ---------------------------------------------------------------------------
// Primitive inputs
// ---------------------------------------------------------------------------

export function FieldLabel({ label, required, right }) {
  return (
    <View style={s.labelRow}>
      <Text style={s.label}>
        {label}
        {required ? <Text style={{ color: colors.red }}> *</Text> : null}
      </Text>
      {right}
    </View>
  );
}

export function Input({ value, onChangeText, style, multiline, readOnly, ...rest }) {
  return (
    <TextInput
      value={value == null ? "" : String(value)}
      onChangeText={onChangeText}
      editable={!readOnly}
      multiline={multiline}
      placeholderTextColor={colors.textLight}
      style={[s.input, multiline && { minHeight: 80, textAlignVertical: "top" }, readOnly && s.readOnly, style]}
      {...rest}
    />
  );
}

export function TextField({ label, required, error, hint, ...rest }) {
  return (
    <View style={s.field}>
      {label ? <FieldLabel label={label} required={required} /> : null}
      <Input {...rest} style={[error && s.inputError, rest.style]} />
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      {error ? <Text style={s.error}>{error}</Text> : null}
    </View>
  );
}

export function CheckboxField({ label, value, onChange }) {
  const primary = usePrimary();
  return (
    <Pressable style={[s.field, s.checkRow]} onPress={() => onChange(!value)}>
      <Switch value={!!value} onValueChange={onChange} trackColor={{ true: primary }} />
      <Text style={{ flex: 1, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}

// Dropdown with search. When `onCreate` is given, a typed value that matches
// nothing can be used as a new entry (same contract as the web SearchableSelect).
export function SearchableSelect({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  onCreate,
  createLabel = (t) => `+ Add "${t}"`,
  searchable = true,
  title,
  disabled,
  style,
  allowClear,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const primary = usePrimary();
  // Options may be plain strings or { label, value }.
  const normalized = useMemo(
    () => options.map((o) => (typeof o === "object" && o !== null ? o : { label: String(o), value: o })),
    [options]
  );
  const selected = normalized.find((o) => o.value === value);
  const shown = selected ? selected.label : value ? String(value) : "";
  const q = query.trim().toLowerCase();
  const filtered = q ? normalized.filter((o) => o.label.toLowerCase().includes(q)) : normalized;
  const exact = normalized.some((o) => o.label.toLowerCase() === q);
  const canCreate = Boolean(onCreate) && q.length > 0 && !exact;

  const pick = (v) => {
    onChange(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[s.input, s.selectBox, disabled && s.readOnly, style]}
      >
        <Text style={{ flex: 1, color: shown ? colors.text : colors.textLight }} numberOfLines={1}>
          {shown || placeholder}
        </Text>
        <Icon name="chevronDown" size={16} color={colors.textMuted} />
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle} numberOfLines={1}>
              {title || placeholder}
            </Text>
            <IconButton name="close" onPress={() => setOpen(false)} color={colors.text} />
          </View>
          {searchable && (normalized.length > 6 || onCreate) ? (
            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Input value={query} onChangeText={setQuery} placeholder="Search..." autoFocus autoCorrect={false} />
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(o, i) => `${String(o.value)}-${i}`}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                {canCreate ? (
                  <Pressable
                    style={s.option}
                    onPress={async () => {
                      const created = await onCreate(query.trim());
                      pick(created ?? query.trim());
                    }}
                  >
                    <Text style={{ color: primary, fontWeight: "700" }}>{createLabel(query.trim())}</Text>
                  </Pressable>
                ) : null}
                {allowClear && value ? (
                  <Pressable style={s.option} onPress={() => pick("")}>
                    <Text style={{ color: colors.textMuted }}>Clear selection</Text>
                  </Pressable>
                ) : null}
              </>
            }
            renderItem={({ item }) => (
              <Pressable style={s.option} onPress={() => pick(item.value)}>
                <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>{item.label}</Text>
                {item.value === value ? <Icon name="check" size={18} color={primary} /> : null}
              </Pressable>
            )}
            ListEmptyComponent={
              !canCreate ? <Text style={{ padding: 20, color: colors.textMuted, textAlign: "center" }}>No options.</Text> : null
            }
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Date picker — "YYYY-MM-DD" in and out, like the web DateInput. Drawn in JS
// so it behaves the same on Android, iOS and the web preview.
// ---------------------------------------------------------------------------

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n) => String(n).padStart(2, "0");
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseISO(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}
export function displayDate(v) {
  const d = parseISO(v);
  if (!d) return v || "";
  return `${pad(d.getDate())} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
}

export function DateInput({ value, onChange, placeholder = "Select date", disabled, style }) {
  const [open, setOpen] = useState(false);
  const selected = parseISO(value);
  const [view, setView] = useState(() => {
    const b = selected || new Date();
    return { y: b.getFullYear(), m: b.getMonth() };
  });
  const primary = usePrimary();

  const openPicker = () => {
    const b = parseISO(value) || new Date();
    setView({ y: b.getFullYear(), m: b.getMonth() });
    setOpen(true);
  };
  const first = new Date(view.y, view.m, 1).getDay();
  const days = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const step = (n) => setView((v) => {
    const d = new Date(v.y, v.m + n, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const todayISO = toISO(new Date());

  return (
    <>
      <Pressable disabled={disabled} onPress={openPicker} style={[s.input, s.selectBox, disabled && s.readOnly, style]}>
        <Text style={{ flex: 1, color: value ? colors.text : colors.textLight }}>{value ? displayDate(value) : placeholder}</Text>
        <Icon name="calendar" size={16} color={colors.textMuted} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={s.calendar} onPress={() => {}}>
            <View style={s.calHeader}>
              <IconButton name="chevron-left" onPress={() => step(-1)} color={colors.text} />
              <Pressable onPress={() => step(-12)} onLongPress={() => step(12)}>
                <Text style={{ fontWeight: "700", fontSize: 16 }}>
                  {MONTHS[view.m]} {view.y}
                </Text>
              </Pressable>
              <IconButton name="chevronRight" onPress={() => step(1)} color={colors.text} />
            </View>
            <View style={s.calGrid}>
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <Text key={d} style={[s.calCell, { color: colors.textMuted, fontSize: 12 }]}>
                  {d}
                </Text>
              ))}
              {cells.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={s.calCell} />;
                const iso = `${view.y}-${pad(view.m + 1)}-${pad(d)}`;
                const isSel = iso === value;
                return (
                  <Pressable
                    key={iso}
                    onPress={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    style={[s.calCell, s.calDay, isSel && { backgroundColor: primary }, iso === todayISO && !isSel && { borderWidth: 1, borderColor: primary }]}
                  >
                    <Text style={{ color: isSel ? "#fff" : colors.text }}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <Button title="Clear" variant="secondary" small style={{ flex: 1 }} onPress={() => { onChange(""); setOpen(false); }} />
              <Button title="Today" variant="secondary" small style={{ flex: 1 }} onPress={() => { onChange(todayISO); setOpen(false); }} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Line-items editor — one card per row instead of the web's wide table.
// Same column contract as frontend/src/components/forms/ItemsEditor.jsx:
// { key, label, type: combo|select|number|date|text, options, readOnly,
//   deriveFrom: { source, match, fields: { targetKey: sourceKey } } }
// ---------------------------------------------------------------------------

export function ItemsEditor({ columns, rows, onChange, computeRow, addRowLabel = "+ Add Item", emptyDefaults }) {
  const makeEmptyRow = () => {
    const row = { ...(emptyDefaults || {}) };
    columns.forEach((c) => {
      if (row[c.key] === undefined) row[c.key] = "";
    });
    return computeRow ? computeRow(row) : row;
  };

  const updateRow = (idx, key, value) => {
    const next = rows.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, [key]: value };
      const col = columns.find((c) => c.key === key);
      if (col && col.deriveFrom) {
        const match = (col.deriveFrom.source || []).find((rec) => rec[col.deriveFrom.match] === value);
        if (match) {
          Object.entries(col.deriveFrom.fields).forEach(([targetKey, sourceKey]) => {
            updated[targetKey] = match[sourceKey] ?? updated[targetKey];
          });
        }
      }
      return updated;
    });
    onChange(computeRow ? next.map((r) => computeRow(r)) : next);
  };

  return (
    <View style={{ gap: 10 }}>
      {rows.length === 0 ? <Text style={{ color: colors.textMuted }}>No items added yet.</Text> : null}
      {rows.map((row, idx) => (
        <View key={idx} style={s.itemCard}>
          <View style={s.itemCardHeader}>
            <Text style={{ fontWeight: "700", color: colors.textMuted }}>Item {idx + 1}</Text>
            <IconButton name="trash" color={colors.red} onPress={() => onChange(rows.filter((_, i) => i !== idx))} />
          </View>
          <View style={s.itemGrid}>
            {columns.map((c, ci) => {
              const wide = ci === 0 || c.type === "combo" || c.wide;
              return (
                <View key={c.key} style={[s.itemCell, wide && { width: "100%" }]}>
                  <Text style={s.itemLabel}>{c.label}</Text>
                  {c.readOnly ? (
                    <Text style={[s.input, s.readOnly, { paddingVertical: 10 }]}>
                      {typeof row[c.key] === "number" ? row[c.key].toLocaleString("en-IN", { maximumFractionDigits: 2 }) : row[c.key] || "—"}
                    </Text>
                  ) : c.type === "combo" || c.type === "select" ? (
                    <SearchableSelect
                      value={row[c.key] || ""}
                      onChange={(v) => updateRow(idx, c.key, v)}
                      options={c.options || []}
                      placeholder="Select..."
                      title={c.label}
                      onCreate={c.type === "combo" ? (t) => t : undefined}
                      createLabel={(t) => `Use "${t}"`}
                    />
                  ) : c.type === "date" ? (
                    <DateInput value={row[c.key] || ""} onChange={(v) => updateRow(idx, c.key, v)} />
                  ) : (
                    <Input
                      value={row[c.key] ?? ""}
                      onChangeText={(v) => updateRow(idx, c.key, v)}
                      keyboardType={c.type === "number" ? "decimal-pad" : "default"}
                    />
                  )}
                </View>
              );
            })}
          </View>
        </View>
      ))}
      <Button title={addRowLabel} variant="secondary" icon="plus" onPress={() => onChange([...rows, makeEmptyRow()])} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Generic record form — a port of frontend/src/components/forms/AddRecordForm.jsx
// that accepts the exact same `fields` schema, so every web field config
// (pages/**/*Fields.js and the inline addConfig.fields) works here as-is.
// ---------------------------------------------------------------------------

const TOGGLE_PRESETS = {
  "select-or-text": [
    { mode: "select", label: "Dropdown" },
    { mode: "text", label: "Type New" },
  ],
  "auto-or-manual": [
    { mode: "auto", label: "Auto" },
    { mode: "manual", label: "Manual" },
  ],
};

export function AddRecordForm({ fields, onSubmit, onCancel, submitLabel = "Add", initialValues, footer }) {
  const [values, setValues] = useState(() => {
    const initial = {};
    fields.forEach((f) => {
      let existing = initialValues ? initialValues[f.key] : undefined;
      if (f.type === "items") {
        const rows = Array.isArray(existing) ? existing : [];
        initial[f.key] = f.computeRow ? rows.map((r) => f.computeRow(r)) : rows;
        return;
      }
      if (f.type === "checkbox") {
        initial[f.key] = existing ?? f.defaultValue ?? false;
        return;
      }
      if (Array.isArray(existing)) existing = existing.join(", ");
      if (existing === undefined && f.type === "auto-or-manual" && f.generate) initial[f.key] = f.generate();
      else initial[f.key] = existing ?? f.defaultValue ?? "";
    });
    return initial;
  });
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [fieldModes, setFieldModes] = useState(() => {
    const modes = {};
    fields.forEach((f) => {
      const existing = initialValues ? initialValues[f.key] : undefined;
      if (f.type === "select-or-text") modes[f.key] = existing && !(f.options || []).includes(existing) ? "text" : "select";
      else if (f.type === "auto-or-manual") modes[f.key] = existing ? "manual" : "auto";
    });
    return modes;
  });
  const primary = usePrimary();

  const clearFieldError = (key) =>
    setFieldErrors((fe) => {
      if (!fe[key]) return fe;
      const { [key]: _drop, ...rest } = fe;
      return rest;
    });

  const applyDerived = (field, val, next) => {
    fields.forEach((f) => {
      const rules = Array.isArray(f.deriveFrom) ? f.deriveFrom : f.deriveFrom ? [f.deriveFrom] : [];
      for (const rule of rules) {
        if (rule.field !== field.key) continue;
        const match = (rule.source || []).find((item) => item[rule.match] === val);
        if (match) next[f.key] = match[rule.pick] || "";
      }
    });
  };

  const setFieldValue = (field, raw) => {
    let val = raw;
    if (field.type === "phone") val = String(val).replace(/\D/g, "").slice(0, 10);
    else if (field.type === "pincode") val = String(val).replace(/\D/g, "").slice(0, 6);
    clearFieldError(field.key);
    setValues((v) => {
      const next = { ...v, [field.key]: val };
      applyDerived(field, val, next);
      return next;
    });
  };

  const setFieldMode = (field, mode) => {
    if (fieldModes[field.key] === mode) return;
    setFieldModes((m) => ({ ...m, [field.key]: mode }));
    setValues((v) => {
      if (field.type === "auto-or-manual") return { ...v, [field.key]: mode === "auto" && field.generate ? field.generate() : "" };
      const next = { ...v, [field.key]: "" };
      fields.forEach((f) => {
        const rules = Array.isArray(f.deriveFrom) ? f.deriveFrom : f.deriveFrom ? [f.deriveFrom] : [];
        if (rules.some((rule) => rule.field === field.key)) next[f.key] = "";
      });
      return next;
    });
  };

  const isFieldRequired = (f) => (f.type === "auto-or-manual" ? f.required && fieldModes[f.key] === "manual" : f.required);

  const handleSubmit = async () => {
    setError("");
    const errors = {};
    fields.forEach((f) => {
      if (f.hidden) return;
      if (f.type === "items") {
        if (f.required && (!Array.isArray(values[f.key]) || values[f.key].length === 0)) errors[f.key] = "Add at least one row.";
        return;
      }
      if (f.type === "checkbox") return;
      const filled = String(values[f.key] ?? "").trim();
      if (isFieldRequired(f) && !filled) errors[f.key] = `${f.label} is required.`;
      else if (f.type === "number" && f.min != null && filled && Number(values[f.key]) < f.min) errors[f.key] = `${f.label} must be at least ${f.min}.`;
      else if (f.type === "phone" && values[f.key] && String(values[f.key]).length !== 10) errors[f.key] = `${f.label} must be a 10-digit mobile number.`;
      else if (f.type === "email" && filled && !/^\S+@\S+\.\S+$/.test(filled)) errors[f.key] = `${f.label} must be a valid email.`;
    });
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setError(Object.keys(errors).length === 1 ? Object.values(errors)[0] : "Please fix the highlighted fields.");
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View>
      <ErrorBox message={error} />
      {fields
        .filter((f) => !f.hidden)
        .map((f) => {
          const fe = fieldErrors[f.key];
          const toggle = TOGGLE_PRESETS[f.type];
          const mode = fieldModes[f.key];
          const common = { value: values[f.key], onChange: (v) => setFieldValue(f, v) };
          let control;
          if (f.type === "items") {
            control = (
              <ItemsEditor
                columns={f.columns || []}
                rows={values[f.key] || []}
                onChange={(rows) => {
                  clearFieldError(f.key);
                  setValues((v) => ({ ...v, [f.key]: rows }));
                }}
                computeRow={f.computeRow}
                emptyDefaults={f.emptyDefaults}
                addRowLabel={f.addRowLabel}
              />
            );
          } else if (f.type === "checkbox") {
            return <CheckboxField key={f.key} label={f.label} value={values[f.key]} onChange={(v) => setFieldValue(f, v)} />;
          } else if (f.type === "combo") {
            control = (
              <SearchableSelect
                {...common}
                options={f.options || []}
                title={f.label}
                placeholder={f.placeholder || `Select ${f.label.toLowerCase()}`}
                onCreate={f.onCreate}
                createLabel={f.createLabel || ((t) => `+ Add "${t}" as new ${f.label.toLowerCase()}`)}
              />
            );
          } else if (f.type === "select" || (f.type === "select-or-text" && mode === "select")) {
            control = (
              <SearchableSelect
                {...common}
                options={f.options || []}
                title={f.label}
                placeholder={`Select ${f.label.toLowerCase()}`}
              />
            );
          } else if (f.type === "date") {
            control = <DateInput {...common} />;
          } else {
            // `signed` numbers need a minus key, which iOS decimal pads lack.
            const kb =
              f.type === "number" && f.signed ? "numbers-and-punctuation" : f.type === "number" ? "decimal-pad" : f.type === "phone" || f.type === "pincode" ? "number-pad" : f.type === "email" ? "email-address" : "default";
            control = (
              <Input
                value={values[f.key]}
                onChangeText={(v) => setFieldValue(f, v)}
                placeholder={f.type === "select-or-text" ? `Enter new ${f.label.toLowerCase()}` : f.placeholder}
                keyboardType={kb}
                multiline={f.type === "textarea"}
                secureTextEntry={f.type === "password"}
                autoCapitalize={f.type === "email" || f.type === "password" ? "none" : "sentences"}
                maxLength={f.type === "phone" ? 10 : f.type === "pincode" ? 6 : undefined}
                readOnly={f.readOnly || (f.type === "auto-or-manual" && mode === "auto")}
                style={fe && s.inputError}
              />
            );
          }
          return (
            <View key={f.key} style={s.field}>
              <FieldLabel
                label={f.label}
                required={isFieldRequired(f)}
                right={
                  toggle ? (
                    <View style={s.toggle}>
                      {toggle.map((o) => (
                        <Pressable
                          key={o.mode}
                          onPress={() => setFieldMode(f, o.mode)}
                          style={[s.toggleBtn, mode === o.mode && { backgroundColor: primary }]}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "700", color: mode === o.mode ? "#fff" : colors.textMuted }}>
                            {o.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null
                }
              />
              {control}
              {f.hint ? <Text style={s.hint}>{f.hint}</Text> : null}
              {fe ? <Text style={s.error}>{fe}</Text> : null}
            </View>
          );
        })}
      {footer ? footer(values) : null}
      <View style={s.actions}>
        {onCancel ? <Button title="Cancel" variant="secondary" onPress={onCancel} disabled={submitting} style={{ flex: 1 }} /> : null}
        <Button title={submitting ? "Saving..." : submitLabel} onPress={handleSubmit} loading={submitting} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export const formStyles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
});

const s = StyleSheet.create({
  field: { marginBottom: 14 },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 13, fontWeight: "600", color: colors.text },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
  },
  inputError: { borderColor: colors.red },
  readOnly: { backgroundColor: colors.grayBg, color: colors.textMuted },
  selectBox: { flexDirection: "row", alignItems: "center", gap: 8 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  error: { fontSize: 12, color: colors.red, marginTop: 4 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  pickerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  pickerTitle: { fontSize: 18, fontWeight: "700", color: colors.text, flex: 1 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", padding: 20 },
  calendar: { backgroundColor: "#fff", borderRadius: 14, padding: 14 },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center", textAlign: "center", textAlignVertical: "center" },
  calDay: { borderRadius: 50 },
  itemCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, backgroundColor: "#fafbfc" },
  itemCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  itemGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  itemCell: { width: "50%", paddingHorizontal: 4, marginBottom: 8 },
  itemLabel: { fontSize: 11, color: colors.textMuted, marginBottom: 4 },
  toggle: { flexDirection: "row", backgroundColor: colors.grayBg, borderRadius: 14, padding: 2 },
  toggleBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
});
