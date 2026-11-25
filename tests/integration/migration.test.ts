// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase } from "../helpers/d1";
import { getOrderByEditToken, getOrderRevision } from "@/lib/orders";
import { listAdminEntries } from "@/lib/entries";

let env: Awaited<ReturnType<typeof createTestDatabase>>;

beforeAll(async () => {
  env = await createTestDatabase({
    upTo: "0003_add_admin_comments.sql",
    seed: async (db) => {
      await db.batch([
        db.prepare("insert into live_events (id, name, song_count, created_at) values ('live_old', '春ライブ', 5, '2026-04-01 10:00:00')"),
        db.prepare("insert into orders (id, edit_token, live_event_id, live_event_name, live_event_song_count, performance_order, band_name, contact_name, microphone_count, uses_backing_track, general_request, status, created_at, updated_at) values ('ord_a1', 'edit_aaa', 'live_old', '春ライブ', 5, 2, 'バンドA', '代表A', 2, 1, '全体', 'done', '2026-04-02 10:00:00', '2026-04-03 10:00:00')"),
        db.prepare("insert into orders (id, edit_token, live_event_id, live_event_name, live_event_song_count, performance_order, band_name, contact_name, microphone_count, uses_backing_track, general_request, status, created_at, updated_at) values ('ord_b2', 'edit_bbb', 'live_old', '春ライブ', 5, 1, 'バンドB', '代表B', 0, 0, null, 'new', '2026-04-02 11:00:00', '2026-04-02 11:00:00')"),
        db.prepare("insert into members (id, order_id, name, instrument, position) values ('ord_a1_member-1', 'ord_a1', 'A1', 'Vo', 0)"),
        db.prepare("insert into songs (id, order_id, song_order, title, duration, mood, start_trigger, pa_request, has_mc, mc_person) values ('ord_a1_song-1', 'ord_a1', 1, '曲1', '4:30', '', '', '', 1, 'A1'), ('ord_a1_song-2', 'ord_a1', 2, '曲2', '約4分', '', '', '', 0, '')"),
      ]);
    },
  });
}, 60_000);

afterAll(async () => {
  await env?.dispose();
});

describe("既存提出の移行（A27）", () => {
  it("件数・内容・編集リンク・出演順を保ち、版1と確認済みを設定する", async () => {
    const entries = await listAdminEntries("live_old");
    expect(entries.map((row) => [row.entry.bandName, row.entry.initialPerformanceOrder])).toEqual([
      ["バンドB", 1],
      ["バンドA", 2],
    ]);
    const a = (await getOrderByEditToken("edit_aaa"))!;
    expect(a.entryId).toBe("ent_ord_a1");
    expect(a.contentRevision).toBe(1);
    expect(a.reviewedRevision).toBe(1);
    expect(a.songs.map((song) => song.durationSeconds)).toEqual([270, null]);
    expect(a.songs[1].duration).toBe("約4分");
    const b = (await getOrderByEditToken("edit_bbb"))!;
    expect(b.reviewedRevision).toBeNull();
    const revision = await getOrderRevision("ord_a1", 1);
    expect(revision?.actor).toBe("migration");
    expect(revision?.content.songs.map((song) => song.durationSeconds)).toEqual([270, null]);
    expect(revision?.content.backingTrack).toEqual({ operator: "", device: "", connection: "" });
  });

  it("提出とエントリーのライブが食い違う書き込みをDBが拒否する", async () => {
    await env.db.prepare("insert into live_events (id, name, song_count, created_at) values ('live_other', '別', 5, '2026-04-01 10:00:00')").run();
    await expect(env.db.prepare("update orders set live_event_id = 'live_other' where id = 'ord_a1'").run()).rejects.toThrow();
  });
});
