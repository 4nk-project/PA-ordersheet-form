import { promises as fs } from "fs";
import path from "path";
import type { OrderStatus, OrderSummary, PAOrder } from "@/types/order";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "orders.json");

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, "[]", "utf8");
  }
}

async function readOrders(): Promise<PAOrder[]> {
  await ensureDataFile();
  const body = await fs.readFile(dataFile, "utf8");
  return JSON.parse(body) as PAOrder[];
}

async function writeOrders(orders: PAOrder[]) {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify(orders, null, 2), "utf8");
}

export async function createOrder(order: PAOrder) {
  const orders = await readOrders();
  await writeOrders([order, ...orders]);
  return order;
}

export async function listOrderSummaries(): Promise<OrderSummary[]> {
  const orders = await readOrders();
  return orders.map((order) => ({
    id: order.id,
    editToken: order.editToken,
    liveEventId: order.liveEventId,
    liveEventName: order.liveEventName,
    liveEventSongCount: order.liveEventSongCount ?? order.songs.length,
    bandName: order.bandName,
    contactName: order.contactName,
    songCount: order.songs.length,
    usesBackingTrack: order.usesBackingTrack,
    status: order.status,
    createdAt: order.createdAt,
  }));
}

export async function getOrder(id: string) {
  const orders = await readOrders();
  return orders.find((order) => order.id === id) ?? null;
}

export async function getOrderByEditToken(editToken: string) {
  const orders = await readOrders();
  return orders.find((order) => order.editToken === editToken) ?? null;
}

export async function updateOrderByEditToken(editToken: string, nextOrder: PAOrder) {
  const orders = await readOrders();
  let updatedOrder: PAOrder | null = null;
  const nextOrders = orders.map((order) => {
    if (order.editToken !== editToken) return order;

    updatedOrder = {
      ...nextOrder,
      id: order.id,
      editToken: order.editToken,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: new Date().toISOString(),
    };
    return updatedOrder;
  });

  await writeOrders(nextOrders);
  return updatedOrder;
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const orders = await readOrders();
  const nextOrders = orders.map((order) =>
    order.id === id ? { ...order, status, updatedAt: new Date().toISOString() } : order,
  );
  await writeOrders(nextOrders);
}

export async function deleteOrder(id: string) {
  const orders = await readOrders();
  await writeOrders(orders.filter((order) => order.id !== id));
}

export async function listOrders() {
  return readOrders();
}
