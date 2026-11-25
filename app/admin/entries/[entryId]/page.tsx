import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth";
import { getEntry } from "@/lib/entries";
import { AdminHeader } from "../../admin-header";
import { EntryDetail } from "../../entry-detail";

export const dynamic = "force-dynamic";

function safeBack(value: string | undefined) {
  return value && value.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

export default async function EntryPage({ params, searchParams }: { params: Promise<{ entryId: string }>; searchParams: Promise<{ back?: string; updated?: string }> }) {
  await requireAdminSession();
  const [{ entryId }, query] = await Promise.all([params, searchParams]);
  const entry = await getEntry(entryId);
  if (!entry) notFound();
  const back = safeBack(query.back || `/admin?event=${encodeURIComponent(entry.liveEventId)}`);
  return (
    <main className="shell">
      <AdminHeader title="出演エントリー" />
      <section className="container">
        <p>
          <a className="back-link" href={back}>
            ← 一覧へ戻る
          </a>
        </p>
        {query.updated === "1" ? <div className="success">提出内容を更新しました（新しい版として保存）。</div> : null}
        <EntryDetail entryId={entryId} returnPath={`/admin/entries/${encodeURIComponent(entryId)}?back=${encodeURIComponent(back)}`} />
      </section>
    </main>
  );
}
