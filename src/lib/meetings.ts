import type { MeetingAnalysis } from "@/lib/analysis";

export type MeetingStatus = "analyzing" | "ready" | "failed";

export type Meeting = {
  id: number;
  title: string;
  createdAt: Date;
  status: MeetingStatus;
  transcript: string;
  analysis?: MeetingAnalysis | undefined;
};

// Simple in-memory store shared between the home page and workspace route.
let meetings: Meeting[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeMeetings(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMeetingsSnapshot(): Meeting[] {
  return meetings;
}

export function getMeeting(id: number): Meeting | undefined {
  return meetings.find((m) => m.id === id);
}

export function addMeeting(meeting: Omit<Meeting, "status">) {
  meetings = [{ ...meeting, status: "analyzing" }, ...meetings];
  emit();
}

export function setMeetingAnalysis(id: number, analysis: MeetingAnalysis) {
  meetings = meetings.map((m) =>
    m.id === id ? { ...m, analysis, status: "ready" } : m
  );
  emit();
}

export function setMeetingAnalyzing(id: number) {
  meetings = meetings.map((m) =>
    m.id === id ? { ...m, status: "analyzing" } : m
  );
  emit();
}

export function setMeetingFailed(id: number) {
  meetings = meetings.map((m) =>
    m.id === id ? { ...m, status: "failed" } : m
  );
  emit();
}
