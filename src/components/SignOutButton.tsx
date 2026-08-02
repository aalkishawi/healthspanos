"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="text-sm text-fg-muted transition-colors hover:text-fg"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      {busy ? "…" : label}
    </button>
  );
}
