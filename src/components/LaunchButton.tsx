import { buttonClasses } from "@/components/ui/Button";

/**
 * "Launch Numik HealthspanOS" — opens the live production app in a new tab.
 * Target resolves to NEXT_PUBLIC_APP_URL (the public HTTPS Vercel URL) when set,
 * else falls back to the member portal on the current origin (local dev).
 */
export function LaunchButton({ label, size = "lg" }: { label: string; size?: "md" | "lg" }) {
  const target = process.env.NEXT_PUBLIC_APP_URL || "/member";
  const external = target.startsWith("http");
  return (
    <a
      href={target}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={buttonClasses("primary", size, "shadow-pop")}
      data-testid="launch-button"
    >
      {label}
      <span aria-hidden>↗</span>
    </a>
  );
}
