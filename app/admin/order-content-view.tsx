import { formatDuration, formatDurationJa, totalDurationSeconds } from "@/lib/orderSchema";
import type { PAOrder } from "@/types/order";

/** 提出内容（運営向け）。過去の不完全データは消さずに「要確認」と示す */
export function OrderContentView({ order }: { order: PAOrder }) {
  const memberName = (id: string | null) => order.members.find((member) => member.id === id)?.name;
  const missingDurations = order.songs.filter((song) => song.durationSeconds === null).length;
  return (
    <div className="order-content">
      <div className="meta-grid">
        <div className="meta-item">
          <span>代表者</span>
          <strong>{order.contactName || "-"}</strong>
        </div>
        <div className="meta-item">
          <span>曲数</span>
          <strong>{order.songs.length}曲</strong>
        </div>
        <div className="meta-item">
          <span>楽曲の合計（MC・転換を含まない）</span>
          <strong>{formatDuration(totalDurationSeconds(order.songs))}</strong>
        </div>
        <div className="meta-item">
          <span>マイク</span>
          <strong>{order.microphoneCount}本</strong>
        </div>
      </div>
      {missingDurations ? <p className="notice-inline">演奏時間が未入力・読み取れない曲が{missingDurations}曲あります（要確認）。</p> : null}

      <section className="section">
        <div className="section-title">
          <h3>セットリスト・PA要望</h3>
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
                  <td>{formatDurationJa(song.durationSeconds) || <span className="badge warn">要確認{song.duration ? `（${song.duration}）` : ""}</span>}</td>
                  <td>{song.mood || "-"}</td>
                  <td>{song.startTrigger || "-"}</td>
                  <td>{song.mc.hasMc ? <span className="badge warn">あり{song.mc.person ? `（${song.mc.person}）` : ""}</span> : "なし"}</td>
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
              <h3>メンバー</h3>
            </div>
            {order.members.length ? (
              <ul className="review-list">
                {order.members.map((member) => (
                  <li key={member.id}>
                    <strong>{member.name || "名前未入力"}</strong>
                    <span>{member.instrument || "-"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-compact">未入力</p>
            )}
          </div>
          <div>
            <div className="section-title">
              <h3>持ち込み機材</h3>
            </div>
            {order.equipment.length ? (
              <ul className="review-list">
                {order.equipment.map((item) => (
                  <li key={item.id}>
                    <strong>{item.name || "機材名未入力"}</strong>
                    <span>{[memberName(item.memberId), item.instrument].filter(Boolean).join("・") || "-"}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-compact">なし</p>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="grid two">
          <div>
            <div className="section-title">
              <h3>音源</h3>
            </div>
            {order.usesBackingTrack ? (
              <dl className="fixed-info">
                <div>
                  <dt>再生担当</dt>
                  <dd>{order.backingTrack.operator || "未入力（要確認）"}</dd>
                </div>
                <div>
                  <dt>再生端末</dt>
                  <dd>{order.backingTrack.device || "未入力（要確認）"}</dd>
                </div>
                <div>
                  <dt>接続方法</dt>
                  <dd>{order.backingTrack.connection || "未入力（要確認）"}</dd>
                </div>
              </dl>
            ) : (
              <p className="empty-compact">使用しない</p>
            )}
          </div>
          <div>
            <div className="section-title">
              <h3>全体要望</h3>
            </div>
            <div className="panel preline">{order.generalRequest || "なし"}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
