import { notFound } from "next/navigation";
import { listLiveEvents } from "@/lib/liveEvents";
import { getOrderByEditToken } from "@/lib/orders";
import { OrderForm } from "@/app/order-form";

export default async function EditOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
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
      <OrderForm error={query.error} liveEvents={liveEvents} order={order} updated={query.updated === "1"} />
    </main>
  );
}
