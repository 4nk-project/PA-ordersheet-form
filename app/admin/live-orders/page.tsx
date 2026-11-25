import { addLiveEventComment, moveLiveOrder, removeLiveEventComment } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { requireAdminSession } from "@/lib/auth";
import { listLiveEventComments } from "@/lib/comments";
import { listAdminEntries } from "@/lib/entries";
import { listLiveEvents } from "@/lib/liveEvents";
import { listOrdersByLiveEvent } from "@/lib/orders";
import { formatDuration, formatDurationJa, totalDurationSeconds } from "@/lib/orderSchema";
import { submissionStateLabels, submissionStateOf, submissionStateTone } from "@/lib/orderStatus";
import { formatInTimeZone } from "@/lib/time";
import { AdminHeader } from "../admin-header";

export const dynamic = "force-dynamic";

/** 初期出演順の管理。並べ替えは提出内容の版を変えない。NodeCGの当日用タイムテーブル作成後は自動反映しない */
export default async function LiveOrdersPage({ searchParams }: { searchParams: Promise<{ live_event_id?: string }> }) {
  await requireAdminSession();
  const [params, liveEvents] = await Promise.all([searchParams, listLiveEvents()]);
  const selectedLiveEvent = liveEvents.find((event) => event.id === params.live_event_id) || liveEvents[liveEvents.length - 1];
  const [rows, orders, liveEventComments] = selectedLiveEvent
    ? await Promise.all([listAdminEntries(selectedLiveEvent.id), listOrdersByLiveEvent(selectedLiveEvent.id), listLiveEventComments(selectedLiveEvent.id)])
    : [[], [], []];
  const ordersByEntry = new Map(orders.filter((order) => order.entryId).map((order) => [order.entryId as string, order]));
  const activeRows = rows.filter((row) => !row.entry.cancelledAt);
  const liveOrdersPath = selectedLiveEvent ? `/admin/live-orders?live_event_id=${encodeURIComponent(selectedLiveEvent.id)}` : "/admin/live-orders";
  const totalSongs = orders.reduce((sum, order) => sum + order.songs.length, 0);

  return (
    <main className="shell">
      <AdminHeader title="演奏順管理" />
      <section className="container">
        <div className="hero">
          <h1>ライブ別 初期出演順</h1>
          <p>出演エントリー（未提出を含む）の初期出演順を並べ替えます。NodeCGで当日用タイムテーブルを作成した後は、ここでの変更はNodeCGへ自動では反映されません。</p>
        </div>

        <div className="meta-grid">
          <div className="meta-item">
            <span>ライブ</span>
            <strong>{selectedLiveEvent?.name || "-"}</strong>
          </div>
          <div className="meta-item">
            <span>出演数</span>
            <strong>{activeRows.length}組</strong>
          </div>
          <div className="meta-item">
            <span>提出済み曲数</span>
            <strong>{totalSongs}曲</strong>
          </div>
          <div className="meta-item">
            <span>音源使用あり</span>
            <strong>{orders.filter((order) => order.usesBackingTrack).length}組</strong>
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

        {selectedLiveEvent ? (
          <section className="section">
            <details>
              <summary>ライブコメント（{liveEventComments.length}件）</summary>
              <form className="comment-form" action={addLiveEventComment}>
                <input name="live_event_id" type="hidden" value={selectedLiveEvent.id} />
                <label className="field">
                  <span>名前</span>
                  <input className="input" maxLength={80} name="author_name" required />
                </label>
                <label className="field">
                  <span>本文</span>
                  <textarea className="textarea" maxLength={2000} name="body" required />
                </label>
                <button className="button" type="submit">
                  投稿
                </button>
              </form>
              <div className="comment-list">
                {liveEventComments.map((comment) => (
                  <article className="comment-item" key={comment.id}>
                    <div className="comment-meta">
                      <span>
                        <strong>{comment.authorName}</strong>
                        <time dateTime={comment.createdAt}>{formatInTimeZone(comment.createdAt)}</time>
                      </span>
                      <form action={removeLiveEventComment}>
                        <input name="comment_id" type="hidden" value={comment.id} />
                        <input name="return_path" type="hidden" value={liveOrdersPath} />
                        <ConfirmSubmitButton title="コメントを削除しますか？" description="このコメントを削除します。操作は取り消せません。" />
                      </form>
                    </div>
                    <p className="preline">{comment.body}</p>
                  </article>
                ))}
              </div>
            </details>
          </section>
        ) : null}

        <section className="section">
          {rows.length === 0 ? (
            <p className="empty">このライブの出演エントリーはまだありません。</p>
          ) : (
            <ol className="live-order-list">
              {rows.map((row, index) => {
                const order = ordersByEntry.get(row.entry.id);
                const state = submissionStateOf(row.order);
                return (
                  <li className={`live-order-card${row.entry.cancelledAt ? " cancelled" : ""}`} key={row.entry.id}>
                    <div className="live-order-rank">
                      <span>出演順</span>
                      <strong>{row.entry.initialPerformanceOrder ?? "-"}</strong>
                    </div>
                    <div className="live-order-main">
                      <div className="live-order-head">
                        <div>
                          <h2>{row.entry.bandName}</h2>
                          <p>{order ? `代表者: ${order.contactName} ・ ${order.songs.length}曲（楽曲の合計 ${formatDuration(totalDurationSeconds(order.songs))}）` : "未提出"}</p>
                        </div>
                        <div className="live-order-badges">
                          <span className={`badge ${submissionStateTone(state)}`}>{submissionStateLabels[state]}</span>
                          {row.entry.cancelledAt ? <span className="badge">取消</span> : null}
                          {order?.usesBackingTrack ? <span className="badge warn">音源あり</span> : null}
                        </div>
                      </div>
                      {order ? (
                        <details className="live-order-songs">
                          <summary>セットリスト</summary>
                          <ol>
                            {order.songs.map((song) => (
                              <li key={song.id}>
                                <strong>{song.title || "曲名未入力"}</strong>
                                <span>{formatDurationJa(song.durationSeconds) || "要確認"}</span>
                                {song.mc.hasMc ? <span>MCあり{song.mc.person ? `（${song.mc.person}）` : ""}</span> : null}
                              </li>
                            ))}
                          </ol>
                        </details>
                      ) : null}
                      <a href={`/admin/entries/${encodeURIComponent(row.entry.id)}?back=${encodeURIComponent(liveOrdersPath)}`}>詳細</a>
                    </div>
                    <div className="live-order-controls">
                      {(["up", "down"] as const).map((direction) => (
                        <form action={moveLiveOrder} key={direction}>
                          <input name="live_event_id" type="hidden" value={selectedLiveEvent?.id || ""} />
                          <input name="entry_id" type="hidden" value={row.entry.id} />
                          <input name="direction" type="hidden" value={direction} />
                          <button
                            className="button secondary icon-button"
                            disabled={direction === "up" ? index === 0 : index === rows.length - 1}
                            type="submit"
                            aria-label={`${row.entry.bandName}を${direction === "up" ? "上" : "下"}へ移動`}
                          >
                            {direction === "up" ? "↑" : "↓"}
                          </button>
                        </form>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </section>
    </main>
  );
}
