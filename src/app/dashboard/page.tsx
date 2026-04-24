import { redirect } from "next/navigation";

import type { DashboardPayload } from "@/types/domain";
import DashboardClient from "@/components/DashboardClient";
import { getSessionFromServerComponent } from "@/lib/auth";
import { getUserProfileById } from "@/lib/profile";
import { getOriginFromHeaders } from "@/lib/url";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{
    warning?: string;
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const params = await searchParams;
  const session = await getSessionFromServerComponent();

  if (!session) {
    redirect("/");
  }

  const profile = await getUserProfileById(session.userId);
  if (!profile) {
    redirect("/");
  }

  const origin = await getOriginFromHeaders();
  const warningMessage =
    params.warning === "subscription"
      ? "Event aboneliği oluşturulamadı. Dashboard içinden tekrar deneyin."
      : null;

  const initialData: DashboardPayload = {
    username: profile.username,
    userId: profile.userId,
    overlayKey: profile.overlayKey,
    overlayUrl: `${origin}/overlay/${profile.overlayKey}`,
    characters: profile.characters,
    activeCharacterId: profile.activeCharacterId,
    warnings: warningMessage ? [warningMessage] : [],
  };

  return <DashboardClient initialData={initialData} />;
}
