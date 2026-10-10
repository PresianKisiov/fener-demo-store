"use client";
import { useFormStatus } from "react-dom";

/** A submit button that disables itself while the Server Action runs, so a double click does not send twice. */
export function SubmitButton({
  children,
  pendingText,
  className = "btn-primary",
  name,
  value,
  pending: pendingProp,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
  /** For forms sent from code (startTransition), where useFormStatus does not see the request. */
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending} name={name} value={value}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
