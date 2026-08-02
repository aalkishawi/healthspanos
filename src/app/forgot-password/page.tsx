import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Reset your password · Numik HealthspanOS" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      blurb="We'll email you a single-use link."
      footer={<Link href="/login" className="text-accent">Back to sign in</Link>}
    >
      <ForgotForm />
    </AuthShell>
  );
}
