import type { ItemChange, OrderDiff } from "@/contracts/v1/diff";

const kindLabels: Record<ItemChange["kind"], string> = { added: "追加", removed: "削除", changed: "変更" };

/** 変更前後の値を文字で示す差分表示（色だけに頼らない） */
export function DiffView({ diff, beforeLabel, afterLabel }: { diff: OrderDiff; beforeLabel: string; afterLabel: string }) {
  if (!diff.hasChanges) return <p className="empty-compact">内容の差分はありません。</p>;
  return (
    <div className="diff-view">
      <p className="diff-legend">
        {beforeLabel} → {afterLabel}
      </p>
      {diff.fields.length ? (
        <section>
          <h4>基本情報</h4>
          <ul className="diff-list">
            {diff.fields.map((change) => (
              <li key={change.field} className="diff-item changed">
                <span className="diff-kind">変更</span>
                <strong>{change.label}</strong>
                <span className="diff-values">
                  <del>{change.before}</del> → <ins>{change.after}</ins>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <ItemSection title="セットリスト" items={diff.songs} />
      <ItemSection title="メンバー" items={diff.members} />
      <ItemSection title="持ち込み機材" items={diff.equipment} />
    </div>
  );
}

function ItemSection({ title, items }: { title: string; items: ItemChange[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h4>{title}</h4>
      <ul className="diff-list">
        {items.map((item) => (
          <li key={`${item.kind}-${item.id}`} className={`diff-item ${item.kind}`}>
            <span className="diff-kind">{kindLabels[item.kind]}</span>
            <strong>
              {item.label}
              {item.afterPosition ? `（${item.afterPosition}番目）` : item.beforePosition ? `（元 ${item.beforePosition}番目）` : ""}
            </strong>
            {item.changes.length ? (
              <ul>
                {item.changes.map((change) => (
                  <li key={change.field}>
                    {change.label}：<del>{change.before}</del> → <ins>{change.after}</ins>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
