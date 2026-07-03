import { assertD1Result, getD1Database } from "@/lib/d1/server";
import { makeId } from "@/lib/orderSchema";
import type { AdminComment } from "@/types/order";

type CommentRow = {
  author_name: string;
  body: string;
  created_at: string;
  id: string;
};

function fromRow(row: CommentRow): AdminComment {
  return {
    id: row.id,
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
  };
}

function normalizeComment(authorName: string, body: string) {
  return {
    authorName: authorName.trim(),
    body: body.trim(),
  };
}

export async function listLiveEventComments(liveEventId: string) {
  if (!liveEventId) return [];

  const db = getD1Database();
  const result = await db
    .prepare("select id, author_name, body, created_at from live_event_comments where live_event_id = ? order by created_at desc")
    .bind(liveEventId)
    .all<CommentRow>();
  assertD1Result(result, "Failed to fetch live event comments");

  return (result.results || []).map(fromRow);
}

export async function listOrderComments(orderId: string) {
  if (!orderId) return [];

  const db = getD1Database();
  const result = await db
    .prepare("select id, author_name, body, created_at from order_comments where order_id = ? order by created_at desc")
    .bind(orderId)
    .all<CommentRow>();
  assertD1Result(result, "Failed to fetch order comments");

  return (result.results || []).map(fromRow);
}

export async function createLiveEventComment(liveEventId: string, authorName: string, body: string) {
  const comment = normalizeComment(authorName, body);
  if (!liveEventId || !comment.authorName || !comment.body) return null;

  const db = getD1Database();
  const row = {
    id: makeId("live_comment"),
    liveEventId,
    authorName: comment.authorName,
    body: comment.body,
    createdAt: new Date().toISOString(),
  };
  const result = await db
    .prepare("insert into live_event_comments (id, live_event_id, author_name, body, created_at) values (?, ?, ?, ?, ?)")
    .bind(row.id, row.liveEventId, row.authorName, row.body, row.createdAt)
    .run();
  assertD1Result(result, "Failed to create live event comment");

  return row;
}

export async function createOrderComment(orderId: string, authorName: string, body: string) {
  const comment = normalizeComment(authorName, body);
  if (!orderId || !comment.authorName || !comment.body) return null;

  const db = getD1Database();
  const row = {
    id: makeId("order_comment"),
    orderId,
    authorName: comment.authorName,
    body: comment.body,
    createdAt: new Date().toISOString(),
  };
  const result = await db
    .prepare("insert into order_comments (id, order_id, author_name, body, created_at) values (?, ?, ?, ?, ?)")
    .bind(row.id, row.orderId, row.authorName, row.body, row.createdAt)
    .run();
  assertD1Result(result, "Failed to create order comment");

  return row;
}
