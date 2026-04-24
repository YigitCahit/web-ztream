import OverlayClient from "@/components/OverlayClient";

type OverlayPageProps = {
  params: Promise<{
    overlayKey: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function OverlayPage({
  params,
}: OverlayPageProps) {
  const { overlayKey } = await params;

  return <OverlayClient overlayKey={overlayKey} />;
}
