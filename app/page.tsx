import { listLiveEvents } from "@/lib/liveEvents";
import { OrderForm } from "./order-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const liveEvents = await listLiveEvents();

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>PAオーダーシート</strong>
          <span>提出フォーム</span>
        </div>
      </header>

      <OrderForm liveEvents={liveEvents} />
    </main>
  );
}
