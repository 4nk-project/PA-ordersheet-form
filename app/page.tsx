import { listLiveEvents, submissionWindow } from "@/lib/liveEvents";
import { OrderForm } from "./order-form";

export const dynamic = "force-dynamic";

/** 旧来の公開フォーム。招待必須・受付終了のライブは選択肢に出さない（サーバー側でも拒否する） */
export default async function Home() {
  const liveEvents = (await listLiveEvents()).filter((event) => !event.inviteRequired && submissionWindow(event).open);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>PAオーダーシート</strong>
          <span>提出フォーム</span>
        </div>
      </header>
      {liveEvents.length ? (
        <OrderForm liveEvents={liveEvents} />
      ) : (
        <section className="container narrow">
          <div className="panel">
            <h1>現在受け付けているライブはありません</h1>
            <p>運営から招待URLを受け取っている場合は、そのURLから提出してください。</p>
          </div>
        </section>
      )}
    </main>
  );
}
