import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderForm } from "@/app/order-form";
import { submitInviteOrder, updateSubmittedOrder } from "@/app/actions";
import type { LiveEvent, PAOrder } from "@/types/order";
import { draftKey } from "@/lib/draft";

vi.mock("@/app/actions", () => ({
  submitOrder: vi.fn(async () => ({ fieldErrors: {} })),
  submitInviteOrder: vi.fn(async () => ({ fieldErrors: {} })),
  updateSubmittedOrder: vi.fn(async () => ({ fieldErrors: {} })),
  updateAdminOrder: vi.fn(async () => ({ fieldErrors: {} })),
}));

const liveEvent: LiveEvent = {
  id: "live-1",
  name: "春ライブ",
  songCount: 4,
  createdAt: "2026-01-01T00:00:00.000Z",
  eventDate: "2026-04-01",
  timeZone: "Asia/Tokyo",
  submissionDeadlineAt: null,
  submissionsOpen: true,
  inviteRequired: true,
  revision: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const liveEvents: LiveEvent[] = [{ ...liveEvent, inviteRequired: false }];
const order: PAOrder = {
  id: "order-1",
  editToken: "edit-token",
  entryId: "ent_1",
  liveEventId: "live-1",
  liveEventName: "春ライブ",
  liveEventSongCount: 4,
  performanceOrder: null,
  bandName: "テストバンド",
  contactName: "代表者",
  microphoneCount: 2,
  usesBackingTrack: false,
  backingTrack: { operator: "", device: "", connection: "" },
  members: [{ id: "m1", name: "Alice", instrument: "Vo" }],
  equipment: [],
  songs: [{ id: "s1", order: 1, title: "Opening", durationSeconds: 270, duration: "4:30", mood: "Rock", startTrigger: "ドラム4カウント", paRequest: "", mc: { hasMc: false, person: "" } }],
  generalRequest: "",
  status: "new",
  contentRevision: 3,
  reviewedRevision: null,
  reviewedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  submitterUpdatedAt: "2026-01-01T00:00:00.000Z",
  adminUpdatedAt: null,
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

function stepButton(index: number) {
  return document.querySelectorAll<HTMLButtonElement>(".step-button")[index];
}

function renderInvite(props: Partial<Parameters<typeof OrderForm>[0]> = {}) {
  return render(<OrderForm mode="invite" liveEvent={liveEvent} entry={{ id: "ent_1", bandName: "テストバンド" }} order={order} inviteToken="token-abc" {...props} />);
}

describe("PAオーダーフォーム", () => {
  it("招待経由ではライブとバンド名を確定表示し、選び直させない（A01）", () => {
    renderInvite();
    expect(screen.queryByRole("textbox", { name: /バンド名/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("春ライブ").length).toBeGreaterThan(0);
    expect(document.querySelector<HTMLInputElement>('input[name="band_name"]')?.value).toBe("テストバンド");
    expect(document.querySelector<HTMLInputElement>('input[name="expected_revision"]')?.value).toBe("3");
  });

  it("メンバーを追加・削除できる", async () => {
    const user = userEvent.setup();
    renderInvite();
    await user.click(stepButton(1));
    await user.click(screen.getByRole("button", { name: "メンバーを追加" }));
    expect(document.querySelectorAll('input[name^="member_"][name$="_name"]')).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "2人目のメンバーを削除" }));
    expect(document.querySelectorAll('input[name^="member_"][name$="_name"]')).toHaveLength(1);
  });

  it("曲をボタンで追加・並べ替え・削除できる（ドラッグ不要）", async () => {
    const user = userEvent.setup();
    renderInvite();
    await user.click(stepButton(2));
    await user.click(screen.getByRole("button", { name: "曲を追加" }));
    expect(document.querySelectorAll(".song-card")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "2曲目を上へ" }));
    expect(document.querySelector<HTMLInputElement>('input[name="song_1_title"]')?.value).toBe("Opening");
    await user.click(screen.getByRole("button", { name: "1曲目を削除" }));
    expect(document.querySelectorAll(".song-card")).toHaveLength(1);
  });

  it("演奏時間を分・秒で入力し、楽曲の合計をMC・転換と区別して表示する", async () => {
    const user = userEvent.setup();
    renderInvite();
    await user.click(stepButton(2));
    expect(screen.getByLabelText("1曲目の演奏時間（分）")).toHaveValue("4");
    expect(screen.getByLabelText("1曲目の演奏時間（秒）")).toHaveValue("30");
    expect(screen.getByText("楽曲の合計（MC・転換は含みません）")).toBeInTheDocument();
  });

  it("MCを選んだ曲だけ担当欄を表示する", async () => {
    const user = userEvent.setup();
    renderInvite();
    await user.click(stepButton(2));
    expect(screen.queryByLabelText(/MC担当/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "この曲の後にMCあり" }));
    expect(screen.getByLabelText(/MC担当/)).toBeInTheDocument();
  });

  it("音源ありの場合だけ再生担当・端末・接続方法の欄を開く", async () => {
    const user = userEvent.setup();
    renderInvite();
    await user.click(stepButton(1));
    expect(screen.queryByLabelText(/再生担当/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "音源を使用する" }));
    expect(screen.getByLabelText(/再生担当/)).toBeInTheDocument();
    expect(screen.getByLabelText(/再生端末/)).toBeInTheDocument();
    expect(screen.getByLabelText(/接続方法/)).toBeInTheDocument();
  });

  it("次へ進む前にその画面の必須項目を確認し、該当項目へフォーカスする", async () => {
    const user = userEvent.setup();
    renderInvite();
    const contact = screen.getByRole("textbox", { name: /代表者名/ });
    await user.clear(contact);
    await user.click(screen.getByRole("button", { name: "次へ" }));
    expect((await screen.findAllByText("代表者名を入力してください。")).length).toBeGreaterThan(0);
    await vi.waitFor(() => expect(document.activeElement).toBe(contact));
    expect(document.querySelector('[aria-labelledby="step-1-title"]')).not.toHaveAttribute("hidden");
  });

  it("ステップ移動後も入力値を保持する", async () => {
    const user = userEvent.setup();
    render(<OrderForm mode="submitter" liveEvent={liveEvent} order={order} />);
    const band = screen.getByRole("textbox", { name: /バンド名/ });
    await user.clear(band);
    await user.type(band, "変更後バンド");
    await user.click(stepButton(1));
    await user.click(stepButton(0));
    expect(screen.getByRole("textbox", { name: /バンド名/ })).toHaveValue("変更後バンド");
  });

  it("確認画面にエラー概要を表示する", async () => {
    render(<OrderForm liveEvents={liveEvents} />);
    fireEvent.click(stepButton(3));
    expect(screen.getByRole("alert")).toHaveTextContent("ライブを選択してください");
    expect(screen.getByRole("alert")).toHaveTextContent("少なくとも1曲");
  });

  it("送信中は二重送信を防ぐ", async () => {
    vi.mocked(updateSubmittedOrder).mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ fieldErrors: {} }), 200)));
    const user = userEvent.setup();
    render(<OrderForm mode="submitter" liveEvent={liveEvent} order={order} />);
    await user.click(stepButton(3));
    const submit = screen.getByRole("button", { name: "この内容で更新する" });
    await user.click(submit);
    await user.click(submit);
    expect(updateSubmittedOrder).toHaveBeenCalledTimes(1);
    // 保留中の送信を残すと後続テストの transition が完了しないため、完了まで待つ
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "この内容で更新する" })).not.toBeDisabled());
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it("変更せずに再送する場合は同じ submissionId、内容を変えたら新しいIDを使う（A04）", async () => {
    vi.mocked(submitInviteOrder).mockImplementation(async () => ({ fieldErrors: {}, formError: "送信できませんでした。" }));
    const user = userEvent.setup();
    renderInvite();
    const idBefore = document.querySelector<HTMLInputElement>('input[name="submission_id"]')?.value;
    await user.click(stepButton(3));
    await user.click(screen.getByRole("button", { name: "この内容で更新する" }));
    await vi.waitFor(() => expect(submitInviteOrder).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(document.querySelector(".error")).toHaveTextContent("送信できませんでした。"));
    expect(document.querySelector<HTMLInputElement>('input[name="submission_id"]')?.value).toBe(idBefore);
    await user.click(stepButton(0));
    await user.type(screen.getByRole("textbox", { name: /代表者名/ }), "2");
    expect(document.querySelector<HTMLInputElement>('input[name="submission_id"]')?.value).not.toBe(idBefore);
  });

  it("下書きはライブ＋エントリー単位で、他のバンドの下書きを復元しない（A05）", async () => {
    const value = { step: 0, baseRevision: 3, model: { liveEventId: "live-1", bandName: "テストバンド", contactName: "別バンドの代表", microphoneCount: 1, usesBackingTrack: false, backingTrack: { operator: "", device: "", connection: "" }, members: [], equipment: [], songs: [], generalRequest: "" } };
    localStorage.setItem(draftKey("live-1", "ent_other"), JSON.stringify({ savedAt: Date.now(), value }));
    localStorage.setItem("pa-order-sheet-draft-v2", JSON.stringify({ savedAt: Date.now(), value }));
    renderInvite();
    expect(screen.queryByRole("button", { name: "入力途中の内容を復元" })).not.toBeInTheDocument();
    expect(localStorage.getItem("pa-order-sheet-draft-v2")).toBeNull();
    cleanup();

    localStorage.setItem(draftKey("live-1", "ent_1"), JSON.stringify({ savedAt: Date.now(), value: { ...value, model: { ...value.model, contactName: "下書きの代表" } } }));
    const user = userEvent.setup();
    renderInvite();
    expect(await screen.findByText(/この端末に保存された入力途中の内容があります/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "入力途中の内容を復元" }));
    expect(screen.getByRole("textbox", { name: /代表者名/ })).toHaveValue("下書きの代表");
  });

  it("自動保存は「この端末に保存」と表示し、運営に届いていないことを示す", () => {
    renderInvite();
    expect(screen.getByText("入力内容はこの端末に自動保存されます")).toBeInTheDocument();
    expect(screen.getByText(/運営には届いていません/)).toBeInTheDocument();
  });
});
