import Link from "next/link";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Create your account · Numik HealthspanOS" };

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      blurb="Build a private Healthspan Passport from your own inputs."
      footer={
        <>
          Already have an account? <Link href="/login" className="text-accent">Sign in</Link>
          <br />
          Signing up an organisation?{" "}
          <Link href="/signup/enterprise" className="text-accent">Create an enterprise workspace</Link>
        </>
      }
    >
      <SignupForm />
    </AuthShell>
  );
}
