import { notFound } from "next/navigation";
import { getEntry } from "@/lib/entries";
import { getLiveEvent, submissionWindow } from "@/lib/liveEvents";
import { getOrderByEditToken } from "@/lib/orders";
import { OrderForm } from "@/app/order-form";
import { OrderReadOnly } from "@/app/order-read-only";

export const dynamic = "force-dynamic";

/** 旧来の編集URL。互換性のため残すが、締切・受付停止・取消は招待経由と同じく適用する */
export default async function EditOrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ updated?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  const order = await getOrderByEditToken(token);
  if (!order) notFound();
  const [liveEvent, entry] = await Promise.all([getLiveEvent(order.liveEventId), order.entryId ? getEntry(order.entryId) : null]);
  const window = liveEvent ? submissionWindow(liveEvent) : { open: false as const, message: "ライブが見つかりません。運営に連絡してください。" };
  const closedMessage = entry?.cancelledAt ? "この出演は取り消されています。運営に連絡してください。" : !window.open ? window.message : null;

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>PAオーダーシート</strong>
          <span>確認・編集</span>
        </div>
      </header>
      {closedMessage ? (
        <OrderReadOnly order={order} liveEventName={liveEvent?.name || order.liveEventName} message={closedMessage} />
      ) : (
        <OrderForm mode="submitter" liveEvent={liveEvent} order={order} entry={entry ? { id: entry.id, bandName: entry.bandName } : null} saved={query.updated === "1" ? "updated" : null} />
      )}
    </main>
  );
}
