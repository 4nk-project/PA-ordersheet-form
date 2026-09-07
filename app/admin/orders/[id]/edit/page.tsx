import { notFound } from "next/navigation";
import { OrderForm } from "@/app/order-form";
import { logout } from "@/app/admin/login/actions";
import { listLiveEvents } from "@/lib/liveEvents";
import { getOrder } from "@/lib/orders";
import { requireAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminEditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
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
          <a className="button secondary" href="/">
            提出フォーム
          </a>
          <a className="button secondary" href="/admin">
            提出一覧
          </a>
          <a className="button secondary" href="/admin/live-orders">
            演奏順管理
          </a>
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
      <OrderForm liveEvents={liveEvents} mode="admin" order={order} />
    </main>
  );
}
