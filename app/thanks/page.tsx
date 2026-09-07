import { notFound } from "next/navigation";
import { formatDateTime } from "@/lib/format";
import { getOrderByEditToken } from "@/lib/orders";
import { ThanksActions } from "./thanks-actions";

export const dynamic = "force-dynamic";

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const order = token ? await getOrderByEditToken(token) : null;
  if (!order) notFound();
  const editPath = `/orders/${encodeURIComponent(order.editToken)}`;

  return <main className="shell"><header className="topbar"><div className="brand"><strong>PAオーダーシート</strong><span>提出完了</span></div></header><section className="container narrow"><div className="panel completion-panel"><span className="completion-mark" aria-hidden="true">✓</span><h1>提出が完了しました</h1><p>PAオーダーシートを受け付けました。</p><dl className="completion-summary"><div><dt>バンド名</dt><dd>{order.bandName}</dd></div><div><dt>ライブ</dt><dd>{order.liveEventName}</dd></div><div><dt>提出日時</dt><dd>{formatDateTime(order.createdAt)}</dd></div></dl><ThanksActions editPath={editPath} /></div></section></main>;
}
