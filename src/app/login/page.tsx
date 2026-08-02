import Link from "next/link";
import { getDictionary } from "@/lib/i18n";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · Numik HealthspanOS" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const t = getDictionary("en");
  const { next } = await searchParams;

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-6 py-12 text-fg numik-accent-grad">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded bg-accent text-base font-bold text-white">N</span>
          <span className="text-lg font-semibold">{t.brand}</span>
        </Link>

        <div className="rounded-lg border border-border bg-surface-2 p-6 shadow-card">
          <h1 className="text-xl font-semibold">{t.auth.signInTitle}</h1>
          <LoginForm next={next} dict={{ email: t.auth.email, password: t.auth.password, submit: t.auth.submit }} />
        </div>

        {/* Demo credentials — synthetic tenants only */}
        <div className="mt-6 rounded-lg border border-border bg-surface-2 p-4 text-sm">
          <p className="mb-2 font-medium text-fg-muted">Demo logins · password <code className="text-fg">Demo123!</code></p>
          <ul className="space-y-1 text-fg-muted">
            <li><span className="text-fg">member@acme.demo</span> — Member portal</li>
            <li><span className="text-fg">employer@acme.demo</span> — Enterprise portal</li>
            <li><span className="text-fg">reviewer@numik.demo</span> — Scientific &amp; clinical review</li>
            <li><span className="text-fg">admin@numik.demo</span> — Platform administration</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
