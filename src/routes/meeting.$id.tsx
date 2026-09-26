import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  Share2,
  Download,
  Copy,
  MoreHorizontal,
  CheckCircle2,
  Loader2,
  FileText,
  Sparkles,
  Lightbulb,
  Gavel,
  ListChecks,
  HelpCircle,
  Tags,
  ChevronDown,
  User,
  Search,
  Send,

  BookOpen,
  UserPlus,
  CalendarIcon,
  Target,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { format, parse } from "date-fns";
import { analyzeTranscript, askMeetingQuestion } from "@/lib/ai.functions";
import type { MeetingAnalysis } from "@/lib/analysis";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getMeeting,
  getMeetingsSnapshot,
  setMeetingAnalysis,
  setMeetingAnalyzing,
  setMeetingFailed,
  subscribeMeetings,
} from "@/lib/meetings";
import { addLogEntry } from "@/lib/sessionLog";


export const Route = createFileRoute("/meeting/$id")({
  component: MeetingWorkspace,
  head: () => ({
    meta: [
      { title: "Meeting Workspace - MeetIQ" },
      {
        name: "description",
        content:
          "Review your meeting overview, transcript, accountability, and ask AI questions.",
      },
      { property: "og:title", content: "Meeting Workspace - MeetIQ" },
      {
        property: "og:description",
        content:
          "Review your meeting overview, transcript, accountability, and ask AI questions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function actionToast(message: string) {
  toast.custom(
    () => (
      <div className="flex items-center gap-3 rounded-full bg-navy px-5 py-3 text-navy-foreground shadow-xl">
        <CheckCircle2 className="h-5 w-5 text-emerald-400" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    ),
    { duration: 3000 }
  );
}

/* ---------------- Helpers derived from AI analysis ---------------- */

function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  const hoursStr = match[1] ?? "0";
  const minutesStr = match[2] ?? "0";
  const period = match[3] ?? "AM";
  let hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (hours === 12 && period.toUpperCase() === "AM") hours = 0;
  if (hours !== 12 && period.toUpperCase() === "PM") hours += 12;
  return hours * 60 + minutes;
}

function computeDuration(moments: { time?: string | null }[]): string {
  const times = moments
    .map((m) => parseTimeToMinutes(m.time))
    .filter((m): m is number => m !== null);
  if (times.length < 2) return "—";
  const diff = Math.max(...times) - Math.min(...times);
  return `${diff} min`;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 0);
  const first = parts[0];
  const second = parts[1];
  if (first && second) {
    return (first.charAt(0) + second.charAt(0)).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function computeParticipants(
  moments: { speaker?: string | null }[]
): { name: string; initials: string }[] {
  const speakers = Array.from(
    new Set(moments.map((m) => m.speaker).filter((s): s is string => Boolean(s)))
  );
  return speakers.map((name) => ({ name, initials: getInitials(name) }));
}

/* ---------------- Mock overview data ---------------- */

const summaryText =
  "The team aligned on launching the beta with the current onboarding flow rather than delaying for a redesign. Pricing for the beta tier was confirmed, engineering flagged two risks around data sync reliability, and the launch checklist was assigned across product, design, and engineering owners.";

const takeaways = [
  "Beta launch stays on track for the end of the month with the existing onboarding flow.",
  "Pricing for the beta tier was finalized at the lower of the two proposed options.",
  "Data sync reliability is the top engineering risk and needs a mitigation plan this week.",
  "Marketing will hold the announcement until the onboarding copy is finalized.",
  "Next checkpoint is a 30-minute sync to review launch readiness.",
];

const decisions = [
  {
    text: "Launch the beta with the existing onboarding flow.",
    speaker: "Priya Nair",
    timestamp: "14:32",
    confidence: 92,
  },
  {
    text: "Price the beta tier at $12 per seat per month.",
    speaker: "Daniel Kim",
    timestamp: "27:10",
    confidence: 85,
  },
  {
    text: "Defer the onboarding redesign to the post-beta roadmap.",
    speaker: "Priya Nair",
    timestamp: "31:45",
    confidence: 78,
  },
];

const actionItems = [
  { task: "Finalize onboarding copy", owner: "Sarah", due: "Sep 24", status: "Pending" },
  { task: "Draft data sync mitigation plan", owner: "Daniel", due: "Sep 22", status: "In progress" },
  { task: "Update pricing page for beta tier", owner: "Aisha", due: "Sep 25", status: "Pending" },
  { task: "Prepare launch announcement draft", owner: "Marco", due: "Sep 26", status: "Pending" },
];

const questionsRaised = [
  "Do we have enough support coverage for the first week of beta?",
  "Should existing trial users be migrated to the beta pricing automatically?",
  "What is the rollback plan if sync errors spike after launch?",
];

const topics = ["Product", "Pricing", "Onboarding", "Engineering", "Launch"];

const meetingDuration = "42 min";

const participants = [
  { name: "Kaori Chan", initials: "KC" },
  { name: "Alex Morgan", initials: "AM" },
  { name: "Sarah Lee", initials: "SL" },
  { name: "Daniel Kim", initials: "DK" },
  { name: "Mia Chen", initials: "MC" },
  { name: "Ryan Patel", initials: "RP" },
];

const transcriptEntries = [
  {
    id: 1,
    timestamp: "10:38 AM",
    speaker: "Priya Nair",
    initials: "PN",
    text: "Thanks, everyone. Today I want us to leave with a firm beta date, a pricing decision, and clear owners for the remaining launch work.",
    important: false,
  },
  {
    id: 2,
    timestamp: "10:40 AM",
    speaker: "Sarah Chen",
    initials: "SC",
    text: "The current onboarding flow tested well enough for beta. The copy still needs a final pass, but I don't think the redesign should hold up the launch.",
    important: false,
  },
  {
    id: 3,
    timestamp: "10:42 AM",
    speaker: "Sarah Chen",
    initials: "SC",
    text: "I think we should move the beta launch to next Thursday. That gives us two extra days to finish the onboarding copy and run one more end-to-end test.",
    important: true,
  },
  {
    id: 4,
    timestamp: "10:45 AM",
    speaker: "Daniel Kim",
    initials: "DK",
    text: "Thursday works for engineering, with one caveat: data sync reliability is still our largest risk. I can draft a mitigation and rollback plan by Friday.",
    important: true,
  },
  {
    id: 5,
    timestamp: "10:49 AM",
    speaker: "Aisha Patel",
    initials: "AP",
    text: "On pricing, the research supports the lower option. Twelve dollars per seat keeps us competitive and gives the sales team a simple story for beta customers.",
    important: false,
  },
  {
    id: 6,
    timestamp: "10:52 AM",
    speaker: "Priya Nair",
    initials: "PN",
    text: "Let's confirm twelve dollars per seat per month for the beta. We'll revisit packaging after we have the first month of usage data.",
    important: true,
  },
  {
    id: 7,
    timestamp: "10:56 AM",
    speaker: "Marco Ruiz",
    initials: "MR",
    text: "Marketing can prepare the announcement now, but I'll hold publication until Sarah signs off on the onboarding copy and Daniel confirms the sync test passed.",
    important: false,
  },
  {
    id: 8,
    timestamp: "11:01 AM",
    speaker: "Priya Nair",
    initials: "PN",
    text: "Great. Sarah owns the copy, Daniel owns the mitigation plan, Aisha updates pricing, and Marco prepares the announcement. We'll meet Tuesday for a final readiness check.",
    important: true,
  },
];

const transcriptSpeakers = Array.from(
  new Set(transcriptEntries.map((entry) => entry.speaker)),
);

/* ---------------- Overview section card ---------------- */

function SectionCard({
  icon,
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/40"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            {icon}
          </span>
          <span>
            <span className="block text-sm font-semibold text-foreground">
              {title}
            </span>
            {subtitle && (
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {subtitle}
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="border-t border-border px-5 py-4">{children}</div>
      )}
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const tone =
    value >= 90
      ? "bg-emerald-500/10 text-emerald-600"
      : value >= 80
        ? "bg-primary/10 text-primary"
        : "bg-amber-500/10 text-amber-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {value}% confidence
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "In progress"
      ? "bg-primary/10 text-primary"
      : status === "Done"
        ? "bg-emerald-500/10 text-emerald-600"
        : "bg-secondary text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}
    >
      {status}
    </span>
  );
}

type OverviewData = {
  summary: string;
  takeaways: string[];
  decisions: Array<{
    text: string;
    speaker: string;
    timestamp: string;
    confidence: number;
  }>;
  actionItems: Array<{
    task: string;
    owner: string;
    due: string;
    status: string;
  }>;
  questions: string[];
  topics: string[];
};

const mockOverviewData: OverviewData = {
  summary: summaryText,
  takeaways,
  decisions,
  actionItems,
  questions: questionsRaised,
  topics,
};

function OverviewSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading meeting overview" aria-busy="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0" />
            <div className="w-full space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
          </div>
          <div className="mt-5 space-y-2 border-t border-border pt-4">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function OverviewTab({
  data = mockOverviewData,
  isLoading = false,
}: {
  data?: OverviewData | undefined;
  isLoading?: boolean | undefined;
}) {
  if (isLoading) return <OverviewSkeleton />;
  const {
    summary: summaryText,
    takeaways,
    decisions,
    actionItems,
    questions: questionsRaised,
    topics,
  } = data;
  return (
    <div className="space-y-4">
      <SectionCard
        icon={<Sparkles className="h-4 w-4" />}
        title="AI Meeting Summary"
        subtitle="A concise executive summary"
        defaultOpen
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          {summaryText}
        </p>
      </SectionCard>

      <SectionCard
        icon={<Lightbulb className="h-4 w-4" />}
        title="Key Takeaways"
        subtitle="3–5 important points"
        defaultOpen
      >
        <ul className="space-y-2.5">
          {takeaways.map((t) => (
            <li key={t} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        icon={<Gavel className="h-4 w-4" />}
        title="Decisions"
        subtitle="Decisions detected from the transcript"
      >
        <div className="space-y-3">
          {decisions.map((d) => (
            <div
              key={d.text}
              className="rounded-lg border border-border bg-background p-4"
            >
              <p className="text-sm font-medium text-foreground">“{d.text}”</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  {d.speaker}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {d.timestamp}
                </span>
                <ConfidenceBadge value={d.confidence} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        icon={<ListChecks className="h-4 w-4" />}
        title="Action Items"
        subtitle="Tasks, owners, due dates, and status"
        defaultOpen
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4">Task</th>
                <th className="pb-2 pr-4">Owner</th>
                <th className="pb-2 pr-4">Due date</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {actionItems.map((a) => (
                <tr key={a.task} className="border-b border-border/60 last:border-0">
                  <td className="py-3 pr-4 font-medium text-foreground">{a.task}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{a.owner}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{a.due}</td>
                  <td className="py-3">
                    <StatusBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        icon={<HelpCircle className="h-4 w-4" />}
        title="Questions Raised"
        subtitle="Unresolved questions from the meeting"
      >
        <ul className="space-y-2.5">
          {questionsRaised.map((q) => (
            <li key={q} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>{q}</span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        icon={<Tags className="h-4 w-4" />}
        title="Topics Discussed"
        subtitle="Main themes of the conversation"
      >
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <span
              key={t}
              className="rounded-full bg-accent px-3.5 py-1.5 text-sm font-medium text-accent-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function TranscriptTab({
  entries = transcriptEntries,
  isLoading = false,
}: {
  entries?: typeof transcriptEntries | undefined;
  isLoading?: boolean | undefined;
}) {
  const [search, setSearch] = useState("");
  const [speaker, setSpeaker] = useState("all");
  const normalizedSearch = search.trim().toLowerCase();
  const keyMoments = entries.filter((entry) => entry.important);
  const speakers = Array.from(new Set(keyMoments.map((entry) => entry.speaker)));
  const visibleEntries = keyMoments.filter((entry) => {
    const matchesSearch =
      !normalizedSearch ||
      entry.text.toLowerCase().includes(normalizedSearch) ||
      entry.speaker.toLowerCase().includes(normalizedSearch) ||
      entry.timestamp.toLowerCase().includes(normalizedSearch);
    const matchesSpeaker = speaker === "all" || entry.speaker === speaker;
    return matchesSearch && matchesSpeaker;
  });

  const copyText = (text: string, message: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    actionToast(message);
  };

  const visibleTranscript = visibleEntries
    .map((entry) => `${entry.timestamp} — ${entry.speaker}\n${entry.text}`)
    .join("\n\n");

  if (isLoading) {
    return (
      <section aria-label="Loading key moments" aria-busy="true">
        <div className="mb-5 flex items-end justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3 w-40" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="grid gap-3 border-b border-border px-4 py-5 last:border-0 sm:grid-cols-[7rem_minmax(0,1fr)] sm:px-5">
              <Skeleton className="h-3 w-16" />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-7 w-7 rounded-full" />
                  <Skeleton className="h-4 w-28" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="key-moments-heading">
      <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 id="key-moments-heading" className="text-lg font-semibold text-foreground">
            Key Moments from this meeting
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {entries.length} key moments identified
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={visibleEntries.length === 0}
          onClick={() => copyText(visibleTranscript, "Key moments copied")}
        >
          <Copy />
          Copy transcript
        </Button>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search key moments"
            aria-label="Search key moments"
            className="pl-9"
          />
        </div>
        <Select value={speaker} onValueChange={setSpeaker}>
          <SelectTrigger aria-label="Filter by speaker">
            <SelectValue placeholder="All speakers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All speakers</SelectItem>
            {speakers.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {visibleEntries.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          {visibleEntries.map((entry) => (
            <article
              key={entry.id}
              className="relative grid gap-3 border-b border-border bg-accent/35 px-4 py-5 last:border-b-0 sm:grid-cols-[7rem_minmax(0,1fr)_2.25rem] sm:px-5"
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
              <time className="text-xs font-medium text-muted-foreground">
                {entry.timestamp}
              </time>
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                    {entry.initials}
                  </span>
                  <h3 className="text-sm font-semibold text-foreground">{entry.speaker}</h3>
                </div>
                <p className="text-sm leading-6 text-foreground">“{entry.text}”</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute bottom-3 right-3 sm:static"
                aria-label={`Copy ${entry.speaker}'s key moment at ${entry.timestamp}`}
                title="Copy text"
                onClick={() => copyText(entry.text, "Key moment copied")}
              >
                <Copy />
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <Search className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold text-foreground">No key moments found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different search or speaker filter.
          </p>
        </div>
      )}
    </section>
  );
}

/* ---------------- Accountability tab ---------------- */

type AccountabilityColumn = "confirmed" | "orphaned" | "remarks";

type AccountabilityItem = {
  id: number;
  kind: "Commitment" | "Remark";
  title: string;
  detail: string;
  owner: string;
  initials: string;
  due?: string | undefined;
  source: string;
  confidence: number;
  column: AccountabilityColumn;
};

const initialAccountabilityItems: AccountabilityItem[] = [
  {
    id: 1,
    kind: "Commitment",
    title: "Finalize onboarding copy",
    detail: "I will own the onboarding copy update.",
    owner: "Sarah Chen",
    initials: "SC",
    due: "Sep 24",
    source: "12:43",
    confidence: 94,
    column: "confirmed",
  },
  {
    id: 2,
    kind: "Commitment",
    title: "Complete permissions QA handoff",
    detail: "I will add the QA handoff notes.",
    owner: "Alex Morgan",
    initials: "AM",
    due: "Sep 23",
    source: "11:02",
    confidence: 91,
    column: "confirmed",
  },
  {
    id: 3,
    kind: "Commitment",
    title: "Schedule customer feedback calls",
    detail: "Let's get ten customer calls on the calendar.",
    owner: "Priya Nair",
    initials: "PN",
    due: "Sep 25",
    source: "21:08",
    confidence: 82,
    column: "confirmed",
  },
  {
    id: 4,
    kind: "Commitment",
    title: "Share launch communication plan",
    detail: "I can share the launch communication plan by Friday.",
    owner: "Unassigned",
    initials: "?",
    source: "10:44",
    confidence: 88,
    column: "orphaned",
  },
  {
    id: 5,
    kind: "Commitment",
    title: "Prepare launch communication plan",
    detail: "We need a clear launch communication plan.",
    owner: "Unassigned",
    initials: "?",
    source: "18:22",
    confidence: 88,
    column: "orphaned",
  },
  {
    id: 6,
    kind: "Remark",
    title: "Maybe we should explore enterprise pricing.",
    detail: "A future idea, not automatically treated as an action.",
    owner: "Mike Torres",
    initials: "MT",
    source: "24:18",
    confidence: 76,
    column: "remarks",
  },
  {
    id: 7,
    kind: "Remark",
    title: "Could be worth revisiting the invite flow.",
    detail: "A passing thought captured for context.",
    owner: "Priya Shah",
    initials: "PS",
    source: "27:06",
    confidence: 71,
    column: "remarks",
  },
];

const accountabilityColumns: Array<{
  id: AccountabilityColumn;
  title: string;
  subtitle: string;
}> = [
  { id: "confirmed", title: "Confirmed Commitments", subtitle: "Firm, owned, dated" },
  { id: "orphaned", title: "Orphaned Commitments", subtitle: "Decided, but nobody owns it" },
  { id: "remarks", title: "Passing Remarks", subtitle: "Logged, not actioned" },
];

const DUE_DATE_PARSE_FORMATS = [
  "yyyy-MM-dd",
  "MM/dd/yyyy",
  "MMM d",
  "MMM d, yyyy",
  "MMMM d",
  "MMMM d, yyyy",
  "d MMM",
  "d MMM yyyy",
  "d MMMM",
  "d MMMM yyyy",
];

function formatDueBadge(due: string | undefined): string {
  if (!due || due.trim() === "") return "Due: To be decided";

  const normalized = due.trim();
  const lower = normalized.toLowerCase();
  if (lower === "to be decided" || lower === "tbd" || lower === "n/a") {
    return "Due: To be decided";
  }

  const stripped = normalized.replace(/(\d{1,2})(st|nd|rd|th)/i, "$1");

  for (const fmt of DUE_DATE_PARSE_FORMATS) {
    const parsed = parse(stripped, fmt, new Date());
    if (!isNaN(parsed.getTime())) {
      return `Due ${format(parsed, "MMM d")}`;
    }
  }

  return `Due ${normalized}`;
}

function AccountabilityCard({
  item,
  onDragStart,
  onDragEnd,
  onAssignOwner,
}: {
  item: AccountabilityItem;
  onDragStart: (item: AccountabilityItem) => void;
  onDragEnd: () => void;
  onAssignOwner: (item: AccountabilityItem) => void;
}) {
  const movable = item.column === "confirmed";
  const confidenceTone =
    item.confidence >= 90 ? "text-emerald-600" : "text-amber-600";

  return (
    <article
      draggable={movable}
      onDragStart={(event) => {
        if (!movable) return;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(item.id));
        onDragStart(item);
      }}
      onDragEnd={onDragEnd}
      className={`rounded-xl border border-border bg-card p-4 shadow-sm transition-all ${
        movable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      aria-label={`${item.kind}: ${item.title}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase text-muted-foreground/70">
          {item.kind}
        </p>
        <MoreHorizontal className="h-4 w-4 text-muted-foreground/40" aria-hidden="true" />
      </div>
      <h3 className="mt-3 text-sm font-semibold leading-5 text-foreground">
        {item.title}
      </h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-[9px] font-bold text-secondary-foreground">
          {item.initials}
        </span>
        <span>{item.owner}</span>
        {(item.column === "confirmed" || item.due) && (
          <span className="rounded bg-secondary px-2 py-1 font-mono text-[10px]">
            {formatDueBadge(item.due)}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-[10px]">
        <span className="font-mono text-muted-foreground">Source {item.source}</span>
        <span className={`font-semibold ${confidenceTone}`}>
          {item.confidence}% confidence
        </span>
      </div>
      {item.column === "orphaned" && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 h-8 w-full text-xs"
          onClick={() => onAssignOwner(item)}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Assign owner
        </Button>
      )}
    </article>
  );
}

function AccountabilityTab({
  onItemsChange,
  initialItems = initialAccountabilityItems,
  participants,
  isLoading = false,
}: {
  onItemsChange: (items: AccountabilityItem[]) => void;
  initialItems?: AccountabilityItem[] | undefined;
  participants: string[];
  isLoading?: boolean | undefined;
}) {
  const [items, setItems] = useState(initialItems);
  const [draggedItem, setDraggedItem] = useState<AccountabilityItem | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<AccountabilityColumn | null>(null);
  const [assignItem, setAssignItem] = useState<AccountabilityItem | null>(null);
  const [ownerChoice, setOwnerChoice] = useState("");
  const [customOwner, setCustomOwner] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [toBeDecided, setToBeDecided] = useState(false);

  useEffect(() => {
    onItemsChange(items);
  }, [items, onItemsChange]);

  function openAssignDialog(item: AccountabilityItem) {
    setAssignItem(item);
    setOwnerChoice("");
    setCustomOwner("");
    setDueDate(undefined);
    setToBeDecided(false);
  }

  function saveAssignment() {
    if (!assignItem) return;
    const ownerName =
      ownerChoice === "__custom" ? customOwner.trim() : ownerChoice;
    const due = toBeDecided
      ? "To be decided"
      : dueDate
        ? format(dueDate, "MMM d")
        : undefined;
    if (!ownerName || !due) return;
    const initials = ownerName
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    setItems((current) =>
      current.map((item) =>
        item.id === assignItem.id
          ? { ...item, column: "confirmed", owner: ownerName, initials, due }
          : item,
      ),
    );
    actionToast(`Moved to Confirmed Commitments — assigned to ${ownerName}`);
    setAssignItem(null);
  }

  const assignOwnerName =
    ownerChoice === "__custom" ? customOwner.trim() : ownerChoice;
  const canSaveAssignment =
    assignOwnerName.length > 0 && (toBeDecided || dueDate !== undefined);

  function moveItem(target: AccountabilityColumn) {
    if (!draggedItem || draggedItem.column !== "confirmed" || target !== "orphaned") {
      setDraggedItem(null);
      setDragOverColumn(null);
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === draggedItem.id
          ? { ...item, column: target, owner: "Unassigned", initials: "?", due: undefined }
          : item,
      ),
    );
    const targetName = accountabilityColumns.find((column) => column.id === target)?.title;
    actionToast(`Moved to ${targetName ?? "new column"} and marked unassigned`);
    setDraggedItem(null);
    setDragOverColumn(null);
  }

  if (isLoading) {
    return (
      <section aria-label="Loading accountability board" aria-busy="true">
        <div className="mb-6 space-y-2">
          <Skeleton className="h-6 w-52" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {accountabilityColumns.map((column) => (
            <div key={column.id} className="min-h-[31rem] rounded-xl border border-border bg-secondary/30 p-3">
              <div className="mb-4 flex items-center justify-between px-1 pt-1">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
              <div className="space-y-3">
                {Array.from({ length: 2 }, (_, index) => (
                  <div key={index} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="mt-4 h-4 w-4/5" />
                    <Skeleton className="mt-3 h-3 w-full" />
                    <Skeleton className="mt-2 h-3 w-2/3" />
                    <div className="mt-5 flex gap-2">
                      <Skeleton className="h-6 w-6 rounded-full" />
                      <Skeleton className="h-6 w-24" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="accountability-heading">
      <div className="mb-6">
        <h2 id="accountability-heading" className="text-xl font-bold text-foreground">
          Accountability Board
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          See what was committed, what was left ownerless, and what was simply discussed.
        </p>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-3">
        {accountabilityColumns.map((column) => {
          const columnItems = items.filter((item) => item.column === column.id);
          const acceptsDrop = column.id === "orphaned";
          const isTarget = acceptsDrop && dragOverColumn === column.id;
          const columnTone =
            column.id === "confirmed"
              ? "border-emerald-300 bg-emerald-500/5"
              : column.id === "orphaned"
                ? "border-amber-300 bg-amber-500/5"
                : "border-border bg-secondary/30";
          const dotTone =
            column.id === "confirmed"
              ? "bg-emerald-500"
              : column.id === "orphaned"
                ? "bg-amber-400"
                : "bg-muted-foreground/35";

          return (
            <div
              key={column.id}
              onDragOver={(event) => {
                if (!acceptsDrop || !draggedItem || draggedItem.column !== "confirmed") return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                setDragOverColumn(column.id);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDragOverColumn(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                moveItem(column.id);
              }}
              className={`min-h-[31rem] rounded-xl border p-3 transition-all ${columnTone} ${
                isTarget ? "ring-2 ring-primary/30" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3 px-1 pb-4 pt-1">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full shadow-sm ${dotTone}`} />
                    <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
                  </div>
                  <p className="mt-1 pl-5 text-xs text-muted-foreground">{column.subtitle}</p>
                </div>
                <span className="min-w-6 rounded-full border border-border bg-card px-2 py-0.5 text-center text-xs font-semibold text-foreground">
                  {columnItems.length}
                </span>
              </div>

              <div className="space-y-3">
                {columnItems.map((item) => (
                  <AccountabilityCard
                    key={item.id}
                    item={item}
                    onDragStart={setDraggedItem}
                    onDragEnd={() => {
                      setDraggedItem(null);
                      setDragOverColumn(null);
                    }}
                    onAssignOwner={openAssignDialog}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-xs text-muted-foreground">
        <span className="mr-2" aria-hidden="true">→</span>
        Drag a card from Confirmed Commitments to Orphaned Commitments to mark it unassigned.
      </p>

      <Dialog
        open={assignItem !== null}
        onOpenChange={(open) => {
          if (!open) setAssignItem(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-600">
              Accountability Board
            </p>
            <DialogTitle className="text-xl">Assign an owner</DialogTitle>
            <DialogDescription>
              Give this commitment a clear owner and due date so it can move
              into confirmed outcomes.
            </DialogDescription>
          </DialogHeader>

          {assignItem && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-secondary/40 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Commitment
                </p>
                <p className="mt-2 text-sm font-semibold text-foreground">
                  {assignItem.title}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <FileText className="h-3 w-3" aria-hidden="true" />
                  Source {assignItem.source} · {assignItem.confidence}% confidence
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="assign-owner">Owner</Label>
                  <Select value={ownerChoice} onValueChange={setOwnerChoice}>
                    <SelectTrigger id="assign-owner" className="w-full">
                      <SelectValue placeholder="Choose an owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {participants.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom">Someone else…</SelectItem>
                    </SelectContent>
                  </Select>
                  {ownerChoice === "__custom" && (
                    <Input
                      value={customOwner}
                      onChange={(event) => setCustomOwner(event.target.value)}
                      placeholder="Type the owner's name"
                      aria-label="Owner name"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assign-due-date">Due date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        id="assign-due-date"
                        variant="outline"
                        disabled={toBeDecided}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dueDate && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="h-4 w-4" />
                        {dueDate ? format(dueDate, "dd-MM-yyyy") : <span>dd-mm-yyyy</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={dueDate}
                        onSelect={setDueDate}
                        initialFocus
                        className="pointer-events-auto p-3"
                      />
                    </PopoverContent>
                  </Popover>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Checkbox
                      checked={toBeDecided}
                      onCheckedChange={(checked) => {
                        setToBeDecided(checked === true);
                        if (checked) setDueDate(undefined);
                      }}
                      aria-label="To be decided"
                    />
                    To be decided
                  </label>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3.5">
                <Target className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-xs leading-5 text-muted-foreground">
                  Saving this assignment will move the card from orphaned to
                  confirmed commitments.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setAssignItem(null)}>
                  Cancel
                </Button>
                <Button onClick={saveAssignment} disabled={!canSaveAssignment}>
                  Save assignment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}


/* ---------------- Ask AI tab ---------------- */

const suggestedPrompts = [
  "What were the key takeaways?",
  "What decisions were made?",
  "What are the action items?",
  "What is still unresolved?",
  "Give me a brief meeting summary.",
];

type ChatSource = { timestamp: string; speaker: string };

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  time: string;
  sources?: ChatSource[];
};

type Html2PdfWorker = {
  set: (options: Record<string, unknown>) => Html2PdfWorker;
  from: (element: HTMLElement) => Html2PdfWorker;
  toPdf: () => Html2PdfWorker;
  get: (key: string) => Html2PdfWorker;
  then: (callback: (pdf: {
    internal: { getNumberOfPages: () => number; pageSize: { getWidth: () => number; getHeight: () => number } };
    setPage: (page: number) => void;
    setFontSize: (size: number) => void;
    setTextColor: (gray: number) => void;
    text: (text: string, x: number, y: number, options?: { align?: string }) => void;
  }) => void) => Html2PdfWorker;
  save: () => Promise<void>;
};

type Html2PdfFactory = () => Html2PdfWorker;

let html2PdfLoadPromise: Promise<Html2PdfFactory> | null = null;

function loadHtml2Pdf() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PDF generation is only available in the browser."));
  }
  const browserWindow = window as Window & { html2pdf?: Html2PdfFactory };
  if (browserWindow.html2pdf) return Promise.resolve(browserWindow.html2pdf);
  if (html2PdfLoadPromise) return html2PdfLoadPromise;

  html2PdfLoadPromise = new Promise<Html2PdfFactory>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;
    script.onload = () => {
      if (browserWindow.html2pdf) resolve(browserWindow.html2pdf);
      else reject(new Error("The PDF library did not load."));
    };
    script.onerror = () => reject(new Error("The PDF library could not be loaded."));
    document.head.appendChild(script);
  });
  return html2PdfLoadPromise;
}

function appendText(parent: HTMLElement, tag: string, text: string, className?: string) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  parent.appendChild(element);
  return element;
}

function createReportPage(title?: string) {
  const page = document.createElement("section");
  page.className = "meetiq-pdf-page";
  if (title) appendText(page, "h1", title, "meetiq-pdf-page-title");
  return page;
}

async function downloadMeetingPdf({
  meetingTitle,
  meetingDate,
  duration,
  participants,
  accountabilityItems,
  messages,
  transcriptMoments,
}: {
  meetingTitle: string;
  meetingDate: Date;
  duration: string;
  participants: { name: string; initials: string }[];
  accountabilityItems: AccountabilityItem[];
  messages: ChatMessage[];
  transcriptMoments?: Array<{ timestamp: string; speaker: string; text: string; important: boolean }>;
}) {
  const html2pdf = await loadHtml2Pdf();
  const report = document.createElement("div");
  report.className = "meetiq-pdf-report";

  const style = document.createElement("style");
  style.dataset["meetiqPdfStyle"] = "true";
  style.textContent = `
    .meetiq-pdf-report { width: 6.5in; color: #000; background: #fff; border-color: #d1d5db; font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.48; }
    .meetiq-pdf-report * { color: #000; border-color: #d1d5db; box-shadow: none; }
    .meetiq-pdf-page { position: relative; box-sizing: border-box; min-height: 9in; page-break-before: always; }
    .meetiq-pdf-page:first-of-type { page-break-before: auto; }
    .meetiq-pdf-cover { display: flex; min-height: 9in; flex-direction: column; justify-content: center; }
    .meetiq-pdf-cover h1 { margin: 0 0 30px; font-size: 30pt; line-height: 1.15; }
    .meetiq-pdf-cover p { margin: 5px 0; }
    .meetiq-pdf-cover .meetiq-pdf-generated { margin-top: 42px; font-size: 9.5pt; }
    .meetiq-pdf-cover-participant { margin: 1px 0 1px 0.25in !important; }
    .meetiq-pdf-page-title { margin: 0 0 24px; padding: 10px 12px; background: #F3F4F6; font-size: 21pt; line-height: 1.2; }
    .meetiq-pdf-section-title { margin: 22px 0 9px; padding: 7px 9px; background: #F3F4F6; font-size: 14pt; line-height: 1.2; }
    .meetiq-pdf-report p { orphans: 3; widows: 3; }
    .meetiq-pdf-report ul { margin: 8px 0 0; padding-left: 24px; }
    .meetiq-pdf-report li { margin: 0 0 7px; }
    .meetiq-pdf-table { width: 100%; border-collapse: collapse; }
    .meetiq-pdf-table th, .meetiq-pdf-table td { padding: 10px 8px; border-bottom: 1px solid #d1d5db; text-align: left; vertical-align: top; }
    .meetiq-pdf-table th { background: #F3F4F6; font-weight: 700; }
    .meetiq-pdf-item { margin: 0 0 14px; break-inside: avoid; }
    .meetiq-pdf-item p { margin: 3px 0; }
    .meetiq-pdf-accountability { font-size: 9.5pt; line-height: 1.3; }
    .meetiq-pdf-accountability .meetiq-pdf-page-title { margin-bottom: 14px; }
    .meetiq-pdf-accountability .meetiq-pdf-section-title { margin: 12px 0 6px; padding: 5px 8px; font-size: 12pt; }
    .meetiq-pdf-accountability .meetiq-pdf-item { margin-bottom: 8px; }
    .meetiq-pdf-accountability .meetiq-pdf-item p { margin: 1px 0; }
    .meetiq-pdf-qa { margin: 0 0 20px; break-inside: avoid; }
    .meetiq-pdf-qa p { margin: 4px 0; }
    .meetiq-pdf-source { font-style: italic; }
    .meetiq-pdf-transcript-entry { margin: 0 0 16px; break-inside: avoid; }
    .meetiq-pdf-transcript-entry p { margin: 4px 0 0; }
  `;
  report.appendChild(style);

  const cover = createReportPage();
  cover.classList.add("meetiq-pdf-cover");
  appendText(cover, "h1", meetingTitle);
  appendText(cover, "p", `Date: ${format(meetingDate, "MMMM d, yyyy")}`);
  appendText(cover, "p", `Duration: ${duration}`);
  appendText(cover, "p", `Participants: ${participants.length}`);
  appendText(cover, "p", "Participants:");
  participants.forEach((p) =>
    appendText(cover, "p", p.name, "meetiq-pdf-cover-participant")
  );
  appendText(
    cover,
    "p",
    "Generated by MeetIQ · Transcript not stored · meetiq.app",
    "meetiq-pdf-generated",
  );
  report.appendChild(cover);

  const summary = createReportPage("AI Meeting Summary");
  appendText(summary, "p", summaryText);
  appendText(summary, "h2", "Key Takeaways", "meetiq-pdf-section-title");
  const takeawayList = document.createElement("ul");
  takeaways.forEach((item) => appendText(takeawayList, "li", item));
  summary.appendChild(takeawayList);
  appendText(summary, "h2", "Decisions", "meetiq-pdf-section-title");
  const decisionList = document.createElement("ul");
  decisions.forEach((item) => appendText(decisionList, "li", item.text));
  summary.appendChild(decisionList);
  appendText(summary, "h2", "Questions Raised", "meetiq-pdf-section-title");
  const questionList = document.createElement("ul");
  questionsRaised.forEach((item) => appendText(questionList, "li", item));
  summary.appendChild(questionList);
  appendText(summary, "h2", "Topics Discussed", "meetiq-pdf-section-title");
  appendText(summary, "p", topics.join(", "));
  report.appendChild(summary);

  const actions = createReportPage("Action Items");
  const table = document.createElement("table");
  table.className = "meetiq-pdf-table";
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Task", "Owner", "Due Date", "Status"].forEach((label) => appendText(headerRow, "th", label));
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  actionItems.forEach((item) => {
    const row = document.createElement("tr");
    [item.task, item.owner, item.due, item.status].forEach((value) => appendText(row, "td", value));
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  actions.appendChild(table);
  report.appendChild(actions);

  const accountability = createReportPage("Accountability Board");
  accountability.classList.add("meetiq-pdf-accountability");
  const groups: Array<{ column: AccountabilityColumn; heading: string }> = [
    { column: "confirmed", heading: "✅ Confirmed Commitments" },
    { column: "orphaned", heading: "⚠️ Orphaned Commitments — Needs an Owner" },
    { column: "remarks", heading: "💬 Passing Remarks" },
  ];
  groups.forEach(({ column, heading }) => {
    appendText(accountability, "h2", heading, "meetiq-pdf-section-title");
    accountabilityItems.filter((item) => item.column === column).forEach((item) => {
      const block = document.createElement("div");
      block.className = "meetiq-pdf-item";
      const title = appendText(block, "p", item.title);
      title.style.fontWeight = "700";
      if (column === "remarks") {
        appendText(block, "p", `Speaker: ${item.owner}`);
      } else {
        appendText(block, "p", item.detail);
        appendText(block, "p", `Owner: ${column === "orphaned" ? "Unassigned" : item.owner}`);
        if (column === "confirmed") appendText(block, "p", `Due: ${item.due ?? "To be decided"}`);
        appendText(block, "p", `Confidence: ${item.confidence}%`);
      }
      accountability.appendChild(block);
    });
  });
  report.appendChild(accountability);

  const userMessages = messages.filter((message) => message.role === "user");
  if (userMessages.length > 0) {
    const qaPage = createReportPage("Ask MeetIQ — Session Q&A");
    userMessages.forEach((question) => {
      const answer = messages.slice(messages.indexOf(question) + 1).find((message) => message.role === "assistant");
      const block = document.createElement("div");
      block.className = "meetiq-pdf-qa";
      const q = appendText(block, "p", `Q: ${question.text}`);
      q.style.fontWeight = "700";
      appendText(block, "p", `A: ${answer?.text ?? "Answer pending."}`);
      const citation = answer?.sources?.map((source) => `${source.timestamp} — ${source.speaker}`).join("; ") ?? "No citation available";
      appendText(block, "p", `Source: ${citation}`, "meetiq-pdf-source");
      qaPage.appendChild(block);
    });
    report.appendChild(qaPage);
  }

  const keyMomentsPage = createReportPage("Key Moments");
  const keyMomentEntries = transcriptMoments?.length ? transcriptMoments : transcriptEntries.filter((entry) => entry.important);
  keyMomentEntries.forEach((entry) => {
    const block = document.createElement("div");
    block.className = "meetiq-pdf-transcript-entry";
    const heading = appendText(block, "p", `${entry.timestamp} ${entry.speaker}`);
    heading.style.fontWeight = "700";
    appendText(block, "p", `“${entry.text}”`);
    keyMomentsPage.appendChild(block);
  });
  report.appendChild(keyMomentsPage);

  document.body.appendChild(report);
  const filenameTitle = meetingTitle.trim().replace(/[\\/:*?"<>|]/g, "-") || "Meeting";
  const filename = `MeetIQ-${filenameTitle}-${format(meetingDate, "yyyy-MM-dd")}.pdf`;
  const appStyles = Array.from(document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>("style:not([data-meetiq-pdf-style]), link[rel='stylesheet']"));
  appStyles.forEach((element) => {
    element.disabled = true;
  });
  try {
    await html2pdf()
      .set({
        margin: [1, 1, 0.75, 1],
        filename,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 1,
          useCORS: true,
          onclone: (clonedDocument: Document) => {
            clonedDocument
              .querySelectorAll("style:not([data-meetiq-pdf-style]), link[rel='stylesheet']")
              .forEach((element) => element.remove());
            clonedDocument.documentElement.style.background = "#fff";
            clonedDocument.documentElement.style.color = "#000";
            clonedDocument.body.style.background = "#fff";
            clonedDocument.body.style.color = "#000";
          },
        },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], before: ".meetiq-pdf-page:not(:first-of-type)", avoid: [".meetiq-pdf-item", ".meetiq-pdf-qa", ".meetiq-pdf-transcript-entry"] },
      })
      .from(report)
      .toPdf()
      .get("pdf")
      .then((pdf) => {
        const pageCount = pdf.internal.getNumberOfPages();
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        pdf.setFontSize(9);
        pdf.setTextColor(0);
        for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
          pdf.setPage(pageNumber);
          pdf.text(String(pageNumber), pageWidth / 2, pageHeight - 0.35, { align: "center" });
        }
      })
      .save();
  } finally {
    appStyles.forEach((element) => {
      element.disabled = false;
    });
    report.remove();
    document.querySelectorAll(".html2pdf__overlay").forEach((element) => element.remove());
  }
}

const mockAnswers: Record<string, { text: string; sources: ChatSource[] }> = {
  "What were the final decisions?": {
    text: "Three decisions were finalized: launch the beta with the existing onboarding flow, hold current pricing until after the beta, and move the launch date to next Thursday.",
    sources: [
      { timestamp: "14:32", speaker: "Priya Nair" },
      { timestamp: "21:07", speaker: "Daniel Kim" },
    ],
  },
  "Who owns the launch tasks?": {
    text: "Sarah owns the onboarding copy update, due September 24. Daniel owns the engineering freeze checklist, and Priya owns the final go/no-go review.",
    sources: [{ timestamp: "12:43", speaker: "Sarah" }],
  },
  "What did Sarah say about onboarding?": {
    text: "Sarah flagged that the onboarding flow still confuses new users at the team-invite step, and suggested shipping the beta as-is while rewriting the invite copy before launch.",
    sources: [{ timestamp: "12:43", speaker: "Sarah" }],
  },
  "What questions are still unresolved?": {
    text: "Two questions remain open: whether the pricing page should mention the beta discount, and who approves the final launch email.",
    sources: [{ timestamp: "27:51", speaker: "Daniel Kim" }],
  },
  "Summarize the discussion about pricing.": {
    text: "The team agreed to hold current pricing through the beta, revisit the team-plan tier in Q4, and keep the beta discount off the public pricing page for now.",
    sources: [{ timestamp: "18:15", speaker: "Priya Nair" }],
  },
  "What commitments don't have owners?": {
    text: "One commitment has no owner yet: updating the help-center article about team invites. The team suggested assigning it at the next standup.",
    sources: [{ timestamp: "30:02", speaker: "Daniel Kim" }],
  },
  "Give me a 30-second executive brief.": {
    text: "The team confirmed the beta launches next Thursday with the existing onboarding flow. Pricing stays unchanged through beta. Sarah owns onboarding copy (Sep 24), Daniel owns the engineering freeze. Two questions remain unresolved.",
    sources: [
      { timestamp: "14:32", speaker: "Priya Nair" },
      { timestamp: "12:43", speaker: "Sarah" },
    ],
  },
};

const fallbackAnswer = {
  text: "Based on the transcript, this was discussed around the launch planning. The team leaned toward keeping the beta scope small and revisiting after launch — see the highlighted moments for the exact exchange.",
  sources: [{ timestamp: "14:32", speaker: "Priya Nair" }],
};

function nowTime() {
  return new Date().toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function AskAITab({
  onViewTranscript,
  onMessagesChange,
  analysis,
  isProcessing,
}: {
  onViewTranscript: () => void;
  onMessagesChange: (messages: ChatMessage[]) => void;
  analysis: MeetingAnalysis | null | undefined;
  isProcessing: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [failedQuestionIds, setFailedQuestionIds] = useState<number[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    onMessagesChange(messages);
  }, [messages, onMessagesChange]);

  async function ask(question: string, existingUserId?: number) {
    const q = question.trim();
    if (!q || thinking || isProcessing) return;
    const userMsg: ChatMessage = {
      id: existingUserId ?? Date.now(),
      role: "user",
      text: q,
      time: nowTime(),
    };
    if (existingUserId === undefined) {
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
    }
    setFailedQuestionIds((current) => current.filter((id) => id !== userMsg.id));
    setThinking(true);
    const start = performance.now();
    try {
      const answer = await askMeetingQuestion({
        data: {
          analysisJson: JSON.stringify(analysis ?? {}),
          question: q,
        },
      });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: answer,
          time: nowTime(),
        },
      ]);
      addLogEntry({
        callType: "CALL 2",
        status: "SUCCESS",
        description: `Question answered: ${q}`,
        responseTime: Math.round(performance.now() - start),
      });
    } catch {
      setFailedQuestionIds((current) =>
        current.includes(userMsg.id) ? current : [...current, userMsg.id],
      );
      addLogEntry({
        callType: "CALL 2",
        status: "FAILED",
        description: `Question failed: ${q}`,
        responseTime: Math.round(performance.now() - start),
      });
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Ask MeetIQ
          </h2>
          <p className="text-sm text-muted-foreground">
            Ask questions about this meeting.
          </p>
        </div>
      </div>

      {/* Suggested prompts */}
      <div className="flex flex-wrap gap-2">
        {suggestedPrompts.map((prompt) => (
          <button
            key={prompt}
            onClick={() => ask(prompt)}
            disabled={isProcessing || thinking}
            className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="max-h-[480px] space-y-6 overflow-y-auto px-5 py-6">
          {messages.length === 0 && !thinking && (
            <div className="flex flex-col items-center py-10 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium text-foreground">
                Every answer is grounded in this meeting's transcript
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pick a suggestion above or type your own question below.
              </p>
            </div>
          )}

          {messages.map((message) =>
            message.role === "user" ? (
              <div key={message.id} className="flex justify-end">
                <div className="max-w-[75%]">
                  <div className="rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                    {message.text}
                  </div>
                  <p className="mt-1 text-right text-[11px] text-muted-foreground">
                    You · {message.time}
                  </p>
                  {failedQuestionIds.includes(message.id) && (
                    <button
                      type="button"
                      onClick={() => ask(message.text, message.id)}
                      className="mt-2 ml-auto flex items-center gap-1.5 text-xs font-medium text-destructive transition-opacity hover:opacity-75"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Couldn't get a response. Try again.
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div key={message.id} className="flex justify-start">
                <div className="max-w-[85%]">
                  <p className="text-sm leading-relaxed text-foreground">
                    {message.text}
                  </p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.sources.map((source, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/60 px-3 py-2"
                        >
                          <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                            <BookOpen className="h-3.5 w-3.5 text-primary" />
                            Source: {source.timestamp} — {source.speaker}
                          </span>
                          <button
                            onClick={onViewTranscript}
                            className="text-xs font-semibold text-primary transition-colors hover:text-primary/80"
                          >
                            [View in transcript]
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    MeetIQ · {message.time}
                  </p>
                </div>
              </div>
            )
          )}

          {thinking && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching the transcript…
            </div>
          )}
        </div>

        {/* Composer */}
        <form
          className="flex items-center gap-2 border-t border-border px-4 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isProcessing ? "Processing transcript..." : "Ask about decisions, owners, or anything said in the meeting…"}
            disabled={isProcessing}
            className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || thinking || isProcessing}
            aria-label="Send question"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        MeetIQ is AI and can make mistakes. Check important answers against the
        transcript.
      </p>
    </div>
  );
}

function MeetingWorkspace() {
  const { id } = useParams({ from: "/meeting/$id" });
  useSyncExternalStore(
    subscribeMeetings,
    getMeetingsSnapshot,
    getMeetingsSnapshot
  );
  const meeting = getMeeting(Number(id));
  const [tab, setTab] = useState("overview");
  const [reportAccountabilityItems, setReportAccountabilityItems] = useState(initialAccountabilityItems);
  const [reportMessages, setReportMessages] = useState<ChatMessage[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const isAnalyzing = meeting?.status === "analyzing";

  async function retryAnalysis() {
    if (!meeting || meeting.status === "analyzing") return;
    setMeetingAnalyzing(meeting.id);
    const start = performance.now();
    try {
      const analysis = await analyzeTranscript({
        data: { title: meeting.title, transcript: meeting.transcript },
      });
      setMeetingAnalysis(meeting.id, analysis);
      addLogEntry({
        callType: "CALL 1",
        status: "SUCCESS",
        description: `Transcript analysed — ${analysis.transcript_moments.length} moments, ${analysis.commitments.length} commitments extracted`,
        responseTime: Math.round(performance.now() - start),
      });
    } catch (error) {
      console.error("Meeting analysis retry failed", error);
      setMeetingFailed(meeting.id);
      addLogEntry({
        callType: "CALL 1",
        status: "FAILED",
        description: "Transcript analysis failed",
        responseTime: Math.round(performance.now() - start),
      });
    }
  }


  if (!meeting) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="font-semibold text-foreground">Meeting not found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          This meeting may have been removed or never existed.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to workspace
        </Link>
      </div>
    );
  }

  // Parsed AI analysis stored in state; falls back to sample data until ready.
  const meetingAnalysis = meeting.analysis;

  const derivedDuration = useMemo(
    () => computeDuration(meetingAnalysis?.transcript_moments ?? []),
    [meetingAnalysis?.transcript_moments]
  );
  const derivedParticipants = useMemo(
    () => computeParticipants(meetingAnalysis?.transcript_moments ?? []),
    [meetingAnalysis?.transcript_moments]
  );

  const overviewData: OverviewData | undefined = meetingAnalysis
    ? {
        summary: meetingAnalysis.summary.executive_summary,
        takeaways: meetingAnalysis.summary.key_takeaways,
        decisions: meetingAnalysis.summary.decisions.map((d) => ({
          text: d.text,
          speaker: d.speaker,
          timestamp: d.timestamp ?? "—",
          confidence: d.confidence,
        })),
        actionItems: meetingAnalysis.action_items.map((a) => ({
          task: a.task,
          owner: a.owner ?? "Unassigned",
          due: a.due_date ?? "—",
          status: a.status || "Pending",
        })),
        questions: meetingAnalysis.summary.questions_raised,
        topics: meetingAnalysis.summary.topics,
      }
    : undefined;

  const transcriptData = meetingAnalysis
    ? meetingAnalysis.transcript_moments.map((m, i) => ({
        id: i + 1,
        timestamp: m.time ?? "—",
        speaker: m.speaker,
        initials: m.speaker_initials,
        text: m.text,
        important: m.is_important,
      }))
    : undefined;

  const accountabilityInitial: AccountabilityItem[] | undefined =
    meetingAnalysis
      ? meetingAnalysis.commitments.map(
          (c, i): AccountabilityItem => ({
            id: i + 1,
            kind: c.type === "PASSING" ? "Remark" : "Commitment",
            title: c.title,
            detail: c.raw_text,
            owner:
              c.type === "CONFIRMED"
                ? (c.owner ?? c.speaker)
                : c.type === "PASSING"
                  ? c.speaker
                  : "Unassigned",
            initials: c.type === "ORPHANED" ? "?" : c.speaker_initials,
            due:
              c.type === "CONFIRMED" ? (c.due_date ?? undefined) : undefined,
            source: c.source_time ?? "—",
            confidence: c.confidence,
            column:
              c.type === "CONFIRMED"
                ? "confirmed"
                : c.type === "ORPHANED"
                  ? "orphaned"
                  : "remarks",
          }),
        )
      : undefined;

  const actionButton =
    "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card px-6 py-4">
        <div className="mx-auto max-w-6xl">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            My workspace
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
                {meeting.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {meeting.createdAt.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  Duration: {derivedDuration}
                </span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-sm text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                    >
                      <Users className="h-4 w-4" />
                      Participants: {derivedParticipants.length}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-64 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Participants
                    </p>
                    <ul className="space-y-2">
                      {derivedParticipants.map((p) => (
                        <li key={p.name} className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="bg-primary/10 text-[10px] text-primary">
                              {p.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-foreground">{p.name}</span>
                        </li>
                      ))}
                    </ul>
                  </PopoverContent>
                </Popover>
                {meeting.status === "analyzing" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Analyzing transcript
                  </span>
                ) : meeting.status === "failed" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-semibold text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    Analysis failed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    Transcript ready
                  </span>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                disabled={isAnalyzing || isDownloading}
                onClick={async () => {
                  if (isDownloading) return;
                  setIsDownloading(true);
                  try {
                    await downloadMeetingPdf({
                      meetingTitle: meeting.title,
                      meetingDate: meeting.createdAt,
                      duration: derivedDuration,
                      participants: derivedParticipants,
                      accountabilityItems: reportAccountabilityItems,
                      messages: reportMessages,
                      transcriptMoments: transcriptData ?? [],
                    });
                    const dateStr = format(meeting.createdAt, "MMMM d, yyyy");
                    const confirmed = reportAccountabilityItems.filter(
                      (item) => item.column === "confirmed"
                    );
                    const commitments = confirmed.length
                      ? confirmed.map((item) => `• ${item.title}`).join("\n")
                      : "• No confirmed commitments yet";
                    const subject = `Meeting Notes — ${meeting.title} — ${dateStr}`;
                    const body = `Hi,\n\nPlease find the MeetIQ accountability report for our ${derivedDuration} meeting on ${dateStr} attached.\n\nKey commitments:\n${commitments}\n\nGenerated by MeetIQ · No meeting data was stored in the cloud.\n\nBest,`;
                    toast.custom(
                      () => (
                        <div className="flex items-center gap-3 rounded-full bg-blue-50 px-5 py-3 text-blue-900 shadow-xl">
                          <CheckCircle2 className="h-5 w-5 text-blue-600" />
                          <span className="text-sm font-medium">
                            PDF downloaded — attach it to the email that opened
                          </span>
                        </div>
                      ),
                      { duration: 5000 }
                    );
                    window.location.href = `mailto:?subject=${encodeURIComponent(
                      subject
                    )}&body=${encodeURIComponent(body)}`;
                  } catch (error) {
                    console.error("Share PDF failed", error);
                    toast.error("PDF download failed. Please try again.");
                  } finally {
                    setIsDownloading(false);
                  }
                }}
                className={actionButton}
              >
                {isDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Share2 className="h-4 w-4" />
                )}
                Share
              </button>
              <button
                disabled={isAnalyzing || isDownloading}
                onClick={async () => {
                  if (isDownloading) return;
                  setIsDownloading(true);
                  try {
                    await downloadMeetingPdf({
                      meetingTitle: meeting.title,
                      meetingDate: meeting.createdAt,
                      duration: derivedDuration,
                      participants: derivedParticipants,
                      accountabilityItems: reportAccountabilityItems,
                      messages: reportMessages,
                      transcriptMoments: transcriptData ?? [],
                    });
                    actionToast("PDF downloaded");
                  } catch (error) {
                    console.error("PDF download failed", error);
                    toast.error("PDF download failed. Please try again.");
                  } finally {
                    setIsDownloading(false);
                  }
                }}
                className={actionButton}
              >
                {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download
              </button>
              <button
                onClick={() => actionToast("More options coming soon")}
                className={`${actionButton} px-2.5`}
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {meeting.status === "failed" && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3" role="alert">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Analysis failed. Your transcript is safe — please try again.
            </div>
            <Button variant="outline" size="sm" onClick={retryAnalysis}>
              <RotateCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Workspace tabs */}
      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transcript">Key Moments</TabsTrigger>
              <TabsTrigger value="accountability">Accountability</TabsTrigger>
              <TabsTrigger value="ask-ai">Ask AI</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-6">
              <OverviewTab data={overviewData} isLoading={isAnalyzing} />
            </TabsContent>
            <TabsContent value="transcript" className="mt-6">
              <TranscriptTab entries={transcriptData} isLoading={isAnalyzing} />
            </TabsContent>
              <TabsContent value="accountability" className="mt-6">
                <AccountabilityTab
                  key={meetingAnalysis ? "ai" : "mock"}
                  initialItems={accountabilityInitial}
                  onItemsChange={setReportAccountabilityItems}
                  participants={derivedParticipants.map((p) => p.name)}
                  isLoading={isAnalyzing}
                />
              </TabsContent>
            <TabsContent value="ask-ai" className="mt-6">
              <AskAITab
                onViewTranscript={() => setTab("transcript")}
                onMessagesChange={setReportMessages}
                analysis={meetingAnalysis}
                isProcessing={isAnalyzing}
              />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
