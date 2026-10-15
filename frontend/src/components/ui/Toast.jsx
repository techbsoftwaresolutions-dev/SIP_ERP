import Icon from "./Icon";

const ERROR_WORDS = /fail|error|could not|couldn't|cannot|can't|unable|invalid|denied|not allowed/i;

// Bottom-right notice after an action. A success message gets a green bar and
// a tick; anything that reads like a failure is drawn in red instead.
export default function Toast({ message }) {
  const isError = ERROR_WORDS.test(message || "");
  return (
    <div className={`toast ${isError ? "error" : "success"}`} role="status" aria-live="polite">
      <Icon name={isError ? "alertCircle" : "checkCircle"} size={18} />
      <span>{message}</span>
    </div>
  );
}
