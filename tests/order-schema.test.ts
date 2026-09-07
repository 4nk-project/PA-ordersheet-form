import { describe, expect, it } from "vitest";
import { compactSongs, formatDuration, makeEmptySongs, orderFromFormData, totalDurationSeconds, validateOrderFields } from "@/lib/orderSchema";

describe("注文バリデーション", () => {
  it("必須項目とマイク本数を検証する", () => {
    const data = new FormData();
    data.set("microphone_count", "-1");
    data.set("song_count", "1");
    const errors = validateOrderFields(orderFromFormData(data, 3));
    expect(errors).toMatchObject({ live_event_id: expect.any(String), band_name: expect.any(String), contact_name: expect.any(String), song_0_title: expect.any(String), microphone_count: expect.any(String) });
  });

  it("ライブの最大曲数を超える曲を拒否する", () => {
    const data = new FormData();
    data.set("live_event_id", "live-1"); data.set("band_name", "Band"); data.set("contact_name", "代表"); data.set("song_count", "3");
    for (let index = 0; index < 3; index += 1) data.set(`song_${index}_title`, `曲${index + 1}`);
    expect(validateOrderFields(orderFromFormData(data, 2)).song_count).toContain("2曲");
  });
});

describe("曲データの処理", () => {
  it("空の曲を除外し、曲順を詰める", () => {
    const songs = makeEmptySongs(3);
    songs[1].title = "残す曲";
    expect(compactSongs(songs)).toMatchObject([{ title: "残す曲", order: 1 }]);
  });

  it("合計演奏時間を計算する", () => {
    expect(formatDuration(totalDurationSeconds([{ duration: "4:30" }, { duration: "3:45" }]))).toBe("8:15");
  });
});
