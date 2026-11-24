import { requireAdminSession } from "@/lib/auth";
import { listLiveEvents } from "@/lib/liveEvents";
import { isoToZonedLocal } from "@/lib/time";
import { AdminHeader } from "../../admin-header";
import { LiveEventSettings } from "./live-event-settings";

export const dynamic = "force-dynamic";

export default async function LiveEventSettingsPage() {
  await requireAdminSession();
  const liveEvents = (await listLiveEvents()).map((event) => ({ ...event, deadlineLocal: isoToZonedLocal(event.submissionDeadlineAt, event.timeZone) }));
  return (
    <main className="shell">
      <AdminHeader title="ライブ設定" />
      <section className="container">
        <div className="hero">
          <h1>ライブ設定</h1>
          <p>ライブ名、開催日、提出締切、受付状態、招待制の有無、最大曲数を管理します。</p>
        </div>
        <LiveEventSettings liveEvents={liveEvents} />
      </section>
    </main>
  );
}
