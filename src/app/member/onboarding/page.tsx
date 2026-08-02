import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePortal } from "@/lib/session";
import { OnboardingWizard } from "./OnboardingWizard";

export const metadata = { title: "Set up your passport · Numik HealthspanOS" };

export default async function OnboardingPage() {
  const user = await requirePortal("member");
  const profile = await prisma.memberProfile.findFirst({
    where: { userId: user.id, tenantId: user.tenantId },
    select: { intake: true, onboardingCompletedAt: true },
  });

  // Already done — send them to the thing they came here to get.
  if (profile?.onboardingCompletedAt) redirect("/member/passport");

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Set up your Healthspan Passport</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Five short steps. Your answers build your passport — nothing here is pre-filled with
          someone else&rsquo;s data.
        </p>
      </div>
      <OnboardingWizard initial={profile?.intake ?? null} />
    </>
  );
}
