import { moveLiveOrder } from "@/app/actions";
import { formatDateTime, statusLabels } from "@/lib/format";
import { listLiveEvents } from "@/lib/liveEvents";
import { listOrdersByLiveEvent } from "@/lib/orders";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function LiveOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ live_event_id?: string }>;
}) {
  const [params, liveEvents] = await Promise.all([searchParams, listLiveEvents()]);
  const selectedLiveEvent = liveEvents.find((event) => event.id === params.live_event_id) || liveEvents[0];
  const orders = selectedLiveEvent ? await listOrdersByLiveEvent(selectedLiveEvent.id) : [];
  const totalSongs = orders.reduce((sum, order) => sum + order.songs.length, 0);
  const backingTrackCount = orders.filter((order) => order.usesBackingTrack).length;

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/admin">
          <strong>PAオーダーシート</strong>
          <span>演奏順管理</span>
        </a>
        <div className="actions">
          <a className="button secondary" href="/admin">
            提出一覧
          </a>
          <form action={logout}>
            <button className="button secondary" type="submit">
              ログアウト
            </button>
          </form>
        </div>
      </header>

      <section className="container">
        <div className="hero">
          <h1>ライブ別 演奏順</h1>
          <p>ライブごとに提出をまとめ、実際の演奏順に並べ替えできます。</p>
        </div>

        <div className="meta-grid">
          <div className="meta-item">
            <span>ライブ</span>
            <strong>{selectedLiveEvent?.name || "-"}</strong>
          </div>
          <div className="meta-item">
            <span>出演数</span>
            <strong>{orders.length}組</strong>
          </div>
          <div className="meta-item">
            <span>合計曲数</span>
            <strong>{totalSongs}曲</strong>
          </div>
          <div className="meta-item">
            <span>音源使用あり</span>
            <strong>{backingTrackCount}組</strong>
          </div>
        </div>

        <section className="section">
          <form className="live-order-selector" action="/admin/live-orders">
            <label className="field">
              <span>ライブ</span>
              <select className="select" defaultValue={selectedLiveEvent?.id || ""} name="live_event_id">
                {liveEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="button" type="submit">
              表示
            </button>
          </form>
        </section>

        <section className="section">
          {orders.length === 0 ? (
            <p className="empty">このライブの提出はまだありません。</p>
          ) : (
            <div className="live-order-list">
              {orders.map((order, index) => (
                <article className="live-order-card" key={order.id}>
                  <div className="live-order-rank">
                    <span>出演順</span>
                    <strong>{index + 1}</strong>
                  </div>

                  <div className="live-order-main">
                    <div className="live-order-head">
                      <div>
                        <h2>{order.bandName}</h2>
                        <p>
                          代表者: {order.contactName} / 提出: {formatDateTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="live-order-badges">
                        <span className={`badge ${order.status === "new" ? "warn" : order.status === "done" ? "done" : ""}`}>
                          {statusLabels[order.status]}
                        </span>
                        {order.usesBackingTrack ? <span className="badge warn">音源あり</span> : null}
                      </div>
                    </div>

                    <div className="live-order-summary">
                      <span>{order.songs.length}曲</span>
                      <span>マイク {order.microphoneCount || 0}本</span>
                      <a href={`/admin/orders/${order.id}`}>詳細</a>
                    </div>

                    <details className="live-order-songs">
                      <summary>セットリスト</summary>
                      <ol>
                        {order.songs.map((song) => (
                          <li key={song.id}>
                            <strong>{song.title || "曲名未入力"}</strong>
                            <span>{song.duration || "-"}</span>
                            {song.mc.hasMc ? <span>MCあり{song.mc.person ? ` (${song.mc.person})` : ""}</span> : null}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </div>

                  <div className="live-order-controls">
                    <form action={moveLiveOrder}>
                      <input name="live_event_id" type="hidden" value={selectedLiveEvent?.id || ""} />
                      <input name="order_id" type="hidden" value={order.id} />
                      <input name="direction" type="hidden" value="up" />
                      <button className="button secondary icon-button" disabled={index === 0} type="submit" title="上へ">
                        ↑
                      </button>
                    </form>
                    <form action={moveLiveOrder}>
                      <input name="live_event_id" type="hidden" value={selectedLiveEvent?.id || ""} />
                      <input name="order_id" type="hidden" value={order.id} />
                      <input name="direction" type="hidden" value="down" />
                      <button className="button secondary icon-button" disabled={index === orders.length - 1} type="submit" title="下へ">
                        ↓
                      </button>
                    </form>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
