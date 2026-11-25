import { notFound } from "next/navigation";
import { OrderForm } from "@/app/order-form";
import { requireAdminSession } from "@/lib/auth";
import { getEntry } from "@/lib/entries";
import { getLiveEvent } from "@/lib/liveEvents";
import { getOrder } from "@/lib/orders";
import { AdminHeader } from "../../../admin-header";

export const dynamic = "force-dynamic";

export default async function AdminEditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();
  const [liveEvent, entry] = await Promise.all([getLiveEvent(order.liveEventId), order.entryId ? getEntry(order.entryId) : null]);
  const back = entry ? `/admin/entries/${encodeURIComponent(entry.id)}` : `/admin/orders/${encodeURIComponent(order.id)}`;

  return (
    <main className="shell">
      <AdminHeader title="管理者編集" />
      <section className="container">
        <p>
          <a className="back-link" href={back}>
            ← 詳細へ戻る
          </a>
        </p>
        <p className="notice-inline">保存すると提出内容の新しい版（運営による編集）になり、演者の更新日時とは別に記録されます。</p>
      </section>
      <OrderForm mode="admin" liveEvent={liveEvent} order={order} entry={entry ? { id: entry.id, bandName: entry.bandName } : null} />
    </main>
  );
}
