import { requireAdminSession } from "@/lib/auth";
import { listLiveEvents } from "@/lib/liveEvents";
import { listOrderSummaries } from "@/lib/orders";
import { logout } from "./login/actions";
import { AdminOrderList } from "./admin-order-list";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireAdminSession();
  const liveEvents = await listLiveEvents();
  const orders = await listOrderSummaries();
  const newCount = orders.filter((order) => order.status === "new").length;
  const backingTrackCount = orders.filter((order) => order.usesBackingTrack).length;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/admin">
          <strong>PAオーダーシート</strong>
          <span>管理画面</span>
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
          <a className="button secondary" href="/admin/settings/live-events">ライブ設定</a>
          <form action={logout}>
            <button className="button secondary" type="submit">
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <section className="container">
        <div className="hero">
          <h1>提出一覧</h1>
          <p>バンドごとに提出状況、曲数、音源使用の有無を確認できます。</p>
          <div className="actions">
            <a className="button" href="/admin/live-orders">
              演奏順を管理
            </a>
          </div>
        </div>

        <div className="meta-grid">
          <div className="meta-item">
            <span>提出数</span>
            <strong>{orders.length}件</strong>
          </div>
          <div className="meta-item">
            <span>未確認</span>
            <strong>{newCount}件</strong>
          </div>
          <div className="meta-item">
            <span>音源使用あり</span>
            <strong>{backingTrackCount}件</strong>
          </div>
          <div className="meta-item">
            <span>CSV</span>
            <a href="/admin/export.csv">ダウンロード</a>
          </div>
        </div>

        <section className="section">
          <div className="section-title"><div><h2>ライブ別の確認状況</h2><p>提出数と確認完了数をライブごとに確認できます。</p></div></div>
          <div className="event-progress-list">
            {liveEvents.map((event) => {
              const eventOrders = orders.filter((order) => order.liveEventId === event.id);
              const done = eventOrders.filter((order) => order.status === "done").length;
              const percent = eventOrders.length ? Math.round((done / eventOrders.length) * 100) : 0;
              return <div className="event-progress" key={event.id}><div><strong>{event.name}</strong><span>{done} / {eventOrders.length}件 確認完了</span></div><div className="event-progress-track" aria-label={`${event.name} ${percent}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div></div>;
            })}
          </div>
        </section>

        <AdminOrderList liveEvents={liveEvents} orders={orders} />
      </section>
    </main>
  );
}
