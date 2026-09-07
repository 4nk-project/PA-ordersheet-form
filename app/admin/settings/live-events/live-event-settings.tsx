"use client";

import { useRef } from "react";
import { addLiveEvent, changeLiveEventSongCount, removeLiveEvent } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { LiveEvent } from "@/types/order";

export function LiveEventSettings({ liveEvents }: { liveEvents: LiveEvent[] }) {
  return <div className="admin-live-grid"><form className="panel live-event-form" action={addLiveEvent}><label className="field"><span>追加するライブ名</span><input className="input" maxLength={160} name="name" placeholder="例：2026 春ライブ" required /></label><label className="field"><span>最大曲数</span><input className="input" defaultValue={8} max={30} min={1} name="song_count" required type="number" /></label><button className="button primary" type="submit">ライブを追加</button></form><div className="table-wrap"><table className="table compact-table"><thead><tr><th>ライブ名</th><th>最大曲数</th><th>操作</th></tr></thead><tbody>{liveEvents.map((event) => <tr key={event.id}><td>{event.name}</td><td><form className="inline-form" action={changeLiveEventSongCount}><input name="id" type="hidden" value={event.id} /><input className="input compact-input" defaultValue={event.songCount} max={30} min={1} name="song_count" type="number" /><button className="button secondary" type="submit">更新</button></form></td><td><DeleteEventButton event={event} disabled={liveEvents.length <= 1} /></td></tr>)}</tbody></table></div></div>;
}

function DeleteEventButton({ event, disabled }: { event: LiveEvent; disabled: boolean }) {
  const submitRef = useRef<HTMLButtonElement>(null);
  return <form action={removeLiveEvent}><input name="id" type="hidden" value={event.id} /><button ref={submitRef} hidden type="submit" /><ConfirmDialog danger title="ライブを削除しますか？" confirmLabel="削除する" onConfirm={() => submitRef.current?.click()} trigger={<Button variant="danger" isDisabled={disabled}>削除</Button>}><p>「{event.name}」を削除します。提出で使用中の場合は削除できないことがあります。</p></ConfirmDialog></form>;
}
