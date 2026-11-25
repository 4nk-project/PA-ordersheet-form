"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { bulkReviewAction, type BulkReviewState } from "@/app/actions";

export type EntryListRow = {
  entryId: string;
  orderId: string | null;
  bandName: string;
  initialOrder: number | null;
  cancelled: boolean;
  stateLabel: string;
  stateTone: string;
  reviewable: boolean;
  contentRevision: number | null;
  reviewedRevision: number | null;
  importLabel: string;
  inviteLabel: string;
  usesBackingTrack: boolean;
  hasPaRequest: boolean;
  songCount: number;
  submitterUpdatedLabel: string;
  selectHref: string;
  detailHref: string;
  selected: boolean;
};

function BulkSubmit({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button className="button primary" type="submit" disabled={pending || count === 0}>
      {pending ? "確認中…" : `選択した${count}件を確認済みにする`}
    </button>
  );
}

/** 一覧と一括確認。チェック時点の版を送信し、その後に更新された提出はサーバーが除外する */
export function EntryList({ rows }: { rows: EntryListRow[] }) {
  const [state, action] = useActionState<BulkReviewState, FormData>(bulkReviewAction, { results: [] });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const reviewableRows = rows.filter((row) => row.reviewable);

  return (
    <form action={action} className="entry-list">
      {state.results.length ? (
        <div className="bulk-results" role="status">
          <strong>一括確認の結果</strong>
          <ul>
            {state.results.map((result, index) => (
              <li key={`${result.label}-${index}`} className={result.ok ? "ok" : "ng"}>
                {result.ok ? "成功" : "除外"}：{result.label} — {result.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {reviewableRows.length ? (
        <div className="bulk-bar">
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={checked.size > 0 && checked.size === reviewableRows.length}
              onChange={(event) => setChecked(event.target.checked ? new Set(reviewableRows.map((row) => row.entryId)) : new Set())}
            />
            確認待ちをすべて選択
          </label>
          <BulkSubmit count={checked.size} />
        </div>
      ) : null}
      <ul className="entry-rows">
        {rows.map((row) => (
          <li key={row.entryId} className={`entry-row${row.selected ? " selected" : ""}${row.cancelled ? " cancelled" : ""}`}>
            <div className="entry-row-check">
              {row.reviewable && row.orderId ? (
                <input
                  type="checkbox"
                  name="target"
                  aria-label={`${row.bandName} 版${row.contentRevision}を一括確認に含める`}
                  value={`${row.orderId}|${row.contentRevision}|${row.bandName}`}
                  checked={checked.has(row.entryId)}
                  onChange={(event) =>
                    setChecked((current) => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(row.entryId);
                      else next.delete(row.entryId);
                      return next;
                    })
                  }
                />
              ) : null}
            </div>
            <div className="entry-row-order">{row.initialOrder ?? "-"}</div>
            <div className="entry-row-main">
              <a className="entry-row-link desktop-only" href={row.selectHref} aria-current={row.selected ? "true" : undefined}>
                {row.bandName}
              </a>
              <a className="entry-row-link mobile-only" href={row.detailHref}>
                {row.bandName}
              </a>
              <div className="entry-row-meta">
                <span className={`badge ${row.stateTone}`}>{row.stateLabel}</span>
                {row.cancelled ? <span className="badge">取消</span> : null}
                {row.contentRevision ? <span>版{row.contentRevision}{row.reviewedRevision ? `／確認 版${row.reviewedRevision}` : ""}</span> : <span>{row.inviteLabel}</span>}
                <span>{row.importLabel}</span>
                {row.usesBackingTrack ? <span className="badge warn">音源あり</span> : null}
                {row.hasPaRequest ? <span className="badge warn">PA要望あり</span> : null}
              </div>
              {row.orderId ? <small>{row.songCount}曲 ・ 演者更新 {row.submitterUpdatedLabel}</small> : null}
            </div>
          </li>
        ))}
      </ul>
    </form>
  );
}
