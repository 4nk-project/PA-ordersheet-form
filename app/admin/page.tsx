import { requireAdminSession } from "@/lib/auth";
import { listAdminEntries } from "@/lib/entries";
import { listLiveEvents } from "@/lib/liveEvents";
import { listUnlinkedOrderSummaries } from "@/lib/orders";
import { importStateOf, inviteStateOf, submissionStateLabels, submissionStateOf, submissionStateOrder, submissionStateTone, type SubmissionState } from "@/lib/orderStatus";
import { formatInTimeZone } from "@/lib/time";
import { AdminHeader } from "./admin-header";
import { CreateEntryForm } from "./entry-controls";
import { EntryDetail } from "./entry-detail";
import { EntryList, type EntryListRow } from "./entry-list";

export const dynamic = "force-dynamic";

type Query = { event?: string; q?: string; state?: string; sort?: string; backing?: string; pa?: string; selected?: string };

function buildQuery(query: Query, patch: Partial<Query>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...query, ...patch })) if (value) params.set(key, value);
  const text = params.toString();
  return text ? `/admin?${text}` : "/admin";
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requireAdminSession();
  const query = await searchParams;
  const liveEvents = await listLiveEvents();
  const selectedEvent = liveEvents.find((event) => event.id === query.event) || liveEvents[liveEvents.length - 1];
  const rows = selectedEvent ? await listAdminEntries(selectedEvent.id) : [];
  const unlinked = await listUnlinkedOrderSummaries();
  const normalizedQuery: Query = {
    event: selectedEvent?.id,
    q: query.q?.trim() || undefined,
    state: submissionStateOrder.includes(query.state as SubmissionState) ? query.state : undefined,
    sort: query.sort === "updated" ? "updated" : undefined,
    backing: query.backing === "1" ? "1" : undefined,
    pa: query.pa === "1" ? "1" : undefined,
  };
  const keyword = (normalizedQuery.q || "").toLowerCase();

  const withState = rows.map((row) => ({ row, state: submissionStateOf(row.order) }));
  const counts = Object.fromEntries(submissionStateOrder.map((state) => [state, withState.filter((item) => item.state === state && !item.row.entry.cancelledAt).length])) as Record<SubmissionState, number>;
  const filtered = withState
    .filter(({ row, state }) => {
      if (normalizedQuery.state && state !== normalizedQuery.state) return false;
      if (normalizedQuery.backing && !row.order?.usesBackingTrack) return false;
      if (normalizedQuery.pa && !row.order?.hasPaRequest) return false;
      if (keyword && ![row.entry.bandName, row.order?.contactName || ""].join(" ").toLowerCase().includes(keyword)) return false;
      return true;
    })
    .sort((a, b) => (normalizedQuery.sort === "updated" ? Date.parse(b.row.order?.submitterUpdatedAt || "0") - Date.parse(a.row.order?.submitterUpdatedAt || "0") : 0));

  const selectedEntryId = query.selected && rows.some((row) => row.entry.id === query.selected) ? query.selected : undefined;
  const listPath = buildQuery(normalizedQuery, {});
  const listRows: EntryListRow[] = filtered.map(({ row, state }) => ({
    entryId: row.entry.id,
    orderId: row.order?.id || null,
    bandName: row.entry.bandName,
    initialOrder: row.entry.initialPerformanceOrder,
    cancelled: Boolean(row.entry.cancelledAt),
    stateLabel: submissionStateLabels[state],
    stateTone: submissionStateTone(state),
    reviewable: Boolean(row.order) && state !== "reviewed" && !row.entry.cancelledAt,
    contentRevision: row.order?.contentRevision ?? null,
    reviewedRevision: row.order?.reviewedRevision ?? null,
    importLabel: importStateOf(row.importReceipts, row.order?.reviewedRevision ?? null).label,
    inviteLabel: inviteStateOf(row.invite).label,
    usesBackingTrack: Boolean(row.order?.usesBackingTrack),
    hasPaRequest: Boolean(row.order?.hasPaRequest),
    songCount: row.order?.songCount || 0,
    submitterUpdatedLabel: row.order ? formatInTimeZone(row.order.submitterUpdatedAt, selectedEvent?.timeZone) : "-",
    selectHref: buildQuery(normalizedQuery, { selected: row.entry.id }),
    detailHref: `/admin/entries/${encodeURIComponent(row.entry.id)}?back=${encodeURIComponent(listPath)}`,
    selected: row.entry.id === selectedEntryId,
  }));

  return (
    <main className="shell">
      <AdminHeader title="提出一覧" />
      <section className="container wide">
        <div className="hero">
          <h1>提出一覧</h1>
          <p>招待済みで未提出のバンドも含めて、ライブごとに提出状況を確認できます。</p>
        </div>

        <form className="live-order-selector" action="/admin">
          <label className="field">
            <span>ライブ</span>
            <select className="select" name="event" defaultValue={selectedEvent?.id || ""}>
              {liveEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                  {event.inviteRequired ? "（招待制）" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="button" type="submit">
            表示
          </button>
          <a className="button secondary" href="/admin/export.csv">
            CSVダウンロード
          </a>
        </form>

        <nav className="state-tabs" aria-label="提出状態で絞り込み">
          <a className={`state-tab${!normalizedQuery.state ? " active" : ""}`} href={buildQuery(normalizedQuery, { state: undefined, selected: undefined })} aria-current={!normalizedQuery.state ? "page" : undefined}>
            すべて <strong>{rows.length}</strong>
          </a>
          {submissionStateOrder.map((state) => (
            <a key={state} className={`state-tab${normalizedQuery.state === state ? " active" : ""}`} href={buildQuery(normalizedQuery, { state, selected: undefined })} aria-current={normalizedQuery.state === state ? "page" : undefined}>
              {submissionStateLabels[state]} <strong>{counts[state]}</strong>
            </a>
          ))}
        </nav>

        <form className="filter-bar" action="/admin">
          <input type="hidden" name="event" value={normalizedQuery.event || ""} />
          {normalizedQuery.state ? <input type="hidden" name="state" value={normalizedQuery.state} /> : null}
          <label className="field">
            <span>検索</span>
            <input className="input" type="search" name="q" defaultValue={normalizedQuery.q || ""} placeholder="バンド名・代表者" />
          </label>
          <label className="field">
            <span>並び順</span>
            <select className="select" name="sort" defaultValue={normalizedQuery.sort || ""}>
              <option value="">出演順</option>
              <option value="updated">演者の更新が新しい順</option>
            </select>
          </label>
          <label className="checkbox-inline">
            <input type="checkbox" name="backing" value="1" defaultChecked={Boolean(normalizedQuery.backing)} />
            音源あり
          </label>
          <label className="checkbox-inline">
            <input type="checkbox" name="pa" value="1" defaultChecked={Boolean(normalizedQuery.pa)} />
            PA要望あり
          </label>
          <button className="button secondary" type="submit">
            絞り込む
          </button>
          <a className="button text" href={buildQuery({ event: normalizedQuery.event }, {})}>
            条件をクリア
          </a>
          <div className="result-count">
            <span>表示</span>
            <strong>{listRows.length}件</strong>
          </div>
        </form>

        <div className={`admin-split${selectedEntryId ? " has-detail" : ""}`}>
          <div className="admin-split-list">
            {listRows.length ? <EntryList rows={listRows} /> : <p className="empty">条件に合う出演エントリーはありません。</p>}
            {selectedEvent ? (
              <details className="section create-entry">
                <summary>出演エントリーを追加</summary>
                <CreateEntryForm liveEventId={selectedEvent.id} />
              </details>
            ) : null}
          </div>
          {selectedEntryId ? (
            <div className="admin-split-detail desktop-only">
              <EntryDetail entryId={selectedEntryId} returnPath={buildQuery(normalizedQuery, { selected: selectedEntryId })} />
            </div>
          ) : (
            <div className="admin-split-detail desktop-only placeholder">
              <p>左の一覧からバンドを選ぶと、ここに詳細と差分を表示します。</p>
            </div>
          )}
        </div>

        {unlinked.length ? (
          <section className="section">
            <details>
              <summary>ライブに紐づいていない以前の提出（{unlinked.length}件）</summary>
              <ul className="review-list">
                {unlinked.map((order) => (
                  <li key={order.id}>
                    <a href={`/admin/orders/${encodeURIComponent(order.id)}`}>{order.bandName}</a>
                    <span>{order.liveEventName || "ライブ未設定"}</span>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        ) : null}
      </section>
    </main>
  );
}
