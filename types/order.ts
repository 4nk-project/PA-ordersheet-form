export type OrderStatus = "new" | "reviewing" | "done";

export type Member = {
  id: string;
  name: string;
  instrument: string;
};

export type Song = {
  id: string;
  order: number;
  title: string;
  duration: string;
  mood: string;
  startTrigger: string;
  paRequest: string;
  mc: {
    hasMc: boolean;
    person: string;
  };
};

export type Equipment = {
  id: string;
  name: string;
  instrument: string;
};

export type LiveEvent = {
  id: string;
  name: string;
  songCount: number;
  createdAt: string;
};

export type PAOrder = {
  id: string;
  editToken: string;
  liveEventId: string;
  liveEventName: string;
  liveEventSongCount: number;
  bandName: string;
  contactName: string;
  microphoneCount: number;
  usesBackingTrack: boolean;
  members: Member[];
  songs: Song[];
  equipment: Equipment[];
  generalRequest: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export type OrderSummary = {
  id: string;
  editToken?: string;
  liveEventId: string;
  liveEventName: string;
  liveEventSongCount: number;
  bandName: string;
  contactName: string;
  songCount: number;
  usesBackingTrack: boolean;
  status: OrderStatus;
  createdAt: string;
};
