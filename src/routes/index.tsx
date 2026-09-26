import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";
import {
  Plus,
  Sparkles,
  CheckCircle2,
  Upload,
  FileText,
  X,
  Loader2,
  Clock,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  addMeeting,
  getMeetingsSnapshot,
  setMeetingAnalysis,
  setMeetingFailed,
  subscribeMeetings,
} from "@/lib/meetings";
import { analyzeTranscript } from "@/lib/ai.functions";
import { addLogEntry } from "@/lib/sessionLog";


export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "MeetIQ - Meeting Summarizer" },
      {
        name: "description",
        content:
          "Turn your meeting transcripts into decisions, actions, and accountability.",
      },
      {
        property: "og:title",
        content: "MeetIQ - Meeting Summarizer",
      },
      {
        property: "og:description",
        content:
          "Turn your meeting transcripts into decisions, actions, and accountability.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [transcriptTab, setTranscriptTab] = useState<"upload" | "paste">(
    "paste"
  );
  const meetings = useSyncExternalStore(
    subscribeMeetings,
    getMeetingsSnapshot,
    getMeetingsSnapshot
  );
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasTranscript =
    transcriptTab === "upload"
      ? fileContent.trim().length > 0
      : transcriptText.trim().length > 0;
  const canAnalyze = title.trim().length > 0 && hasTranscript;

  const resetDialog = () => {
    setTitle("");
    setTranscriptText("");
    setFileName(null);
    setFileContent("");
    setTranscriptTab("paste");
  };

  const loadDemoTranscript = () => {
    setTitle("Demo — Product Launch Sync");
    setTranscriptText(`10:02 AM - Priya Nair: Good morning everyone. Today I want us to leave with a confirmed launch date, pricing locked, and clear owners for every open item.

10:04 AM - Sarah Chen: The onboarding flow tested well in beta. Copy still needs a final pass but I don't think it should hold the launch.

10:06 AM - Daniel Kim: Engineering is ready. One caveat — data sync reliability is our biggest risk right now. I can draft a mitigation and rollback plan by Friday.

10:09 AM - Aisha Patel: On pricing, research supports the lower option. Twelve dollars per seat keeps us competitive and gives sales a simple story for beta customers.

10:11 AM - Priya Nair: Agreed. Let's confirm twelve dollars per seat for beta. We'll revisit packaging after the first month of usage data.

10:14 AM - Marco Ruiz: Marketing can prepare the launch announcement now. I'll hold publication until Sarah signs off on the onboarding copy and Daniel confirms the sync test passed.

10:17 AM - Sarah Chen: I'll own the onboarding copy and have it done by September 24th.

10:19 AM - Daniel Kim: I'll complete the sync reliability review and send the mitigation plan to the team by September 22nd.

10:21 AM - Aisha Patel: I'll update the pricing page for the beta tier by September 25th.

10:23 AM - Priya Nair: Great. Marco prepares the announcement but holds until Sarah and Daniel confirm. We should also think about whether existing trial users get migrated to the new pricing automatically — but let's not decide that today.

10:26 AM - Marco Ruiz: Agreed. One more thing — someone should own the support readiness checklist before launch. We need to make sure the team is briefed on the new pricing.

10:28 AM - Priya Nair: Good point. Let's make sure that gets assigned. We'll do a final readiness check next Tuesday at 10 AM.`);
  };

  const handleDialogFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ok = /\.(md|txt)$/i.test(file.name);
    if (!ok) {
      toast.error("Unsupported file type. Please upload a .md or .txt file.");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileContent(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleAnalyze = () => {
    if (!canAnalyze || isSubmitting) return;
    setIsSubmitting(true);
    const meeting = {
      id: Date.now(),
      title: title.trim(),
      createdAt: new Date(),
      transcript:
        transcriptTab === "upload" ? fileContent : transcriptText.trim(),
    };
    window.setTimeout(() => {
      addMeeting(meeting);
      setDialogOpen(false);
      resetDialog();
      navigate({
        to: "/meeting/$id",
        params: { id: String(meeting.id) },
      });
      const start = performance.now();
      analyzeTranscript({
        data: { title: meeting.title, transcript: meeting.transcript },
      })
        .then((analysis) => {
          setMeetingAnalysis(meeting.id, analysis);
          addLogEntry({
            callType: "CALL 1",
            status: "SUCCESS",
            description: `Transcript analysed — ${analysis.transcript_moments.length} moments, ${analysis.commitments.length} commitments extracted`,
            responseTime: Math.round(performance.now() - start),
          });
        })
        .catch((error) => {
          console.error("Meeting analysis failed", error);
          setMeetingFailed(meeting.id);
          addLogEntry({
            callType: "CALL 1",
            status: "FAILED",
            description: "Transcript analysis failed",
            responseTime: Math.round(performance.now() - start),
          });
        });
    }, 150);
  };


  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt"
        className="hidden"
        onChange={handleDialogFile}
      />

      <main className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="mb-2 text-xs font-bold tracking-[0.15em] text-muted-foreground/70">
                MY WORKSPACE
              </p>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Hello there{" "}
                <span role="img" aria-label="wave">
                  👋
                </span>
              </h1>
              <p className="mt-1.5 text-muted-foreground">
                Turn your meeting transcripts into decisions, actions, and
                accountability.
              </p>
            </div>
            <button
              onClick={() => setDialogOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Upload transcript
            </button>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8">
            <div className="relative z-10 max-w-xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground">
                <Sparkles className="h-4 w-4" />
                Meeting intelligence, with accountability
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                Meeting accountability, without the data risk.
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                Upload your transcript. Get a full accountability report.
                <br className="hidden sm:block" />
                Your data is never stored.
              </p>
              <button
                onClick={() => setDialogOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Upload transcript
              </button>
            </div>

            {/* Decorative overlapping rings */}
            <div className="pointer-events-none absolute -right-16 -top-24 h-[28rem] w-[28rem] rounded-full border-[18px] border-primary/10" />
            <div className="pointer-events-none absolute -bottom-32 -right-8 h-[26rem] w-[26rem] rounded-full border-[18px] border-primary/5" />
            <div className="pointer-events-none absolute -right-6 top-20 h-40 w-40 rounded-full border-[14px] border-primary/5" />
          </div>

          {/* Recent Meetings */}
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                This Session
              </h2>
              {meetings.length > 0 && (
                <span className="text-sm text-muted-foreground">
                  {meetings.length}{" "}
                  {meetings.length === 1 ? "meeting" : "meetings"}
                </span>
              )}
            </div>

            {meetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground">
                  No meetings yet
                </p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Transcripts you process in this tab will appear here. Nothing
                  is saved when you close or refresh.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {meetings.map((m) => (
                  <div
                    key={m.id}
                    onClick={() =>
                      navigate({
                        to: "/meeting/$id",
                        params: { id: String(m.id) },
                      })
                    }
                    className="cursor-pointer rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                        <FileText className="h-5 w-5" />
                      </div>
                      {m.status === "analyzing" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Analyzing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Ready
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 truncate font-semibold text-foreground">
                      {m.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.createdAt.toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* New meeting dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New meeting</DialogTitle>
            <DialogDescription>
              Add a title and provide the transcript — upload a file or paste it
              directly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="meeting-title">
                Meeting Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="meeting-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for this meeting"
              />
            </div>

            <Tabs
              value={transcriptTab}
              onValueChange={(v) => setTranscriptTab(v as "upload" | "paste")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Upload File</TabsTrigger>
                <TabsTrigger value="paste">Paste Transcript</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                {fileName ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-5 w-5 shrink-0 text-primary" />
                      <span className="truncate text-sm font-medium text-foreground">
                        {fileName}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setFileName(null);
                        setFileContent("");
                      }}
                      className="ml-3 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-secondary/30 px-4 py-8 transition-colors hover:border-primary/40 hover:bg-secondary/50"
                  >
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Upload className="h-5 w-5" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      Click to upload a transcript
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      Accepted formats: .md, .txt
                    </span>
                  </button>
                )}
                {fileName && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Accepted formats: .md, .txt
                  </p>
                )}
              </TabsContent>

              <TabsContent value="paste" className="mt-4">
                <div className="mb-2 flex justify-end">
                  <button
                    type="button"
                    onClick={loadDemoTranscript}
                    className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-medium text-[#3B82F6] hover:opacity-80"
                    style={{ textDecoration: "none" }}
                  >
                    Load demo transcript
                  </button>
                </div>
                <Textarea
                  value={transcriptText}
                  onChange={(e) => setTranscriptText(e.target.value)}
                  placeholder="Paste your meeting transcript here..."
                  className="min-h-[160px] resize-y"
                />
              </TabsContent>
            </Tabs>

            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze || isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isSubmitting ? "Analysing..." : "Analyze Meeting"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
