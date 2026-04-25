import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import type { DashboardPayload } from "@/types/domain";
import DashboardClient from "@/components/DashboardClient";
import { getSessionFromServerComponent, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getOrCreateUserProfile, getUserProfileById } from "@/lib/profile";
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
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionFromServerComponent();

  if (!sessionId) {
    redirect("/?auth_error=session_yok");
  }

  if (!session) {
    redirect("/?auth_error=session_kv_yok");
  }

  let profile = await getUserProfileById(session.userId);

  if (!profile) {
    try {
      profile = await getOrCreateUserProfile(
        session.userId,
        session.username,
        session.overlayKey,
      );
    } catch (error) {
      console.error("Dashboard profil self-heal hatasi:", error);
    }
  }

  if (!profile) {
    redirect("/?auth_error=profil_yok");
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
