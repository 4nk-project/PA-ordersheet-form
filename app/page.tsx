import { listLiveEvents } from "@/lib/liveEvents";
import { OrderForm } from "./order-form";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const liveEvents = await listLiveEvents();

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <strong>PAオーダーシート</strong>
          <span>提出フォーム</span>
        </div>
      </header>

      <OrderForm error={params.error} liveEvents={liveEvents} />
    </main>
  );
}
