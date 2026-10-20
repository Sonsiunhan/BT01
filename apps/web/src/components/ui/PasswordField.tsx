import { useId, useState, type InputHTMLAttributes } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  hint?: string;
  error?: string;
  errorId?: string;
};

export function PasswordField({ label, hint, error, errorId, id, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = `${inputId}-hint`;
  const resolvedErrorId = errorId ?? `${inputId}-error`;
  const [visible, setVisible] = useState(false);

  const describedByParts = [
    props["aria-describedby"],
    hint ? hintId : undefined,
    error ? resolvedErrorId : undefined,
  ].filter(Boolean);
  const describedBy = describedByParts.length > 0 ? describedByParts.join(" ") : undefined;

  return (
    <label className="password-field" htmlFor={inputId}>
      <span>{label}</span>
      <span className="password-control">
        <input
          {...props}
          id={inputId}
          type={visible ? "text" : "password"}
          aria-describedby={describedBy}
          aria-invalid={props["aria-invalid"] ?? Boolean(error)}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? `Ẩn ${label.toLowerCase()}` : `Hiện ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? "Ẩn" : "Hiện"}
        </button>
      </span>
      {hint && <small id={hintId} className="field-hint">{hint}</small>}
      {error && <small id={resolvedErrorId} className="field-error">{error}</small>}
    </label>
  );
}
