import { useState } from "react";
import Icon from "../ui/Icon";

// A password box with an eye button that shows or hides what was typed.
// Takes the same props as a plain <input> (value, onChange, placeholder,
// autoComplete, ...) — it only decides the input's type itself.
export default function PasswordInput({ className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw-field">
      <input {...props} type={show ? "text" : "password"} className={className || undefined} />
      <button
        type="button"
        className="pw-field-toggle"
        onClick={() => setShow((v) => !v)}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
      >
        <Icon name={show ? "eyeOff" : "eye"} size={18} />
      </button>
    </div>
  );
}
