import { promises as fs } from "fs";
import path from "path";
import { makeId } from "@/lib/orderSchema";
import type { LiveEvent } from "@/types/order";

const dataDir = path.join(process.cwd(), "data");
const dataFile = path.join(dataDir, "live-events.json");

const defaultLiveEvents: LiveEvent[] = [
  {
    id: "default-live",
    name: "通常ライブ",
    createdAt: "2026-05-22T00:00:00.000Z",
  },
];

async function ensureDataFile() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify(defaultLiveEvents, null, 2), "utf8");
  }
}

async function readLiveEvents(): Promise<LiveEvent[]> {
  await ensureDataFile();
  const body = await fs.readFile(dataFile, "utf8");
  const events = JSON.parse(body) as LiveEvent[];
  return events.length > 0 ? events : defaultLiveEvents;
}

async function writeLiveEvents(events: LiveEvent[]) {
  await ensureDataFile();
  await fs.writeFile(dataFile, JSON.stringify(events, null, 2), "utf8");
}

export async function listLiveEvents() {
  return readLiveEvents();
}

export async function getLiveEvent(id: string) {
  const events = await readLiveEvents();
  return events.find((event) => event.id === id) ?? null;
}

export async function createLiveEvent(name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) return null;

  const events = await readLiveEvents();
  const event: LiveEvent = {
    id: makeId("live"),
    name: trimmedName,
    createdAt: new Date().toISOString(),
  };
  await writeLiveEvents([...events, event]);
  return event;
}

export async function deleteLiveEvent(id: string) {
  const events = await readLiveEvents();
  if (events.length <= 1) return false;

  const nextEvents = events.filter((event) => event.id !== id);
  if (nextEvents.length === events.length) return false;

  await writeLiveEvents(nextEvents);
  return true;
}
