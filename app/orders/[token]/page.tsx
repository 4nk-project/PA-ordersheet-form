import { notFound } from "next/navigation";
import { listLiveEvents } from "@/lib/liveEvents";
import { getOrderByEditToken } from "@/lib/orders";
import { OrderForm } from "@/app/order-form";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const [order, liveEvents] = await Promise.all([getOrderByEditToken(token), listLiveEvents()]);

  if (!order) {
    notFound();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>PAオーダーシート</strong>
          <span>確認・編集</span>
        </div>
      </header>
      <OrderForm liveEvents={liveEvents} mode="submitter" order={order} updated={query.updated === "1"} />
    </main>
  );
}
