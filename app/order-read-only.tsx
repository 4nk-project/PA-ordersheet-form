import { formatDurationJa, totalDurationSeconds, formatDuration } from "@/lib/orderSchema";
import type { PAOrder } from "@/types/order";

/** 締切後・受付停止中の閲覧専用表示 */
export function OrderReadOnly({ order, liveEventName, message }: { order: PAOrder; liveEventName: string; message: string }) {
  const memberName = (id: string | null) => order.members.find((member) => member.id === id)?.name;
  return (
    <section className="container narrow">
      <div className="notice" role="status">
        <strong>閲覧のみ</strong>
        <p>{message}</p>
      </div>
      <div className="panel read-only-order">
        <h1>{order.bandName}</h1>
        <dl className="fixed-info">
          <div>
            <dt>ライブ</dt>
            <dd>{liveEventName}</dd>
          </div>
          <div>
            <dt>代表者</dt>
            <dd>{order.contactName}</dd>
          </div>
          <div>
            <dt>マイク</dt>
            <dd>{order.microphoneCount}本</dd>
          </div>
          <div>
            <dt>音源</dt>
            <dd>{order.usesBackingTrack ? `あり（${[order.backingTrack.operator, order.backingTrack.device, order.backingTrack.connection].filter(Boolean).join("／") || "詳細未入力"}）` : "なし"}</dd>
          </div>
        </dl>
        <h2>メンバー</h2>
        <ul className="review-list">
          {order.members.map((member) => (
            <li key={member.id}>
              <strong>{member.name || "名前未入力"}</strong>
              <span>{member.instrument || "担当未入力"}</span>
            </li>
          ))}
        </ul>
        <h2>持ち込み機材</h2>
        {order.equipment.length ? (
          <ul className="review-list">
            {order.equipment.map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <span>{[memberName(item.memberId), item.instrument].filter(Boolean).join("・") || "-"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>なし</p>
        )}
        <h2>セットリスト（楽曲の合計 {formatDuration(totalDurationSeconds(order.songs))}、MC・転換は含みません）</h2>
        <ol className="review-setlist">
          {order.songs.map((song) => (
            <li key={song.id}>
              <div>
                <strong>{song.title || "曲名未入力"}</strong>
                <span>{formatDurationJa(song.durationSeconds) || "時間未入力"}</span>
              </div>
              {song.paRequest ? <p>PA要望：{song.paRequest}</p> : null}
            </li>
          ))}
        </ol>
        {order.generalRequest ? <p className="review-request">全体要望：{order.generalRequest}</p> : null}
      </div>
    </section>
  );
}
