import { addLiveEventComment, addOrderComment, moveLiveOrder, removeLiveEventComment, removeOrderComment } from "@/app/actions";
import { listLiveEventComments, listOrderComments } from "@/lib/comments";
import { formatDateTime, statusLabels } from "@/lib/format";
import { listLiveEvents } from "@/lib/liveEvents";
import { listOrdersByLiveEvent } from "@/lib/orders";
import { requireAdminSession } from "@/lib/auth";
import type { AdminComment } from "@/types/order";
import { logout } from "../login/actions";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";

export const dynamic = "force-dynamic";

export default async function LiveOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ live_event_id?: string }>;
}) {
  await requireAdminSession();
  const [params, liveEvents] = await Promise.all([searchParams, listLiveEvents()]);
  const selectedLiveEvent = liveEvents.find((event) => event.id === params.live_event_id) || liveEvents[0];
  const orders = selectedLiveEvent ? await listOrdersByLiveEvent(selectedLiveEvent.id) : [];
  const liveEventComments = selectedLiveEvent ? await listLiveEventComments(selectedLiveEvent.id) : [];
  const liveOrdersPath = selectedLiveEvent ? `/admin/live-orders?live_event_id=${encodeURIComponent(selectedLiveEvent.id)}` : "/admin/live-orders";
  const orderComments = new Map(
    await Promise.all(orders.map(async (order) => [order.id, await listOrderComments(order.id)] as const)),
  );
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

        {selectedLiveEvent ? (
          <section className="section">
            <div className="section-title">
              <div>
                <h2>ライブコメント</h2>
                <p>このライブ全体に関する管理者向けメモを残せます。</p>
              </div>
            </div>
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
            <CommentList
              comments={liveEventComments}
              deleteAction={removeLiveEventComment}
              emptyText="ライブコメントはまだありません。"
              returnPath={liveOrdersPath}
            />
          </section>
        ) : null}

        <section className="section">
          {orders.length === 0 ? (
            <p className="empty">このライブの提出はまだありません。</p>
          ) : (
            <div className="live-order-list">
              {orders.map((order, index) => (
                <article className="live-order-card" key={order.id}>
                  {(() => {
                    const comments = orderComments.get(order.id) || [];

                    return (
                      <>
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

                    <details className="band-comments">
                      <summary>バンドコメント {comments.length > 0 ? `(${comments.length})` : ""}</summary>
                      <form className="comment-form compact-comment-form" action={addOrderComment}>
                        <input name="order_id" type="hidden" value={order.id} />
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
                      <CommentList
                        comments={comments}
                        deleteAction={removeOrderComment}
                        emptyText="バンドコメントはまだありません。"
                        returnPath={liveOrdersPath}
                      />
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
                      </>
                    );
                  })()}
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function CommentList({
  comments,
  deleteAction,
  emptyText,
  returnPath,
}: {
  comments: AdminComment[];
  deleteAction: (formData: FormData) => void | Promise<void>;
  emptyText: string;
  returnPath: string;
}) {
  if (comments.length === 0) {
    return <p className="empty comment-empty">{emptyText}</p>;
  }

  return (
    <div className="comment-list">
      {comments.map((comment) => (
        <article className="comment-item" key={comment.id}>
          <div className="comment-meta">
            <span>
              <strong>{comment.authorName}</strong>
              <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
            </span>
            <form action={deleteAction}>
              <input name="comment_id" type="hidden" value={comment.id} />
              <input name="return_path" type="hidden" value={returnPath} />
              <ConfirmSubmitButton title="コメントを削除しますか？" description="このコメントを削除します。操作は取り消せません。" />
            </form>
          </div>
          <p className="preline">{comment.body}</p>
        </article>
      ))}
    </div>
  );
}
