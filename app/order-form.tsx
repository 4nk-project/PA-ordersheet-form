"use client";

import { useMemo, useState } from "react";
import { submitOrder, updateAdminOrder, updateSubmittedOrder } from "./actions";
import {
  DEFAULT_EQUIPMENT_COUNT,
  DEFAULT_MEMBER_COUNT,
  makeEmptyEquipment,
  makeEmptyMembers,
  makeEmptySongs,
} from "@/lib/orderSchema";
import type { LiveEvent, PAOrder } from "@/types/order";

export function OrderForm({
  error,
  liveEvents,
  mode = "new",
  order,
  updated,
}: {
  error?: string;
  liveEvents: LiveEvent[];
  mode?: "new" | "submitter" | "admin";
  order?: PAOrder;
  updated?: boolean;
}) {
  const [selectedLiveEventId, setSelectedLiveEventId] = useState(order?.liveEventId || "");
  const selectedLiveEvent = liveEvents.find((event) => event.id === selectedLiveEventId);
  const songCount = selectedLiveEvent?.songCount ?? order?.liveEventSongCount ?? 1;
  const action = mode === "admin" ? updateAdminOrder : order ? updateSubmittedOrder : submitOrder;
  const textInputProps = { autoComplete: "new-password", spellCheck: false } as const;
  const textareaProps = { autoComplete: "off", spellCheck: false } as const;

  const members = useMemo(() => makeEmptyMembers(DEFAULT_MEMBER_COUNT), []);
  const songs = useMemo(() => makeEmptySongs(songCount), [songCount]);
  const equipment = useMemo(() => makeEmptyEquipment(DEFAULT_EQUIPMENT_COUNT), []);
  const requiredMark = <span className="required">必須</span>;

  return (
    <form
      autoComplete="off"
      className="container"
      action={action}
      onKeyDown={(event) => {
        const target = event.target;

        if (event.key !== "Enter" || target instanceof HTMLTextAreaElement || target instanceof HTMLButtonElement) {
          return;
        }

        event.preventDefault();
      }}
      onSubmit={(event) => {
        if (mode === "admin" && !window.confirm("提出内容を変更します。本当に保存しますか？")) {
          event.preventDefault();
        }
      }}
    >
      {order && mode !== "admin" ? <input name="edit_token" type="hidden" value={order.editToken} /> : null}
      {order && mode === "admin" ? <input name="order_id" type="hidden" value={order.id} /> : null}
      <section className="hero">
        <h1>{mode === "admin" ? "提出内容の管理者編集" : order ? "PAオーダーシート確認・編集" : "PAオーダーシート提出"}</h1>
        <p>{mode === "admin" ? "管理者として提出済みの内容を編集できます。" : order ? "提出済みの内容を確認し、必要な箇所を編集できます。" : "バンド情報、メンバー、セットリスト、曲ごとのPA要望をまとめて提出できます。"}</p>
      </section>

      {error ? <div className="error">{error}</div> : null}
      {updated ? <div className="success">更新しました。</div> : null}

      <section className="section section-card">
        <div className="section-title">
          <div>
            <h2>基本情報</h2>
            <p>管理者がバンドごとに確認するための情報です。</p>
          </div>
          <span className="section-status">最初に入力</span>
        </div>
        <div className="grid two">
          <label className="field">
            <span>ライブ内容 {requiredMark}</span>
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
            <span>バンド名 {requiredMark}</span>
            <input className="input" defaultValue={order?.bandName || ""} name="band_name" required {...textInputProps} />
          </label>
          <label className="field">
            <span>代表者名 {requiredMark}</span>
            <input className="input" defaultValue={order?.contactName || ""} name="contact_name" required {...textInputProps} />
          </label>
          <label className="field">
            <span>使用するマイクの本数</span>
            <input autoComplete="off" className="input" defaultValue={order?.microphoneCount || ""} min="0" name="microphone_count" type="number" />
          </label>
          <label className="check">
            <input defaultChecked={order?.usesBackingTrack || false} name="uses_backing_track" type="checkbox" />
            <span>音源・同期音源を使用する</span>
          </label>
        </div>
      </section>

      <details className="section collapsible" open>
        <summary>
          <span>
            <strong>メンバー</strong>
            <small>名前と担当楽器を入力してください。</small>
          </span>
        </summary>
        <div className="grid two collapsible-body">
          {members.map((member, index) => (
            <div className="mini-row" key={member.id}>
              <label className="field">
                <span>名前 {index + 1}</span>
                <input className="input" defaultValue={order?.members[index]?.name || ""} name={`member_${index}_name`} {...textInputProps} />
              </label>
              <label className="field">
                <span>担当楽器</span>
                <input className="input" defaultValue={order?.members[index]?.instrument || ""} name={`member_${index}_instrument`} placeholder="Vo / Gt / Ba / Dr" {...textInputProps} />
              </label>
            </div>
          ))}
        </div>
      </details>

      <details className="section collapsible" open>
        <summary>
          <span>
            <strong>セットリスト</strong>
            <small>{selectedLiveEvent ? `${selectedLiveEvent.name}は${songCount}曲まで入力できます。` : "ライブ内容を選択すると曲数が反映されます。"}</small>
          </span>
        </summary>
        <div className="grid collapsible-body">
          {songs.map((song, index) => (
            <details className="song-grid" key={song.id} open={index === 0 || Boolean(order?.songs[index]?.title)}>
              <summary className="song-head">
                <span>
                  <strong>{index + 1}曲目</strong>
                  {index === 0 ? requiredMark : null}
                </span>
                <span className="song-summary">{order?.songs[index]?.title || "曲情報を入力"}</span>
              </summary>
              <div className="song-body">
                <label className="check">
                  <input defaultChecked={order?.songs[index]?.mc.hasMc || false} name={`song_${index}_has_mc`} type="checkbox" />
                  <span>この曲の後にMCあり</span>
                </label>
                <div className="grid three">
                  <label className="field">
                    <span>曲名 {index === 0 ? requiredMark : null}</span>
                    <input className="input" defaultValue={order?.songs[index]?.title || ""} name={`song_${index}_title`} required={index === 0} {...textInputProps} />
                  </label>
                  <label className="field">
                    <span>時間</span>
                    <input className="input" defaultValue={order?.songs[index]?.duration || ""} name={`song_${index}_duration`} placeholder="4:30" {...textInputProps} />
                  </label>
                  <label className="field">
                    <span>曲調</span>
                    <input className="input" defaultValue={order?.songs[index]?.mood || ""} name={`song_${index}_mood`} placeholder="バラード / ロック" {...textInputProps} />
                  </label>
                </div>
                <div className="grid two">
                  <label className="field">
                    <span>曲の始まるきっかけ</span>
                    <input className="input" defaultValue={order?.songs[index]?.startTrigger || ""} name={`song_${index}_start_trigger`} placeholder="ドラム4カウント / ギターから" {...textInputProps} />
                  </label>
                  <label className="field">
                    <span>MC担当</span>
                    <input className="input" defaultValue={order?.songs[index]?.mc.person || ""} name={`song_${index}_mc_person`} placeholder="Vo など" {...textInputProps} />
                  </label>
                </div>
                <label className="field">
                  <span>音響への要望</span>
                  <textarea className="textarea" defaultValue={order?.songs[index]?.paRequest || ""} name={`song_${index}_pa_request`} {...textareaProps} />
                </label>
              </div>
            </details>
          ))}
        </div>
      </details>

      <details className="section collapsible" open={Boolean(order?.equipment.length)}>
        <summary>
          <span>
            <strong>持ち込み機材</strong>
            <small>マルチエフェクター、スネア、シンバルなどを入力してください。</small>
          </span>
        </summary>
        <div className="grid two collapsible-body">
          {equipment.map((item, index) => (
            <div className="mini-row" key={item.id}>
              <label className="field">
                <span>機材 {index + 1}</span>
                <input className="input" defaultValue={order?.equipment[index]?.name || ""} name={`equipment_${index}_name`} {...textInputProps} />
              </label>
              <label className="field">
                <span>担当楽器</span>
                <input className="input" defaultValue={order?.equipment[index]?.instrument || ""} name={`equipment_${index}_instrument`} {...textInputProps} />
              </label>
            </div>
          ))}
        </div>
      </details>

      <section className="section section-card">
        <label className="field">
          <span>バンド全体・全曲通しての要望</span>
          <textarea className="textarea" defaultValue={order?.generalRequest || ""} name="general_request" {...textareaProps} />
        </label>
        <div className="actions">
          <button className="button" type="submit">
            {order ? "更新する" : "提出する"}
          </button>
          {mode === "admin" && order ? (
            <a className="button secondary" href={`/admin/orders/${order.id}`}>
              詳細へ戻る
            </a>
          ) : order ? (
            <a className="button secondary" href="/">
              新しく提出する
            </a>
          ) : null}
        </div>
      </section>
    </form>
  );
}
