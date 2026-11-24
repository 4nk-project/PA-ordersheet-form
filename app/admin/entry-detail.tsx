import { addOrderComment, removeOrder, removeOrderComment } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { diffOrderContent } from "@/contracts/v1/diff";
import { listOrderComments } from "@/lib/comments";
import { getAdminEntry } from "@/lib/entries";
import { getOrderByEntryId, getOrderRevision, listOrderRevisions, orderContentOf } from "@/lib/orders";
import { importStateOf, inviteStateOf, submissionStateLabels, submissionStateOf, submissionStateTone } from "@/lib/orderStatus";
import { formatInTimeZone } from "@/lib/time";
import { DiffView } from "./diff-view";
import { EntrySettingsForm, InvitePanel, ReviewForm, StatusButtons } from "./entry-controls";
import { OrderContentView } from "./order-content-view";

const actorLabels = { submitter: "演者", admin: "運営", migration: "移行時点" } as const;

/** 出演エントリーの詳細。PCでは一覧の右側、スマートフォンでは単独ページで表示する */
export async function EntryDetail({ entryId, returnPath }: { entryId: string; returnPath: string }) {
  const row = await getAdminEntry(entryId);
  if (!row) return <p className="empty">出演エントリーが見つかりません。</p>;
  const order = await getOrderByEntryId(entryId);
  const state = submissionStateOf(order);
  const [revisions, comments, reviewedRevision] = await Promise.all([
    order ? listOrderRevisions(order.id) : [],
    order ? listOrderComments(order.id) : [],
    order?.reviewedRevision && order.reviewedRevision !== order.contentRevision ? getOrderRevision(order.id, order.reviewedRevision) : null,
  ]);
  const diff = order && reviewedRevision ? diffOrderContent(reviewedRevision.content, orderContentOf(order)) : null;
  const importState = importStateOf(row.importReceipts, order?.reviewedRevision ?? null);
  const inviteState = inviteStateOf(row.invite);
  const detailPath = `/admin/entries/${encodeURIComponent(entryId)}`;

  return (
    <article className="entry-detail" aria-labelledby={`entry-${entryId}-title`}>
      <header className="entry-detail-head">
        <div>
          <h2 id={`entry-${entryId}-title`}>{row.entry.bandName}</h2>
          <p>
            初期出演順 {row.entry.initialPerformanceOrder ?? "未設定"}
            {row.entry.cancelledAt ? " ・ 取消済み" : ""}
          </p>
        </div>
        <dl className="status-chips">
          <div>
            <dt>確認状態</dt>
            <dd className={`badge ${submissionStateTone(state)}`}>{submissionStateLabels[state]}</dd>
          </div>
          <div>
            <dt>提出内容の版</dt>
            <dd>{order ? `版${order.contentRevision}（確認済み：${order.reviewedRevision ? `版${order.reviewedRevision}` : "なし"}）` : "提出なし"}</dd>
          </div>
          <div>
            <dt>NodeCG取り込み</dt>
            <dd>
              {importState.label}
              {importState.kind !== "unknown" ? `（${importState.receipt.runtimeId}・通知 ${formatInTimeZone(importState.receipt.receivedAt)}）` : ""}
            </dd>
          </div>
          <div>
            <dt>招待</dt>
            <dd>{inviteState.label}</dd>
          </div>
        </dl>
      </header>

      {order ? (
        <section className="section review-section">
          <div className="section-title">
            <div>
              <h3>確認</h3>
              <p>
                演者の最終更新 {formatInTimeZone(order.submitterUpdatedAt)}
                {order.adminUpdatedAt ? ` ・ 運営による編集 ${formatInTimeZone(order.adminUpdatedAt)}` : ""}
              </p>
            </div>
          </div>
          {diff ? (
            <>
              <p className="notice-inline">確認済みの版{order.reviewedRevision}の後に更新がありました。差分を確認してから確認済みにしてください。</p>
              <DiffView diff={diff} beforeLabel={`確認済み 版${order.reviewedRevision}`} afterLabel={`現在 版${order.contentRevision}`} />
            </>
          ) : order.reviewedRevision === null ? (
            <p className="field-description">まだ確認した版はありません。下の提出内容を確認してください。</p>
          ) : null}
          <div className="actions">
            <ReviewForm orderId={order.id} revision={order.contentRevision} returnPath={returnPath} alreadyReviewed={order.reviewedRevision === order.contentRevision} />
            {order.reviewedRevision === null ? <StatusButtons orderId={order.id} status={order.status} returnPath={returnPath} /> : null}
          </div>
        </section>
      ) : (
        <p className="empty">まだ提出がありません。招待URLを発行して代表者に渡してください。</p>
      )}

      <section className="section">
        <div className="section-title">
          <h3>招待URL</h3>
        </div>
        <InvitePanel
          entryId={entryId}
          cancelled={Boolean(row.entry.cancelledAt)}
          invite={row.invite ? { id: row.invite.id, expiresAt: row.invite.expiresAt, revokedAt: row.invite.revokedAt, label: inviteState.label, active: inviteState.kind === "active" } : null}
        />
      </section>

      {order ? (
        <section className="section">
          <div className="section-title">
            <div>
              <h3>提出内容（版{order.contentRevision}）</h3>
            </div>
            <a className="button secondary" href={`/admin/orders/${encodeURIComponent(order.id)}/edit`}>
              提出内容を編集
            </a>
          </div>
          <OrderContentView order={order} />
        </section>
      ) : null}

      {revisions.length ? (
        <section className="section">
          <details>
            <summary>版の履歴（{revisions.length}件）</summary>
            <ol className="revision-list">
              {revisions.map((revision) => (
                <li key={revision.revision}>
                  版{revision.revision} ・ {actorLabels[revision.actor]} ・ {formatInTimeZone(revision.createdAt)}
                  {order?.reviewedRevision === revision.revision ? " ・ 確認済み" : ""}
                </li>
              ))}
            </ol>
          </details>
        </section>
      ) : null}

      <section className="section">
        <details>
          <summary>出演設定（バンド名・初期出演順・取消）</summary>
          <EntrySettingsForm entryId={entryId} revision={row.entry.revision} bandName={row.entry.bandName} initialOrder={row.entry.initialPerformanceOrder} cancelled={Boolean(row.entry.cancelledAt)} />
        </details>
      </section>

      {order ? (
        <section className="section">
          <div className="section-title">
            <div>
              <h3>管理者コメント</h3>
              <p>内部メモです。演者・NodeCGには送られません。</p>
            </div>
          </div>
          <form className="comment-form" action={addOrderComment}>
            <input name="order_id" type="hidden" value={order.id} />
            <input name="return_path" type="hidden" value={returnPath} />
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
          {comments.length === 0 ? (
            <p className="empty comment-empty">コメントはまだありません。</p>
          ) : (
            <div className="comment-list">
              {comments.map((comment) => (
                <article className="comment-item" key={comment.id}>
                  <div className="comment-meta">
                    <span>
                      <strong>{comment.authorName}</strong>
                      <time dateTime={comment.createdAt}>{formatInTimeZone(comment.createdAt)}</time>
                    </span>
                    <form action={removeOrderComment}>
                      <input name="comment_id" type="hidden" value={comment.id} />
                      <input name="return_path" type="hidden" value={returnPath} />
                      <ConfirmSubmitButton title="コメントを削除しますか？" description="このコメントを削除します。操作は取り消せません。" />
                    </form>
                  </div>
                  <p className="preline">{comment.body}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {order ? (
        <section className="section">
          <div className="danger-zone">
            <div>
              <h3>提出内容の削除</h3>
              <p>提出と版の履歴を削除し、このエントリーを未提出に戻します。出演エントリーと招待は残ります。</p>
            </div>
            <form action={removeOrder}>
              <input name="id" type="hidden" value={order.id} />
              <input name="return_path" type="hidden" value={detailPath} />
              <ConfirmSubmitButton label="提出を削除" title="提出内容を削除しますか？" description={`「${row.entry.bandName}」の提出内容と履歴を削除します。この操作は取り消せません。`} />
            </form>
          </div>
        </section>
      ) : null}
    </article>
  );
}
