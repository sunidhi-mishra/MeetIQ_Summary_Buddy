# Accountability Board

## Goal
Add the Accountability tab shown in the reference, using realistic mock meeting data and exactly three columns.

## Interface
- Add the title “Accountability Board” and the supplied subtitle.
- Build three side-by-side desktop columns that stack cleanly on smaller screens:
  1. Confirmed Commitments — “Firm, owned, dated”
  2. Orphaned Commitments — “Decided, but nobody owns it”
  3. Passing Remarks — “Logged, not actioned”
- Match the reference’s restrained green, amber, and neutral column treatments, count badges, white item cards, source details, owners, due dates, confidence labels, and subtle shadows.
- Populate each column with realistic mock entries corresponding to the meeting transcript.

## Interaction
- Allow cards to move only between Confirmed Commitments and Orphaned Commitments.
- Keep Passing Remarks fixed and visibly non-draggable.
- Support drag-over feedback and update column counts immediately after a move.
- Show a brief confirmation message naming the item’s new column.
- Preserve the existing global header, meeting details, tabs, and other tab contents unchanged.

## Validation
- Verify both permitted move directions.
- Confirm cards cannot be moved into or out of Passing Remarks.
- Check desktop and narrow layouts, tab navigation, and confirmation messages.
