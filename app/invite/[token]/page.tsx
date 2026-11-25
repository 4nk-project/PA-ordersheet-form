import type { Metadata } from "next";
import { resolveInvite } from "@/lib/entries";
import { submissionWindow } from "@/lib/liveEvents";
import { getOrderByEntryId } from "@/lib/orders";
import { OrderForm } from "@/app/order-form";
import { OrderReadOnly } from "@/app/order-read-only";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "PAオーダーシート", robots: { index: false, follow: false } };

const CONTACT = "運営に連絡し、新しい招待URLを受け取ってください。";

/**
 * 招待URL。GETで開いただけでは提出・失効・利用済み化を行わない（URLプレビュー対策）。
 * 第三者の解析タグは置かない。Referrer-Policy 等は next.config.ts で設定する。
 */
export default async function InvitePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { token } = await params;
  const { saved } = await searchParams;
  const invite = await resolveInvite(token);

  if (invite.status === "not_found") {
    return <InviteMessage title="招待URLが見つかりません" body={`URLが途中で切れていないか確認してください。解決しない場合は、${CONTACT}`} />;
  }
  if (invite.status === "revoked") return <InviteMessage title="この招待URLは使えなくなりました" body={`運営が新しいURLを発行した可能性があります。${CONTACT}`} />;
  if (invite.status === "expired") return <InviteMessage title="招待URLの有効期限が切れています" body={CONTACT} />;
  if (invite.status === "cancelled") return <InviteMessage title="この出演は取り消されています" body="詳しくは運営に確認してください。" />;

  const order = await getOrderByEntryId(invite.entry.id);
  const window = submissionWindow(invite.event);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>PAオーダーシート</strong>
          <span>{invite.event.name}</span>
        </div>
      </header>
      {!window.open ? (
        order ? (
          <OrderReadOnly order={order} liveEventName={invite.event.name} message={window.message} />
        ) : (
          <InviteBody title="受付は終了しています" body={window.message} />
        )
      ) : (
        <OrderForm
          mode="invite"
          liveEvent={invite.event}
          entry={{ id: invite.entry.id, bandName: invite.entry.bandName }}
          order={order}
          inviteToken={token}
          saved={saved === "created" || saved === "updated" ? saved : null}
        />
      )}
    </main>
  );
}

function InviteMessage({ title, body }: { title: string; body: string }) {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>PAオーダーシート</strong>
          <span>招待URL</span>
        </div>
      </header>
      <InviteBody title={title} body={body} />
    </main>
  );
}

function InviteBody({ title, body }: { title: string; body: string }) {
  return (
    <section className="container narrow">
      <div className="panel" role="status">
        <h1>{title}</h1>
        <p>{body}</p>
      </div>
    </section>
  );
}
