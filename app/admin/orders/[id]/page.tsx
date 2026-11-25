import { notFound, redirect } from "next/navigation";
import { removeOrder } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { requireAdminSession } from "@/lib/auth";
import { getOrder } from "@/lib/orders";
import { formatInTimeZone } from "@/lib/time";
import { AdminHeader } from "../../admin-header";
import { OrderContentView } from "../../order-content-view";

export const dynamic = "force-dynamic";

/** 出演エントリーに紐づく提出はエントリー詳細へ。紐づかない以前の提出だけここで表示する */
export default async function OrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ updated?: string }> }) {
  await requireAdminSession();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const order = await getOrder(id);
  if (!order) notFound();
  if (order.entryId) redirect(`/admin/entries/${encodeURIComponent(order.entryId)}${query.updated === "1" ? "?updated=1" : ""}`);

  return (
    <main className="shell">
      <AdminHeader title="以前の提出" />
      <section className="container">
        {query.updated === "1" ? <div className="success">提出内容を更新しました。</div> : null}
        <div className="hero">
          <h1>{order.bandName}</h1>
          <p>
            ライブ：{order.liveEventName || "未設定"} ・ 提出 {formatInTimeZone(order.createdAt)} ・ 演者の最終更新 {formatInTimeZone(order.submitterUpdatedAt)} ・ 版{order.contentRevision}
          </p>
          <p className="notice-inline">この提出はライブの出演エントリーに紐づいていないため、確認状態・NodeCG連携の対象外です。</p>
          <div className="actions">
            <a className="button secondary" href={`/admin/orders/${order.id}/edit`}>
              提出内容を編集
            </a>
          </div>
        </div>
        <OrderContentView order={order} />
        <section className="section">
          <div className="danger-zone">
            <div>
              <h2>提出内容の削除</h2>
              <p>削除すると、この提出は管理画面から見られなくなります。</p>
            </div>
            <form action={removeOrder}>
              <input name="id" type="hidden" value={order.id} />
              <input name="return_path" type="hidden" value="/admin" />
              <ConfirmSubmitButton label="提出を削除" title="提出内容を削除しますか？" description={`「${order.bandName}」の提出内容を削除します。この操作は取り消せません。`} />
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
