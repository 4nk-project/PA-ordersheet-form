import { NextResponse } from "next/server";
import { listOrders } from "@/lib/orders";
import { statusLabels } from "@/lib/format";

export const dynamic = "force-dynamic";

function csv(value: string | number | boolean) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  const orders = await listOrders();
  const rows = [
    [
      "提出日時",
      "ステータス",
      "ライブ",
      "ライブ設定曲数",
      "バンド名",
      "代表者",
      "提出曲数",
      "マイク本数",
      "音源使用",
      "全体要望",
    ],
    ...orders.map((order) => [
      order.createdAt,
      statusLabels[order.status],
      order.liveEventName,
      order.liveEventSongCount ?? order.songs.length,
      order.bandName,
      order.contactName,
      order.songs.length,
      order.microphoneCount,
      order.usesBackingTrack ? "あり" : "なし",
      order.generalRequest,
    ]),
  ];

  const body = rows.map((row) => row.map(csv).join(",")).join("\n");

  return new NextResponse(`\uFEFF${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pa-orders.csv"',
    },
  });
}
