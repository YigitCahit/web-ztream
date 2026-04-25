import OverlayClient from "@/components/OverlayClient";

type OverlayPageProps = {
  params: Promise<{
    overlayKey: string;
  }>;
  searchParams: Promise<{
    u?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function OverlayPage({
  params,
  searchParams,
}: OverlayPageProps) {
  const { overlayKey } = await params;
  const query = await searchParams;

  const parsedUserId = Number(query.u);
  const userIdHint =
    Number.isFinite(parsedUserId) && parsedUserId > 0
      ? Math.trunc(parsedUserId)
      : null;

  return <OverlayClient overlayKey={overlayKey} userIdHint={userIdHint} />;
}
