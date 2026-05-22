"use client";

import { useMemo, useState } from "react";
import { submitOrder, updateSubmittedOrder } from "./actions";
import {
  DEFAULT_EQUIPMENT_COUNT,
  DEFAULT_MEMBER_COUNT,
  DEFAULT_SONG_COUNT,
  makeEmptyEquipment,
  makeEmptyMembers,
  makeEmptySongs,
} from "@/lib/orderSchema";
import type { LiveEvent, PAOrder } from "@/types/order";

export function OrderForm({
  error,
  liveEvents,
  order,
  updated,
}: {
  error?: string;
  liveEvents: LiveEvent[];
  order?: PAOrder;
  updated?: boolean;
}) {
  const [selectedLiveEventId, setSelectedLiveEventId] = useState(order?.liveEventId || "");
  const selectedLiveEvent = liveEvents.find((event) => event.id === selectedLiveEventId);
  const songCount = selectedLiveEvent?.songCount ?? order?.liveEventSongCount ?? DEFAULT_SONG_COUNT;
  const action = order ? updateSubmittedOrder : submitOrder;

  const members = useMemo(() => makeEmptyMembers(DEFAULT_MEMBER_COUNT), []);
  const songs = useMemo(() => makeEmptySongs(songCount), [songCount]);
  const equipment = useMemo(() => makeEmptyEquipment(DEFAULT_EQUIPMENT_COUNT), []);

  return (
    <form className="container" action={action}>
      {order ? <input name="edit_token" type="hidden" value={order.editToken} /> : null}
      <section className="hero">
        <h1>{order ? "PAオーダーシート確認・編集" : "PAオーダーシート提出"}</h1>
        <p>{order ? "提出済みの内容を確認し、必要な箇所を編集できます。" : "バンド情報、メンバー、セットリスト、曲ごとのPA要望をまとめて提出できます。"}</p>
      </section>

      {error ? <div className="error">{error}</div> : null}
      {updated ? <div className="success">更新しました。</div> : null}

      <section className="section">
        <div className="section-title">
          <div>
            <h2>基本情報</h2>
            <p>管理者がバンドごとに確認するための情報です。</p>
          </div>
        </div>
        <div className="grid two">
          <label className="field">
            <span>ライブ内容</span>
            <select
              className="select"
              name="live_event_id"
              onChange={(event) => setSelectedLiveEventId(event.target.value)}
              required
              value={selectedLiveEventId}
            >
              <option value="">選択してください</option>
              {liveEvents.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}（{event.songCount}曲）
                </option>
              ))}
            </select>
          </label>
          <input name="live_event_name" type="hidden" value={selectedLiveEvent?.name || ""} />
          <label className="field">
            <span>バンド名</span>
            <input className="input" defaultValue={order?.bandName || ""} name="band_name" required />
          </label>
          <label className="field">
            <span>代表者名</span>
            <input className="input" defaultValue={order?.contactName || ""} name="contact_name" required />
          </label>
          <label className="field">
            <span>使用するマイクの本数</span>
            <input className="input" defaultValue={order?.microphoneCount || ""} min="0" name="microphone_count" type="number" />
          </label>
          <label className="check">
            <input defaultChecked={order?.usesBackingTrack || false} name="uses_backing_track" type="checkbox" />
            <span>音源・同期音源を使用する</span>
          </label>
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <h2>メンバー</h2>
            <p>名前と担当楽器を入力してください。</p>
          </div>
        </div>
        <div className="grid two">
          {members.map((member, index) => (
            <div className="mini-row" key={member.id}>
              <label className="field">
                <span>名前 {index + 1}</span>
                <input className="input" defaultValue={order?.members[index]?.name || ""} name={`member_${index}_name`} />
              </label>
              <label className="field">
                <span>担当楽器</span>
                <input className="input" defaultValue={order?.members[index]?.instrument || ""} name={`member_${index}_instrument`} placeholder="Vo / Gt / Ba / Dr" />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <h2>セットリスト</h2>
            <p>{selectedLiveEvent ? `${selectedLiveEvent.name}は${songCount}曲まで入力できます。` : "ライブ内容を選択すると曲数が反映されます。"}</p>
          </div>
        </div>
        <div className="grid">
          {songs.map((song, index) => (
            <div className="song-grid" key={song.id}>
              <div className="song-head">
                <strong>{index + 1}曲目</strong>
                <label className="check">
                  <input defaultChecked={order?.songs[index]?.mc.hasMc || false} name={`song_${index}_has_mc`} type="checkbox" />
                  <span>この曲の後にMCあり</span>
                </label>
              </div>
              <div className="grid three">
                <label className="field">
                  <span>曲名</span>
                  <input className="input" defaultValue={order?.songs[index]?.title || ""} name={`song_${index}_title`} />
                </label>
                <label className="field">
                  <span>時間</span>
                  <input className="input" defaultValue={order?.songs[index]?.duration || ""} name={`song_${index}_duration`} placeholder="4:30" />
                </label>
                <label className="field">
                  <span>曲調</span>
                  <input className="input" defaultValue={order?.songs[index]?.mood || ""} name={`song_${index}_mood`} placeholder="バラード / ロック" />
                </label>
              </div>
              <div className="grid two">
                <label className="field">
                  <span>曲の始まるきっかけ</span>
                  <input className="input" defaultValue={order?.songs[index]?.startTrigger || ""} name={`song_${index}_start_trigger`} placeholder="ドラム4カウント / ギターから" />
                </label>
                <label className="field">
                  <span>MC担当</span>
                  <input className="input" defaultValue={order?.songs[index]?.mc.person || ""} name={`song_${index}_mc_person`} placeholder="Vo など" />
                </label>
              </div>
              <label className="field">
                <span>音響への要望</span>
                <textarea className="textarea" defaultValue={order?.songs[index]?.paRequest || ""} name={`song_${index}_pa_request`} />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-title">
          <div>
            <h2>持ち込み機材</h2>
            <p>マルチエフェクター、スネア、シンバルなどを入力してください。</p>
          </div>
        </div>
        <div className="grid two">
          {equipment.map((item, index) => (
            <div className="mini-row" key={item.id}>
              <label className="field">
                <span>機材 {index + 1}</span>
                <input className="input" defaultValue={order?.equipment[index]?.name || ""} name={`equipment_${index}_name`} />
              </label>
              <label className="field">
                <span>担当楽器</span>
                <input className="input" defaultValue={order?.equipment[index]?.instrument || ""} name={`equipment_${index}_instrument`} />
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <label className="field">
          <span>バンド全体・全曲通しての要望</span>
          <textarea className="textarea" defaultValue={order?.generalRequest || ""} name="general_request" />
        </label>
        <div className="actions">
          <button className="button" type="submit">
            {order ? "更新する" : "提出する"}
          </button>
          {order ? (
            <a className="button secondary" href="/">
              新しく提出する
            </a>
          ) : null}
        </div>
      </section>
    </form>
  );
}
