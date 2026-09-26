# Transcript workspace

## Build
- Fill the Transcript tab with realistic mock meeting dialogue showing speaker, timestamp, and text.
- Add transcript search and a speaker filter that work together and show a clear empty result when nothing matches.
- Mark important moments with a restrained visual indicator and label.
- Add copy controls for each entry and for the currently visible transcript, with confirmation messages.

## Design
- Match the existing MeetIQ typography, spacing, semantic colors, icons, and compact card styling.
- Keep the transcript easy to scan on desktop and mobile without changing the other workspace tabs.

## Technical details
- Keep all data and interactions in the existing meeting workspace page using local mock data and React state.
- Reuse the existing design-system controls and Sonner confirmation pattern.
- Verify search, filtering, copying, important markers, and responsive layout in the live preview.
