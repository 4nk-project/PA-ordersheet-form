import { requireAdminSession } from "@/lib/auth";
import { listLiveEvents } from "@/lib/liveEvents";
import { logout } from "../../login/actions";
import { LiveEventSettings } from "./live-event-settings";

export const dynamic = "force-dynamic";

export default async function LiveEventSettingsPage() {
  await requireAdminSession();
  const liveEvents = await listLiveEvents();
  return <main className="shell"><header className="topbar"><a className="brand" href="/admin"><strong>PAオーダーシート</strong><span>ライブ設定</span></a><div className="actions"><a className="button secondary" href="/admin">提出一覧</a><a className="button secondary" href="/admin/live-orders">演奏順管理</a><form action={logout}><button className="button secondary" type="submit">ログアウト</button></form></div></header><section className="container"><div className="hero"><h1>ライブ設定</h1><p>提出フォームに表示するライブ名と最大曲数を管理します。</p></div><LiveEventSettings liveEvents={liveEvents} /></section></main>;
}
