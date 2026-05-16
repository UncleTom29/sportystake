// In-process pub/sub event bus. Used by API routes to broadcast over SSE.
// Survives across hot reloads via globalThis.

export type EventTopic =
  | "odds:update"
  | "market:update"
  | "market:live"
  | "market:finished"
  | "bet:confirmed"
  | "bet:settled"
  | "bet:cancelled"
  | "lp:settled"
  | "lp:deposit"
  | "feed:new"
  | "quota:alert"
  | "crash:state"
  | "casino:win"
  | "notification";

export interface BusEvent {
  topic: EventTopic;
  payload: unknown;
  at: number;
}

type Listener = (e: BusEvent) => void;

interface BusState {
  listeners: Map<string, Set<Listener>>;
}

declare global {

  var __ss_bus__: BusState | undefined;
}

function getState(): BusState {
  if (!globalThis.__ss_bus__) {
    globalThis.__ss_bus__ = { listeners: new Map() };
  }
  return globalThis.__ss_bus__;
}

export function publish(topic: EventTopic, payload: unknown): void {
  const state = getState();
  const evt: BusEvent = { topic, payload, at: Date.now() };
  const set = state.listeners.get(topic);
  if (set) for (const fn of set) fn(evt);
  const wild = state.listeners.get("*");
  if (wild) for (const fn of wild) fn(evt);
}

export function subscribe(topics: EventTopic[] | "*", cb: Listener): () => void {
  const state = getState();
  const toAdd = topics === "*" ? ["*"] : topics;
  for (const t of toAdd) {
    let set = state.listeners.get(t);
    if (!set) {
      set = new Set();
      state.listeners.set(t, set);
    }
    set.add(cb);
  }
  return () => {
    for (const t of toAdd) {
      const set = state.listeners.get(t);
      set?.delete(cb);
    }
  };
}
