"use client";
import { useActionState } from "react";
import { loginAction, type LoginState } from "@/app/actions/admin";
import { SubmitButton } from "./SubmitButton";

export function LoginForm() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="email" className="adm-label">Имейл</label>
        <input id="email" name="email" type="email" autoComplete="username" className="adm-input" defaultValue={state.email} />
      </div>
      <div>
        <label htmlFor="password" className="adm-label">Парола</label>
        <input id="password" name="password" type="password" autoComplete="current-password" className="adm-input" />
      </div>
      {state.error && <p role="alert" className="text-sm font-semibold text-adm-down">{state.error}</p>}
      <SubmitButton className="adm-btn w-full" pendingText="Влизаме...">Влез</SubmitButton>
    </form>
  );
}
