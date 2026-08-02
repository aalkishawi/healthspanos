import { AuthShell } from "@/components/auth/AuthShell";
import { VerifyClient } from "./VerifyClient";

export const metadata = { title: "Confirm your email · Numik HealthspanOS" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Confirm your email">
      <VerifyClient token={token ?? null} />
    </AuthShell>
  );
}
