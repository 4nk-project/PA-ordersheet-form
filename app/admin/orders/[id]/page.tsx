import { notFound } from "next/navigation";
import { changeStatus, removeOrder } from "@/app/actions";
import { formatDateTime, statusLabels } from "@/lib/format";
import { getOrder } from "@/lib/orders";
import type { OrderStatus } from "@/types/order";
import { logout } from "../../login/actions";

const statuses: OrderStatus[] = ["new", "reviewing", "done"];

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const order = await getOrder(id);

  if (!order) {
    notFound();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="/admin">
          <strong>PAオーダーシート</strong>
          <span>管理画面</span>
        </a>
        <div className="actions">
          <a className="button secondary" href="/admin">
            一覧へ戻る
          </a>
          <form action={logout}>
            <button className="button secondary" type="submit">
              ログアウト
            </button>
          </form>
        </div>
      </header>
      <section className="container">
        {query.updated === "1" ? <div className="success">提出内容を更新しました。</div> : null}
        <div className="detail-header">
          <div className="hero">
            <h1>{order.bandName}</h1>
            <p>
              提出日時: {formatDateTime(order.createdAt)} / 代表者: {order.contactName}
            </p>
            <div className="actions">
              <a className="button secondary" href={`/admin/orders/${order.id}/edit`}>
                提出内容を編集
              </a>
            </div>
          </div>
          <form className="actions status-form" action={changeStatus}>
            <input name="id" type="hidden" value={order.id} />
            <select className="select" defaultValue={order.status} name="status">
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
            <button className="button" type="submit">
              更新
            </button>
          </form>
        </div>

        <div className="meta-grid">
          <div className="meta-item">
            <span>ライブ</span>
            <strong>{order.liveEventName || "-"}</strong>
          </div>
          <div className="meta-item">
            <span>ステータス</span>
            <strong>{statusLabels[order.status]}</strong>
          </div>
          <div className="meta-item">
            <span>曲数</span>
            <strong>{order.songs.length}曲</strong>
          </div>
          <div className="meta-item">
            <span>マイク本数</span>
            <strong>{order.microphoneCount || 0}本</strong>
          </div>
          <div className="meta-item">
            <span>音源使用</span>
            <strong>{order.usesBackingTrack ? "あり" : "なし"}</strong>
          </div>
        </div>

        <section className="section">
          <div className="section-title">
            <h2>メンバー</h2>
          </div>
          {order.members.length === 0 ? (
            <p className="empty">メンバー情報は未入力です。</p>
          ) : (
            <div className="table-wrap">
              <table className="table compact-table">
                <thead>
                  <tr>
                    <th>名前</th>
                    <th>担当楽器</th>
                  </tr>
                </thead>
                <tbody>
                  {order.members.map((member) => (
                    <tr key={member.id}>
                      <td>{member.name || "-"}</td>
                      <td>{member.instrument || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="section">
          <div className="section-title">
            <h2>セットリスト・PA要望</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>曲順</th>
                  <th>曲名</th>
                  <th>時間</th>
                  <th>曲調</th>
                  <th>始まり</th>
                  <th>MC</th>
                  <th>PA要望</th>
                </tr>
              </thead>
              <tbody>
                {order.songs.map((song) => (
                  <tr key={song.id}>
                    <td>{song.order}</td>
                    <td>
                      <strong>{song.title || "-"}</strong>
                    </td>
                    <td>{song.duration || "-"}</td>
                    <td>{song.mood || "-"}</td>
                    <td>{song.startTrigger || "-"}</td>
                    <td>
                      {song.mc.hasMc ? (
                        <span className="badge warn">あり {song.mc.person ? `(${song.mc.person})` : ""}</span>
                      ) : (
                        "なし"
                      )}
                    </td>
                    <td className="preline">{song.paRequest || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="section">
          <div className="grid two">
            <div>
              <div className="section-title">
                <h2>持ち込み機材</h2>
              </div>
              {order.equipment.length === 0 ? (
                <p className="empty">持ち込み機材は未入力です。</p>
              ) : (
                <div className="table-wrap">
                  <table className="table compact-table">
                    <thead>
                      <tr>
                        <th>機材</th>
                        <th>担当楽器</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.equipment.map((item) => (
                        <tr key={item.id}>
                          <td>{item.name || "-"}</td>
                          <td>{item.instrument || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div>
              <div className="section-title">
                <h2>全体要望</h2>
              </div>
              <div className="panel preline">{order.generalRequest || "全体要望は未入力です。"}</div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="danger-zone">
            <div>
              <h2>提出内容の削除</h2>
              <p>削除すると、このバンドの提出内容は管理画面から見られなくなります。</p>
            </div>
            <form action={removeOrder}>
              <input name="id" type="hidden" value={order.id} />
              <button className="button danger" type="submit">
                この提出を削除
              </button>
            </form>
          </div>
        </section>
      </section>
    </main>
  );
}
