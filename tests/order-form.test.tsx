import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderForm } from "@/app/order-form";
import { updateSubmittedOrder } from "@/app/actions";
import type { LiveEvent, PAOrder } from "@/types/order";
import { ORDER_DRAFT_KEY } from "@/lib/draft";

vi.mock("@/app/actions", () => ({
  initialOrderActionState: { fieldErrors: {} },
  submitOrder: vi.fn(async () => ({ fieldErrors: {} })),
  updateSubmittedOrder: vi.fn(async () => ({ fieldErrors: {} })),
  updateAdminOrder: vi.fn(async () => ({ fieldErrors: {} })),
}));

const liveEvents: LiveEvent[] = [{ id: "live-1", name: "春ライブ", songCount: 4, createdAt: "2026-01-01T00:00:00Z" }];
const order: PAOrder = {
  id: "order-1", editToken: "edit-token", liveEventId: "live-1", liveEventName: "春ライブ", liveEventSongCount: 4,
  performanceOrder: null, bandName: "テストバンド", contactName: "代表者", microphoneCount: 2, usesBackingTrack: false,
  members: [{ id: "m1", name: "Alice", instrument: "Vo" }], equipment: [],
  songs: [{ id: "s1", order: 1, title: "Opening", duration: "4:30", mood: "Rock", startTrigger: "ドラム4カウント", paRequest: "", mc: { hasMc: false, person: "" } }],
  generalRequest: "", status: "new", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

afterEach(() => { cleanup(); localStorage.clear(); });

function stepButton(index: number) { return document.querySelectorAll<HTMLButtonElement>(".step-button")[index]; }

describe("PAオーダーフォーム", () => {
  it("メンバーを追加・削除できる", async () => {
    const user = userEvent.setup(); render(<OrderForm liveEvents={liveEvents} mode="submitter" order={order} />); await user.click(stepButton(1));
    await user.click(screen.getByRole("button", { name: "メンバーを追加" }));
    expect(document.querySelectorAll('input[name^="member_"][name$="_name"]')).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "2人目のメンバーを削除" }));
    expect(document.querySelectorAll('input[name^="member_"][name$="_name"]')).toHaveLength(1);
  });

  it("曲を追加・並べ替え・削除できる", async () => {
    const user = userEvent.setup(); render(<OrderForm liveEvents={liveEvents} mode="submitter" order={order} />); await user.click(stepButton(2));
    await user.click(screen.getByRole("button", { name: "曲を追加" }));
    expect(document.querySelectorAll(".song-card")).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "上へ" })[1]);
    await user.click(screen.getByRole("button", { name: "2曲目を削除" }));
    expect(document.querySelectorAll(".song-card")).toHaveLength(1);
  });

  it("MCを選んだ曲だけ担当欄を表示する", async () => {
    const user = userEvent.setup(); render(<OrderForm liveEvents={liveEvents} mode="submitter" order={order} />); await user.click(stepButton(2));
    expect(screen.queryByLabelText(/MC担当/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "この曲の後にMCあり" }));
    expect(screen.getByLabelText(/MC担当/)).toBeInTheDocument();
  });

  it("ステップ移動後も入力値を保持する", async () => {
    const user = userEvent.setup(); render(<OrderForm liveEvents={liveEvents} mode="submitter" order={order} />);
    const band = screen.getByRole("textbox", { name: /バンド名/ }); await user.clear(band); await user.type(band, "変更後バンド");
    await user.click(stepButton(1)); await user.click(stepButton(0));
    expect(screen.getByRole("textbox", { name: /バンド名/ })).toHaveValue("変更後バンド");
  });

  it("確認画面にエラー概要を表示する", async () => {
    render(<OrderForm liveEvents={liveEvents} />); fireEvent.click(stepButton(3));
    expect(screen.getByRole("alert")).toHaveTextContent("ライブを選択してください");
    expect(screen.getByRole("alert")).toHaveTextContent("1曲目の曲名を入力してください");
  });

  it("送信中は二重送信を防ぐ", async () => {
    vi.mocked(updateSubmittedOrder).mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup(); render(<OrderForm liveEvents={liveEvents} mode="submitter" order={order} />); await user.click(stepButton(3));
    const submit = screen.getByRole("button", { name: "更新する" });
    await user.click(submit); await user.click(submit);
    expect(updateSubmittedOrder).toHaveBeenCalledTimes(1);
  });

  it("保存期限内の下書きを確認後に復元する", async () => {
    localStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify({ savedAt: Date.now(), value: { step: 0, model: { liveEventId: "live-1", bandName: "下書きバンド", contactName: "下書き代表", microphoneCount: 1, usesBackingTrack: false, members: [], equipment: [], songs: order.songs, generalRequest: "" } } }));
    const user = userEvent.setup(); render(<OrderForm liveEvents={liveEvents} />);
    await user.click(await screen.findByRole("button", { name: "下書きを復元" }));
    expect(screen.getByRole("textbox", { name: /バンド名/ })).toHaveValue("下書きバンド");
  });
});
