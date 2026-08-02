import { AuthShell } from "@/components/auth/AuthShell";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const metadata = { title: "Accept your invitation · Numik HealthspanOS" };

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell
      title="Accept your invitation"
      blurb="Set a password to join your organisation's workspace."
    >
      <AcceptInviteForm token={token ?? null} />
    </AuthShell>
  );
}
