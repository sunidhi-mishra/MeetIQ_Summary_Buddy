<div align="center">

# MeetIQ

### Meeting intelligence with accountability built in

Turn meeting transcripts into clear summaries, decisions, action items, key moments, and accountable follow-through.

<a href="https://meetiq-summary-buddy.lovable.app/"><img src="https://img.shields.io/badge/Launch%20Live%20App-2563EB?style=for-the-badge&logo=rocket&logoColor=white" alt="Launch the live MeetIQ app"></a>
<a href="https://docs.google.com/presentation/d/1KqYdM2I8PjgXH84iuWKtGgmgKXHUazYeFoFup97dXpQ/edit?usp=sharing"><img src="https://img.shields.io/badge/View%20Project%20Presentation-EA4335?style=for-the-badge&logo=google-slides&logoColor=white" alt="View the MeetIQ project presentation"></a>

</div>

## Overview

MeetIQ is a transcript-to-accountability workspace. Add a meeting transcript by pasting text or uploading a `.md` or `.txt` file, then review an AI-generated report in one focused workspace.

The product is designed to distinguish between:

- **Confirmed commitments**: owned and dated work.
- **Orphaned commitments**: commitments that still need an owner or date.
- **Passing remarks**: ideas and possibilities that were discussed but should not automatically become tasks.

## Features

- Transcript upload or paste workflow with a built-in demo transcript.
- AI-generated executive summary, takeaways, decisions, questions, and topics.
- Key-moment extraction with search, speaker filtering, and copy actions.
- Accountability board with drag-and-drop reassignment and owner/date assignment.
- Ask MeetIQ conversational Q&A grounded in the meeting analysis.
- Retry flow for failed transcript analysis.
- PDF report download and email sharing through the browser.
- Admin view for inspecting AI prompt blocks and this session's AI call log.
- Responsive interface built with Tailwind CSS, Radix UI, and Lucide icons.

## Tech Stack

- [TanStack Start](https://tanstack.com/start) with TanStack Router
- React 19 and TypeScript
- Vite 8
- Tailwind CSS 4
- Radix UI primitives with shadcn-style components
- Zod for server-function input validation
- Lovable AI gateway for transcript analysis and meeting Q&A
- `date-fns`, `sonner`, `react-day-picker`, and `lucide-react`

## Getting Started

### Prerequisites

- Node.js 18 or newer
- npm or Bun
- A Lovable API key for AI features

### Install dependencies

```bash
npm install
```

### Configure the AI gateway

Set `LOVABLE_API_KEY` in the environment used by the TanStack Start server. The key is read only by server functions and is never hardcoded in the client.

PowerShell:

```powershell
$env:LOVABLE_API_KEY = "your-api-key"
```

### Start the development server

```bash
npm run dev
```

Open the local URL printed by Vite, typically `http://localhost:8080/`.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create a production build |
| `npm run build:dev` | Create a development-mode build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format the project with Prettier |

## Application Routes

| Route | Purpose |
| --- | --- |
| `/` | Workspace home and transcript intake |
| `/meeting/:id` | Meeting summary, key moments, accountability, and Ask AI workspace |
| `/admin` | System prompt reference and session AI-call log |

## Project Structure

```text
src/
	components/       Shared header and UI primitives
	hooks/             Reusable React hooks
	lib/
		ai.functions.ts Server-side AI gateway functions
		analysis.ts     AI prompts and analysis types
		meetings.ts     In-memory meeting store
		sessionLog.ts   In-memory AI call log
	routes/            TanStack file-based routes
	router.tsx         Router and React Query setup
	server.ts          SSR entry and error normalization
	start.ts           TanStack Start middleware configuration
	styles.css         Tailwind theme and design tokens
```

## Data and Privacy Notes

Meetings and AI call logs are held in in-memory stores for the current session. They are not persisted by this application and disappear after a refresh or restart. Transcript content is sent to the configured Lovable AI gateway when analysis or Q&A is requested.

The application includes server-side error handling, CSRF protection for server functions, and validation of AI function inputs with Zod.

## External Links

- [Open the live MeetIQ app](https://meetiq-summary-buddy.lovable.app/)
- [View the MeetIQ project presentation](https://docs.google.com/presentation/d/1KqYdM2I8PjgXH84iuWKtGgmgKXHUazYeFoFup97dXpQ/edit?usp=sharing)
