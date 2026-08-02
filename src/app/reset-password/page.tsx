import { AuthShell } from "@/components/auth/AuthShell";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Set a new password · Numik HealthspanOS" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Set a new password">
      <ResetForm token={token ?? null} />
    </AuthShell>
  );
}
