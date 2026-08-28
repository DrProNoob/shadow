import { ReceiptsWorkspace } from "@/components/receipts/receipts-workspace";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ receiptId: string }>;
}) {
  const { receiptId } = await params;
  return <ReceiptsWorkspace receiptId={receiptId} />;
}
