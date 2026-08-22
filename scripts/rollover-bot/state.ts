import fs from "fs";
import path from "path";
import type { RolloverState } from "./types";

const STATE_DIR = path.join(__dirname, "state");
const STATE_FILE = path.join(STATE_DIR, "rollover-state.json");

const EMPTY_STATE: RolloverState = {
  status: "idle",
  day: 0,
  baseStakeUnits: 1,
  bankrollUnits: 0,
  history: [],
};

export function loadState(): RolloverState {
  if (!fs.existsSync(STATE_FILE)) return { ...EMPTY_STATE, history: [] };
  const raw = fs.readFileSync(STATE_FILE, "utf-8");
  return JSON.parse(raw) as RolloverState;
}

export function saveState(state: RolloverState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
