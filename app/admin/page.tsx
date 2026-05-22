import { addLiveEvent, changeLiveEventSongCount, removeLiveEvent } from "@/app/actions";
import { listLiveEvents } from "@/lib/liveEvents";
import { listOrderSummaries } from "@/lib/orders";
import { formatDateTime, statusLabels } from "@/lib/format";
import { logout } from "./login/actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
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
          <div className="section-title">
            <div>
              <h2>ライブ内容</h2>
              <p>回答フォームに表示するライブ選択肢を管理できます。</p>
            </div>
          </div>
          <div className="admin-live-grid">
            <form className="panel live-event-form" action={addLiveEvent}>
              <label className="field">
                <span>追加するライブ名</span>
                <input className="input" name="name" placeholder="例: 2026 春ライブ" required />
              </label>
              <label className="field">
                <span>曲数</span>
                <input className="input" defaultValue={8} min="1" name="song_count" required type="number" />
              </label>
              <button className="button" type="submit">
                追加
              </button>
            </form>
            <div className="table-wrap">
              <table className="table compact-table">
                <thead>
                  <tr>
                    <th>ライブ名</th>
                    <th>曲数</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {liveEvents.map((event) => (
                    <tr key={event.id}>
                      <td>{event.name}</td>
                      <td>
                        <form className="inline-form" action={changeLiveEventSongCount}>
                          <input name="id" type="hidden" value={event.id} />
                          <input className="input compact-input" defaultValue={event.songCount} min="1" name="song_count" type="number" />
                          <button className="button secondary" type="submit">
                            更新
                          </button>
                        </form>
                      </td>
                      <td>
                        <form action={removeLiveEvent}>
                          <input name="id" type="hidden" value={event.id} />
                          <button className="button danger" disabled={liveEvents.length <= 1} type="submit">
                            削除
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="section">
          {orders.length === 0 ? (
            <p className="empty">まだ提出はありません。</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ライブ</th>
                    <th>バンド名</th>
                    <th>代表者</th>
                    <th>曲数</th>
                    <th>音源</th>
                    <th>ステータス</th>
                    <th>提出日時</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.liveEventName || "-"}</td>
                      <td>
                        <strong>{order.bandName}</strong>
                      </td>
                      <td>{order.contactName}</td>
                      <td>{order.songCount} / {order.liveEventSongCount || order.songCount}曲</td>
                      <td>{order.usesBackingTrack ? "あり" : "なし"}</td>
                      <td>
                        <span className={`badge ${order.status === "new" ? "warn" : order.status === "done" ? "done" : ""}`}>
                          {statusLabels[order.status]}
                        </span>
                      </td>
                      <td>{formatDateTime(order.createdAt)}</td>
                      <td>
                        <a className="button secondary" href={`/admin/orders/${order.id}`}>
                          詳細
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
