"use client";

import { useMemo, useState } from "react";
import { formatDateTime, statusLabels } from "@/lib/format";
import type { LiveEvent, OrderStatus, OrderSummary } from "@/types/order";

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: "new", label: statusLabels.new },
  { value: "reviewing", label: statusLabels.reviewing },
  { value: "done", label: statusLabels.done },
];

export function AdminOrderList({
  liveEvents,
  orders,
}: {
  liveEvents: LiveEvent[];
  orders: OrderSummary[];
}) {
  const [query, setQuery] = useState("");
  const [liveEventId, setLiveEventId] = useState("all");
  const [status, setStatus] = useState<"all" | OrderStatus>("all");

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesQuery =
        !normalizedQuery ||
        [order.bandName, order.contactName, order.liveEventName]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesLiveEvent = liveEventId === "all" || order.liveEventId === liveEventId;
      const matchesStatus = status === "all" || order.status === status;

      return matchesQuery && matchesLiveEvent && matchesStatus;
    });
  }, [liveEventId, orders, query, status]);

  return (
    <section className="section">
      {orders.length === 0 ? (
        <p className="empty">まだ提出はありません。</p>
      ) : (
        <>
          <div className="filter-bar">
            <label className="field">
              <span>検索</span>
              <input
                className="input"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="バンド名・代表者・ライブ名"
                type="search"
                value={query}
              />
            </label>
            <label className="field">
              <span>ライブ</span>
              <select className="select" onChange={(event) => setLiveEventId(event.target.value)} value={liveEventId}>
                <option value="all">すべて</option>
                {liveEvents.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>ステータス</span>
              <select
                className="select"
                onChange={(event) => setStatus(event.target.value as "all" | OrderStatus)}
                value={status}
              >
                <option value="all">すべて</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="result-count">
              <span>表示</span>
              <strong>{filteredOrders.length}件</strong>
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <p className="empty">条件に合う提出はありません。</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ライブ</th>
                    <th>バンド名</th>
                    <th>代表者</th>
                    <th>曲数</th>
                    <th>音源</th>
                    <th>ステータス</th>
                    <th>提出日時</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.liveEventName || "-"}</td>
                      <td>
                        <strong>{order.bandName}</strong>
                      </td>
                      <td>{order.contactName}</td>
                      <td>
                        {order.songCount} / {order.liveEventSongCount || order.songCount}曲
                      </td>
                      <td>{order.usesBackingTrack ? <span className="badge warn">あり</span> : "なし"}</td>
                      <td>
                        <span className={`badge ${order.status === "new" ? "warn" : order.status === "done" ? "done" : ""}`}>
                          {statusLabels[order.status]}
                        </span>
                      </td>
                      <td>{formatDateTime(order.createdAt)}</td>
                      <td>
                        <a className="button secondary" href={`/admin/orders/${order.id}`}>
                          詳細
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
