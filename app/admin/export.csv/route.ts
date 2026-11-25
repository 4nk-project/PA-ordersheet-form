import { NextResponse } from "next/server";
import { listOrders } from "@/lib/orders";
import { submissionStateLabels, submissionStateOf } from "@/lib/orderStatus";
import { formatDuration, totalDurationSeconds } from "@/lib/orderSchema";
import { isAdminSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

function csv(value: string | number | boolean | null) {
  const text = String(value ?? "");
  // 表計算ソフトでの数式実行を防ぐ
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET() {
  if (!(await isAdminSession())) return new NextResponse("Unauthorized", { status: 401 });
  const orders = await listOrders();
  const rows = [
    ["提出日時", "確認状態", "内容の版", "確認済みの版", "演者の最終更新", "運営の最終編集", "ライブ", "ライブ設定曲数", "出演順", "バンド名", "代表者", "提出曲数", "楽曲の合計", "マイク本数", "音源使用", "音源の再生担当", "音源の再生端末", "音源の接続方法", "全体要望"],
    ...orders.map((order) => [
      order.createdAt,
      submissionStateLabels[submissionStateOf(order)],
      order.contentRevision,
      order.reviewedRevision ?? "",
      order.submitterUpdatedAt,
      order.adminUpdatedAt ?? "",
      order.liveEventName,
      order.liveEventSongCount ?? order.songs.length,
      order.performanceOrder ?? "",
      order.bandName,
      order.contactName,
      order.songs.length,
      formatDuration(totalDurationSeconds(order.songs)),
      order.microphoneCount,
      order.usesBackingTrack ? "あり" : "なし",
      order.usesBackingTrack ? order.backingTrack.operator : "",
      order.usesBackingTrack ? order.backingTrack.device : "",
      order.usesBackingTrack ? order.backingTrack.connection : "",
      order.generalRequest,
    ]),
  ];
  const body = rows.map((row) => row.map(csv).join(",")).join("\n");
  return new NextResponse(`﻿${body}`, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="pa-orders.csv"', "Cache-Control": "no-store" },
  });
}
