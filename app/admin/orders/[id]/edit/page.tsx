import { notFound } from "next/navigation";
import { OrderForm } from "@/app/order-form";
import { logout } from "@/app/admin/login/actions";
import { listLiveEvents } from "@/lib/liveEvents";
import { getOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

export default async function AdminEditOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [order, liveEvents] = await Promise.all([getOrder(id), listLiveEvents()]);

  if (!order) {
    notFound();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/admin">
          <strong>PAオーダーシート</strong>
          <span>管理者編集</span>
        </a>
        <div className="actions">
          <a className="button secondary" href={`/admin/orders/${order.id}`}>
            詳細へ戻る
          </a>
          <form action={logout}>
            <button className="button secondary" type="submit">
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <OrderForm error={query.error} liveEvents={liveEvents} mode="admin" order={order} />
    </main>
  );
}
