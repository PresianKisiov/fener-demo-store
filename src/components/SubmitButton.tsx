"use client";
import { useFormStatus } from "react-dom";

/** A submit button that disables itself while the Server Action runs, so a double click does not send twice. */
export function SubmitButton({
  children,
  pendingText,
  className = "btn-primary",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending} name={name} value={value}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
