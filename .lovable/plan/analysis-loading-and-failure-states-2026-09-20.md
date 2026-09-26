# Analysis loading and failure states

## Build
- Track meeting analysis as `analyzing`, `ready`, or `failed` while retaining the original transcript in the existing in-memory meeting record.
- Show the requested processing states in each workspace tab: section skeletons in Overview, eight shimmer rows in Transcript, two cards per Accountability column, and a disabled Ask AI composer reading “Processing transcript...”.
- Add a red failure banner at the top of the meeting view with the supplied message and a Retry button that reruns analysis for the same saved transcript.
- Update the New Meeting action to enter a submitting state with a spinner and “Analysing...” label when analysis starts.
- Keep Ask AI history intact on failures, show the failure directly beneath its user message, and let the retry icon resend that same question without duplicating the user bubble.

## Technical details
- Reuse the existing analysis server function, meeting store, Skeleton component, button styles, and current tab layouts.
- Pass a single `isAnalyzing` state into the four tabs so sample data never appears while processing.
- Validate successful, failed, and retry flows in the live preview without changing the analysis prompts or existing report behavior.
