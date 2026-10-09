import "@fontsource/nunito-sans/cyrillic-400.css";
import "@fontsource/nunito-sans/latin-400.css";
import "@fontsource/nunito-sans/cyrillic-700.css";
import "@fontsource/nunito-sans/latin-700.css";
import "@fontsource/nunito-sans/cyrillic-800.css";
import "@fontsource/nunito-sans/latin-800.css";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { databaseUrl } from "@/db/client";
import { getCurrentAdmin } from "@/server/auth";

export const metadata: Metadata = { title: "Вход в админ панела" };

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");
  // The demo login is shown only on your own computer, never on the online site.
  const showDemoHint = !databaseUrl() && !process.env.ADMIN_PASSWORD;
  return (
    <div className="admin-root relative flex min-h-dvh items-center justify-center overflow-hidden bg-adm-blue px-4 py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-white/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-20 size-[28rem] rounded-full bg-white/10" />
      <div className="relative w-full max-w-md rounded-3xl bg-white px-7 py-10 shadow-xl sm:px-12">
        <p className="text-center font-display text-xl font-semibold"><span className="text-adm-blue">Фенер</span> admin</p>
        <h1 className="mt-6 text-center text-2xl font-extrabold">Вход в акаунта</h1>
        <p className="mt-1 text-center text-sm text-adm-muted">Въведи имейла и паролата си</p>
        <div className="mt-8">
          <LoginForm />
        </div>
        {showDemoHint && (
          <p className="mt-6 rounded-xl bg-adm-bg p-3 text-center text-sm text-adm-muted">
            Локално демо: admin@fener.test / demo1234
          </p>
        )}
      </div>
    </div>
  );
}
