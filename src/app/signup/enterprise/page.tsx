import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { EnterpriseSignupForm } from "./EnterpriseSignupForm";

export const metadata = { title: "Create an enterprise workspace · Numik HealthspanOS" };

export default function EnterpriseSignupPage() {
  return (
    <AuthShell
      title="Create an enterprise workspace"
      blurb="Set up your organisation, then invite members by email."
      footer={<>Signing up for yourself? <Link href="/signup" className="text-accent">Create a personal account</Link></>}
    >
      <EnterpriseSignupForm />
    </AuthShell>
  );
}
