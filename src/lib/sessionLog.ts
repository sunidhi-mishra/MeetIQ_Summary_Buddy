export type LogCallType = "CALL 1" | "CALL 2";
export type LogStatus = "SUCCESS" | "FAILED";

export type LogEntry = {
  id: string;
  timestamp: Date;
  callType: LogCallType;
  status: LogStatus;
  description: string;
  responseTime: number; // milliseconds
};

let entries: LogEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function subscribeSessionLog(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSessionLogSnapshot(): LogEntry[] {
  return entries;
}

export function addLogEntry(
  entry: Omit<LogEntry, "id" | "timestamp">
) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  entries = [{ ...entry, id, timestamp: new Date() }, ...entries];
  emit();
}

export function clearSessionLog() {
  entries = [];
  emit();
}
