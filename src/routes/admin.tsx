import { createFileRoute } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { format } from "date-fns";
import { FileText, Terminal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  subscribeSessionLog,
  getSessionLogSnapshot,
  type LogEntry,
} from "@/lib/sessionLog";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin - MeetIQ" },
      {
        name: "description",
        content: "MeetIQ admin panel for system prompts and session logs.",
      },
      { property: "og:title", content: "Admin - MeetIQ" },
      {
        property: "og:description",
        content: "MeetIQ admin panel for system prompts and session logs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type PromptBlock = {
  num: number;
  name: string;
  content: string;
};

const CALL_1_BLOCKS: PromptBlock[] = [
  {
    num: 1,
    name: "Identity",
    content:
      "You are MeetIQ, a meeting accountability engine built into the MeetIQ product.",
  },
  {
    num: 2,
    name: "Behaviour",
    content:
      "Precise, neutral, evidence-based. Never infer beyond what was explicitly said. Never fabricate owners, dates, or commitments.",
  },
  {
    num: 3,
    name: "Task",
    content:
      "Analyse a meeting transcript and return a single structured JSON object covering summary, decisions, action items, transcript moments, and commitment classification.",
  },
  {
    num: 4,
    name: "Tools",
    content: "Not used in this call",
  },
  {
    num: 5,
    name: "Constraints",
    content:
      "Commitment type must be exactly CONFIRMED, ORPHANED, or PASSING. Speaker must be who proposed the commitment, not who chaired the meeting. If owner is unknown, set null. If date is unknown, set null. Return raw JSON only — no markdown, no code fences.",
  },
  {
    num: 6,
    name: "Output",
    content:
      "Single valid JSON object with keys: summary, action_items, transcript_moments, commitments.",
  },
  {
    num: 7,
    name: "Failure",
    content:
      "If owner not stated, set null. If date not stated, set null. Ambiguous commitments → ORPHANED not CONFIRMED. Never guess.",
  },
  {
    num: 8,
    name: "Examples",
    content:
      'CONFIRMED: "I\'ll own the onboarding copy by Sep 24" → owner: Sarah Chen, confidence: 90. ORPHANED: "Someone should own the checklist" → owner: null, confidence: 58. PASSING: "We should think about trial migration" → confidence: 35.',
  },
];

const CALL_2_BLOCKS: PromptBlock[] = [
  {
    num: 1,
    name: "Identity",
    content:
      "You are MeetIQ, answering questions about a specific meeting on behalf of the MeetIQ product.",
  },
  {
    num: 2,
    name: "Behaviour",
    content:
      "Concise, grounded, citation-first. Always reference the speaker and timestamp. Never speculate.",
  },
  {
    num: 3,
    name: "Task",
    content:
      "Answer the user's question using only the meeting transcript and analysis provided in context.",
  },
  {
    num: 4,
    name: "Tools",
    content: "Not used in this call",
  },
  {
    num: 5,
    name: "Constraints",
    content:
      "2-4 sentences maximum. Only use information present in the transcript. Do not answer from general knowledge.",
  },
  {
    num: 6,
    name: "Output",
    content: "Plain prose answer with speaker name and timestamp cited inline.",
  },
  {
    num: 7,
    name: "Failure",
    content:
      'If the answer is not in the transcript, respond with exactly: "This wasn\'t discussed in the meeting."',
  },
  {
    num: 8,
    name: "Examples",
    content:
      'Q: "Who owns the pricing update?" → A: "Aisha Patel owns the pricing page update, committed at 10:21 AM with a due date of September 25th."',
  },
];

function BlockCard({ block }: { block: PromptBlock }) {
  const isTools = block.num === 4;
  const headerColor =
    block.num <= 3
      ? "text-[#3B82F6]"
      : block.num === 4
        ? "text-muted-foreground"
        : "text-purple-600";

  return (
    <div
      className={`rounded-xl border bg-card p-4 shadow-sm ${
        isTools ? "border-dashed border-border" : "border-border"
      }`}
    >
      <h3
        className={`mb-2 text-[11px] font-bold uppercase tracking-[0.15em] ${headerColor}`}
      >
        {block.num} {block.name}
      </h3>
      <p
        className={`text-sm leading-relaxed text-foreground ${
          isTools ? "italic text-muted-foreground" : ""
        }`}
      >
        {block.content}
      </p>
    </div>
  );
}

function PromptSection({
  label,
  badge,
  badgeTone,
  blocks,
}: {
  label: string;
  badge: string;
  badgeTone: "blue" | "purple";
  blocks: PromptBlock[];
}) {
  const badgeClasses =
    badgeTone === "blue"
      ? "bg-blue-100 text-blue-700"
      : "bg-purple-100 text-purple-700";

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          {label}
        </h2>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badgeClasses}`}
        >
          {badge}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {blocks.map((block) => (
          <BlockCard key={block.num} block={block} />
        ))}
      </div>
    </section>
  );
}

function CallBadge({ type }: { type: LogEntry["callType"] }) {
  const classes =
    type === "CALL 1"
      ? "bg-blue-100 text-blue-700"
      : "bg-emerald-100 text-emerald-700";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${classes}`}
    >
      {type}
    </span>
  );
}

function StatusBadge({ status }: { status: LogEntry["status"] }) {
  const classes =
    status === "SUCCESS"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-red-100 text-red-700";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${classes}`}
    >
      {status}
    </span>
  );
}

function SessionLog() {
  const entries = useSyncExternalStore(
    subscribeSessionLog,
    getSessionLogSnapshot,
    getSessionLogSnapshot
  );

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <Terminal className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          No AI calls made this session. Process a transcript to see the log.
        </p>
      </div>
    );
  }


  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-semibold">Timestamp</th>
            <th className="px-4 py-3 font-semibold">Event type</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Description</th>
            <th className="px-4 py-3 font-semibold text-right">Response time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => (
            <tr key={entry.id} className="hover:bg-secondary/30">
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                {format(entry.timestamp, "HH:mm:ss")}
              </td>
              <td className="px-4 py-3">
                <CallBadge type={entry.callType} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={entry.status} />
              </td>
              <td className="px-4 py-3 text-foreground">{entry.description}</td>
              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                {new Intl.NumberFormat().format(entry.responseTime)}ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminPage() {
  return (
    <main className="flex-1 px-6 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="mb-2 text-xs font-bold tracking-[0.15em] text-muted-foreground/70">
              ADMIN
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              System Overview
            </h1>
            <p className="mt-1.5 text-muted-foreground">
              Inspect the prompts that power MeetIQ and monitor this session's AI calls.
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        <Tabs defaultValue="prompts" className="space-y-6">
          <TabsList>
            <TabsTrigger value="prompts">System Prompts</TabsTrigger>
            <TabsTrigger value="log">Session Log</TabsTrigger>
          </TabsList>

          <TabsContent value="prompts" className="space-y-10">
            <PromptSection
              label="Call 1 — Extract & Classify"
              badge="CALL 1"
              badgeTone="blue"
              blocks={CALL_1_BLOCKS}
            />
            <PromptSection
              label="Call 2 — Conversational Q&A"
              badge="CALL 2"
              badgeTone="purple"
              blocks={CALL_2_BLOCKS}
            />
          </TabsContent>

          <TabsContent value="log">
            <SessionLog />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
