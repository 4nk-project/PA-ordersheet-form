import { describe, expect, it } from "vitest";
import { durationFromParts, formatDuration, parseLegacyDuration, parseOrderForm, totalDurationSeconds } from "@/lib/orderSchema";

function baseForm() {
  const data = new FormData();
  data.set("band_name", "Band");
  data.set("contact_name", "代表");
  data.set("member_count", "0");
  data.set("equipment_count", "0");
  return data;
}

describe("提出フォームの解析と検証", () => {
  it("必須項目とマイク本数を検証する", () => {
    const data = new FormData();
    data.set("microphone_count", "-1");
    data.set("song_count", "1");
    const { errors } = parseOrderForm(data, { songLimit: 3 });
    expect(errors).toMatchObject({ band_name: expect.any(String), contact_name: expect.any(String), song_0_title: expect.any(String), microphone_count: expect.any(String) });
  });

  it("入力済みの曲は曲名と有効な演奏時間を必須にし、空行は除外する", () => {
    const data = baseForm();
    data.set("song_count", "3");
    data.set("song_0_title", "曲1");
    data.set("song_0_duration_min", "4");
    data.set("song_0_duration_sec", "30");
    data.set("song_2_title", "曲3");
    const { input, errors } = parseOrderForm(data, { songLimit: 5 });
    expect(input.content.songs.map((song) => [song.title, song.durationSeconds, song.order])).toEqual([
      ["曲1", 270, 1],
      ["曲3", null, 2],
    ]);
    expect(errors.song_2_duration_min).toContain("3曲目");
    expect(errors.song_1_title).toBeUndefined();
  });

  it("秒は0〜59、0秒は無効とする", () => {
    expect(durationFromParts("4", "60")).toBe("invalid");
    expect(durationFromParts("0", "0")).toBe("invalid");
    expect(durationFromParts("", "")).toBeNull();
    expect(durationFromParts("3", "")).toBe(180);
  });

  it("ライブの最大曲数を超える曲を拒否する", () => {
    const data = baseForm();
    data.set("song_count", "3");
    for (let index = 0; index < 3; index += 1) {
      data.set(`song_${index}_title`, `曲${index + 1}`);
      data.set(`song_${index}_duration_min`, "3");
    }
    expect(parseOrderForm(data, { songLimit: 2 }).errors.song_count).toContain("2曲");
  });

  it("音源を使う場合は再生担当・端末・接続方法を必須にする", () => {
    const data = baseForm();
    data.set("uses_backing_track", "on");
    data.set("song_count", "1");
    data.set("song_0_title", "曲");
    data.set("song_0_duration_min", "3");
    const { errors, input } = parseOrderForm(data, { songLimit: 3 });
    expect(Object.keys(errors)).toEqual(expect.arrayContaining(["backing_track_operator", "backing_track_device", "backing_track_connection"]));
    expect(input.content.backingTrack).toEqual({ operator: "", device: "", connection: "" });
  });

  it("機材の使用者は入力済みのメンバーだけに紐づける", () => {
    const data = baseForm();
    data.set("member_count", "1");
    data.set("member_0_id", "member_a");
    data.set("member_0_name", "Alice");
    data.set("equipment_count", "2");
    data.set("equipment_0_name", "ボード");
    data.set("equipment_0_member_id", "member_a");
    data.set("equipment_1_name", "鍵盤");
    data.set("equipment_1_member_id", "member_unknown");
    const { input } = parseOrderForm(data, { songLimit: 3 });
    expect(input.content.equipment.map((item) => item.memberId)).toEqual(["member_a", null]);
  });

  it("招待経由ではバンド名をフォームの値ではなく招待から確定する", () => {
    const data = baseForm();
    data.set("band_name", "なりすまし");
    expect(parseOrderForm(data, { songLimit: 3, bandName: "招待のバンド" }).input.content.bandName).toBe("招待のバンド");
  });
});

describe("演奏時間", () => {
  it("旧形式は解釈できる場合だけ秒にし、不正は null（0秒にしない）", () => {
    expect(parseLegacyDuration("4:30")).toBe(270);
    expect(parseLegacyDuration("約4分")).toBeNull();
    expect(parseLegacyDuration("")).toBeNull();
  });

  it("楽曲の合計を計算する（未入力は含めない）", () => {
    expect(formatDuration(totalDurationSeconds([{ durationSeconds: 270 }, { durationSeconds: 225 }, { durationSeconds: null }]))).toBe("8:15");
  });
});
