# TDD Plan: Meeting Metadata Editing & Participant Deletion

**Feature Request**: Add editable meeting title, date/time, and participant deletion capability

**Status**: Planning
**Created**: 2026-01-07
**Target**: Phase 6+

---

## Current State Analysis

### What Exists
✅ **Database Storage** (`meetings` table):
- `subject` (meeting title/subject)
- `start_time`, `end_time` (date and time)
- `attendees_json` (JSON array of participants)
- `organizer_name`, `organizer_email`

✅ **Data Retrieval**:
- `database.ts:getMeeting(meetingId)` - Fetch meeting metadata
- `graphApi.ts:getMeetingById(eventId)` - Sync from M365

✅ **Participant Editing** (Partial):
- `RecipientSelector.tsx` - Select attendees for email, add custom recipients
- `SummaryDisplay.tsx` - Edit speaker mappings (name, email, confidence)

### What's Missing
❌ **Meeting Metadata Display/Editing**:
- Meeting title (subject) not shown in summary UI
- Date and time not shown or editable
- No UI component for editing these fields

❌ **Participant Deletion**:
- Can only edit participant names/emails
- Cannot remove participants from the list
- RecipientSelector only supports selection (checkbox), not deletion

---

## Requirements Specification

### R1: Display Meeting Metadata
**As a user**, I want to see the meeting title, date, and time in the summary view, so I can verify the meeting context.

**Acceptance Criteria**:
- Meeting subject/title displayed prominently at top of summary
- Meeting date displayed in readable format (e.g., "Monday, January 7, 2026")
- Meeting time displayed in readable format (e.g., "2:00 PM - 3:00 PM")
- For standalone recordings (no meeting_id), show placeholder or "Untitled Recording"

---

### R2: Edit Meeting Title
**As a user**, I want to edit the meeting title, so I can correct inaccurate or generic titles from calendar sync.

**Acceptance Criteria**:
- Click-to-edit or edit button for meeting title
- Text input field with current title pre-filled
- Save/Cancel buttons
- Title validation: non-empty, max 200 characters
- Database update via `updateMeetingSubject(meetingId, newSubject)`
- Real-time UI update after save
- Error handling for save failures

**Edge Cases**:
- Empty title → Show validation error
- Very long title → Truncate at 200 chars
- Standalone recording → Allow editing, save to recordings table
- Calendar-synced meeting → Update local copy (not M365 calendar)

---

### R3: Edit Meeting Date and Time
**As a user**, I want to edit the meeting date and time, so I can correct scheduling errors or adjust for recordings that started late.

**Acceptance Criteria**:
- Date picker for start date
- Time pickers for start time and end time
- Validation: end time must be after start time
- Database update via `updateMeetingDateTime(meetingId, startTime, endTime)`
- Real-time UI update after save
- Error handling for invalid date/time combinations

**Edge Cases**:
- End time before start time → Show validation error
- Past date → Allow (historical meetings valid)
- Standalone recording → Allow editing, save to recordings table
- Cross-midnight meetings → Support end time on next day

---

### R4: Delete Participants
**As a user**, I want to delete participants from the attendee list, so I can remove incorrect or irrelevant people.

**Acceptance Criteria**:
- Delete button (×, trash icon) next to each participant in RecipientSelector
- Confirmation dialog: "Remove [Name] from attendees?"
- Database update via `deleteMeetingAttendee(meetingId, attendeeEmail)`
- Real-time UI update after deletion
- Cannot delete organizer (disable delete button)
- For standalone recordings, delete from custom recipients list

**Edge Cases**:
- Last attendee → Allow deletion (organizer remains)
- Organizer deletion attempt → Disable or show error
- Participant already in final_recipients_json → Remove from there too
- Participant in speaker mappings → Keep speaker mapping (don't cascade delete)

---

## TDD Implementation Plan

### Phase 1: Database Layer Tests

#### Test Suite: `database.test.ts` (NEW)

**Test 1.1**: Update meeting subject
```typescript
describe('updateMeetingSubject', () => {
  it('should update meeting subject successfully', async () => {
    // GIVEN: A meeting exists with subject "Weekly Standup"
    // WHEN: updateMeetingSubject(meetingId, "Daily Standup")
    // THEN: Database should have new subject
    // AND: updated_at timestamp should be updated
  })

  it('should reject empty subject', async () => {
    // GIVEN: A meeting exists
    // WHEN: updateMeetingSubject(meetingId, "")
    // THEN: Should throw validation error
  })

  it('should truncate subject at 200 characters', async () => {
    // GIVEN: A meeting exists
    // WHEN: updateMeetingSubject(meetingId, "A".repeat(300))
    // THEN: Subject should be truncated to 200 chars
  })

  it('should return false for non-existent meeting', async () => {
    // GIVEN: Meeting does not exist
    // WHEN: updateMeetingSubject("fake-id", "New Title")
    // THEN: Should return false
  })
})
```

**Test 1.2**: Update meeting date/time
```typescript
describe('updateMeetingDateTime', () => {
  it('should update start and end times successfully', async () => {
    // GIVEN: Meeting with start=2PM, end=3PM
    // WHEN: updateMeetingDateTime(meetingId, 3PM, 4PM)
    // THEN: Database should have new times
  })

  it('should reject end time before start time', async () => {
    // GIVEN: Meeting exists
    // WHEN: updateMeetingDateTime(meetingId, 3PM, 2PM)
    // THEN: Should throw validation error
  })

  it('should support cross-midnight meetings', async () => {
    // GIVEN: Meeting exists
    // WHEN: updateMeetingDateTime(meetingId, 11PM today, 1AM tomorrow)
    // THEN: Should save correctly with end > start
  })
})
```

**Test 1.3**: Delete meeting attendee
```typescript
describe('deleteMeetingAttendee', () => {
  it('should remove attendee from attendees_json', async () => {
    // GIVEN: Meeting with 3 attendees
    // WHEN: deleteMeetingAttendee(meetingId, "bob@example.com")
    // THEN: attendees_json should have 2 attendees
    // AND: Bob should be removed
  })

  it('should prevent deletion of organizer', async () => {
    // GIVEN: Meeting with organizer alice@example.com
    // WHEN: deleteMeetingAttendee(meetingId, "alice@example.com")
    // THEN: Should throw error or return false
  })

  it('should handle non-existent attendee gracefully', async () => {
    // GIVEN: Meeting with 3 attendees
    // WHEN: deleteMeetingAttendee(meetingId, "nothere@example.com")
    // THEN: Should return false (no change)
  })

  it('should update both meetings.attendees_json and related summaries', async () => {
    // GIVEN: Meeting with summary containing final_recipients_json
    // WHEN: deleteMeetingAttendee(meetingId, "bob@example.com")
    // THEN: Bob should be removed from both attendees_json and final_recipients_json
  })
})
```

---

### Phase 2: IPC Handler Tests

#### Test Suite: `ipc-handlers.test.ts` (NEW)

**Test 2.1**: IPC handler for updating subject
```typescript
describe('ipcMain.handle("update-meeting-subject")', () => {
  it('should call database service and return success', async () => {
    // GIVEN: Database service mocked
    // WHEN: ipcMain.handle("update-meeting-subject", meetingId, "New Title")
    // THEN: Should call dbService.updateMeetingSubject
    // AND: Return {success: true, result: updatedMeeting}
  })

  it('should return error on validation failure', async () => {
    // GIVEN: Database service throws validation error
    // WHEN: ipcMain.handle("update-meeting-subject", meetingId, "")
    // THEN: Return {success: false, error: "Subject cannot be empty"}
  })
})
```

**Test 2.2**: IPC handler for updating date/time
```typescript
describe('ipcMain.handle("update-meeting-datetime")', () => {
  it('should call database service with parsed dates', async () => {
    // GIVEN: ISO date strings passed from renderer
    // WHEN: ipcMain.handle("update-meeting-datetime", meetingId, startISO, endISO)
    // THEN: Should parse dates and call dbService.updateMeetingDateTime
  })

  it('should validate end > start before calling database', async () => {
    // GIVEN: End time before start time
    // WHEN: Handler called
    // THEN: Return error without calling database
  })
})
```

**Test 2.3**: IPC handler for deleting attendee
```typescript
describe('ipcMain.handle("delete-meeting-attendee")', () => {
  it('should call database service and return success', async () => {
    // GIVEN: Valid meeting and attendee
    // WHEN: ipcMain.handle("delete-meeting-attendee", meetingId, email)
    // THEN: Should call dbService.deleteMeetingAttendee
  })

  it('should prevent organizer deletion', async () => {
    // GIVEN: Attempting to delete organizer
    // WHEN: Handler called
    // THEN: Return error without calling database
  })
})
```

---

### Phase 3: UI Component Tests

#### Test Suite: `MeetingMetadataEditor.test.tsx` (NEW COMPONENT)

**Test 3.1**: Display meeting metadata
```typescript
describe('MeetingMetadataEditor - Display', () => {
  it('should render meeting title, date, and time', () => {
    // GIVEN: Meeting with subject="Weekly Standup", date=2026-01-07, time=2PM-3PM
    // WHEN: Component renders
    // THEN: Should display all three fields
  })

  it('should show "Untitled Recording" for standalone recordings', () => {
    // GIVEN: Recording with no meeting_id
    // WHEN: Component renders
    // THEN: Should show placeholder text
  })
})
```

**Test 3.2**: Edit meeting title
```typescript
describe('MeetingMetadataEditor - Title Editing', () => {
  it('should enable edit mode on click', () => {
    // GIVEN: Component in view mode
    // WHEN: User clicks title or edit button
    // THEN: Should show input field with current value
  })

  it('should save edited title on save button click', async () => {
    // GIVEN: Component in edit mode with new title
    // WHEN: User clicks save
    // THEN: Should call window.electronAPI.updateMeetingSubject
    // AND: Show success message
  })

  it('should show validation error for empty title', () => {
    // GIVEN: Component in edit mode
    // WHEN: User clears title and clicks save
    // THEN: Should show error message
    // AND: Not call API
  })
})
```

**Test 3.3**: Edit date and time
```typescript
describe('MeetingMetadataEditor - DateTime Editing', () => {
  it('should validate end time after start time', () => {
    // GIVEN: Date picker with start=3PM
    // WHEN: User selects end=2PM
    // THEN: Should show validation error
  })

  it('should save valid date/time changes', async () => {
    // GIVEN: Valid new start and end times
    // WHEN: User clicks save
    // THEN: Should call window.electronAPI.updateMeetingDateTime
  })
})
```

---

#### Test Suite: `RecipientSelector.test.tsx` (UPDATE EXISTING)

**Test 3.4**: Delete participant
```typescript
describe('RecipientSelector - Delete Functionality', () => {
  it('should show delete button for each attendee', () => {
    // GIVEN: Meeting with 3 attendees
    // WHEN: Component renders
    // THEN: Each row should have delete button
  })

  it('should disable delete button for organizer', () => {
    // GIVEN: Organizer in attendee list
    // WHEN: Component renders
    // THEN: Organizer's delete button should be disabled
  })

  it('should show confirmation dialog on delete click', async () => {
    // GIVEN: User clicks delete on attendee "Bob"
    // WHEN: Delete button clicked
    // THEN: Confirmation modal should appear with Bob's name
  })

  it('should call delete API on confirmation', async () => {
    // GIVEN: Confirmation dialog open
    // WHEN: User clicks "Confirm"
    // THEN: Should call window.electronAPI.deleteMeetingAttendee
    // AND: Remove from UI list
  })

  it('should close dialog and keep attendee on cancel', () => {
    // GIVEN: Confirmation dialog open
    // WHEN: User clicks "Cancel"
    // THEN: Dialog closes, attendee remains
  })
})
```

---

### Phase 4: Integration Tests

#### Test Suite: `meeting-metadata-editing.integration.test.ts` (NEW)

**Test 4.1**: End-to-end title editing
```typescript
it('should update meeting title across database and UI', async () => {
  // GIVEN: Real database with meeting
  // WHEN: Update title via IPC → Database → UI refresh
  // THEN: All layers should reflect new title
})
```

**Test 4.2**: End-to-end participant deletion
```typescript
it('should delete attendee and update recipient selector', async () => {
  // GIVEN: Meeting with summary and recipients selected
  // WHEN: Delete attendee via IPC → Database → UI refresh
  // THEN: Attendee removed from all views
  // AND: final_recipients_json updated
})
```

**Test 4.3**: Validation error propagation
```typescript
it('should propagate validation errors from database to UI', async () => {
  // GIVEN: Attempt to set invalid date/time
  // WHEN: Save via IPC
  // THEN: Error should appear in UI toast/alert
})
```

---

## Implementation Order (RED → GREEN → REFACTOR)

### Step 1: Database Layer (RED)
1. Write failing tests for `updateMeetingSubject()`
2. Write failing tests for `updateMeetingDateTime()`
3. Write failing tests for `deleteMeetingAttendee()`

### Step 2: Database Layer (GREEN)
4. Implement `updateMeetingSubject()` in `database.ts`
5. Implement `updateMeetingDateTime()` in `database.ts`
6. Implement `deleteMeetingAttendee()` in `database.ts`
7. All database tests should pass ✅

### Step 3: IPC Layer (RED)
8. Write failing tests for IPC handlers
9. Expose new methods in `preload.ts` type definitions

### Step 4: IPC Layer (GREEN)
10. Implement IPC handlers in `main.ts`
11. Add context bridge methods in `preload.ts`
12. All IPC tests should pass ✅

### Step 5: UI Layer (RED)
13. Write failing tests for `MeetingMetadataEditor` component
14. Write failing tests for updated `RecipientSelector`

### Step 6: UI Layer (GREEN)
15. Create `MeetingMetadataEditor.tsx` component
16. Update `RecipientSelector.tsx` with delete functionality
17. Integrate `MeetingMetadataEditor` into `SummaryDisplay.tsx`
18. All UI tests should pass ✅

### Step 7: Integration (RED → GREEN)
19. Write end-to-end integration tests
20. Fix any cross-layer issues
21. All integration tests should pass ✅

### Step 8: Refactor
22. Extract reusable validation logic
23. Improve error messages
24. Add loading states and optimistic UI updates
25. Code review and cleanup

---

## Test Coverage Goals

- **Database Layer**: 100% coverage for new methods
- **IPC Layer**: 100% coverage for new handlers
- **UI Components**: 80%+ coverage (focus on logic, not rendering)
- **Integration**: Cover all happy paths + critical edge cases

---

## Manual Testing Checklist

After all automated tests pass, perform manual testing:

### Meeting Title Editing
- [ ] Edit calendar-synced meeting title
- [ ] Edit standalone recording title
- [ ] Try empty title (should show validation error)
- [ ] Try very long title (should truncate)
- [ ] Verify title updates in database (check via sqlite3)

### Date/Time Editing
- [ ] Edit start time to earlier
- [ ] Edit end time to later
- [ ] Try end before start (should show validation error)
- [ ] Try cross-midnight meeting
- [ ] Verify times update in database

### Participant Deletion
- [ ] Delete regular attendee from calendar meeting
- [ ] Try to delete organizer (should be disabled)
- [ ] Delete custom recipient from standalone recording
- [ ] Verify deletion in database attendees_json
- [ ] Verify recipient selector updates immediately
- [ ] Check that speaker mappings still work after deletion

### Error Handling
- [ ] Test with no internet (calendar sync failure)
- [ ] Test with database locked
- [ ] Test with invalid meeting_id

---

## Database Schema Changes

**Option 1**: No schema changes needed (recommended)
- Use existing `meetings.subject`, `start_time`, `end_time`
- Use existing `attendees_json` for participant deletion
- Add `updated_at` trigger if not exists

**Option 2**: Add audit trail (optional, future enhancement)
```sql
ALTER TABLE meetings ADD COLUMN subject_edited_at DATETIME;
ALTER TABLE meetings ADD COLUMN datetime_edited_at DATETIME;
ALTER TABLE meetings ADD COLUMN attendees_edited_at DATETIME;
```

**Recommendation**: Start with Option 1, defer audit trail to later phase.

---

## API Surface Changes

### New IPC Methods (Preload/Main)

```typescript
// preload.ts additions
export interface ElectronAPI {
  // ... existing methods

  // Meeting metadata editing
  updateMeetingSubject(meetingId: string, subject: string): Promise<{success: boolean, result?: Meeting, error?: string}>
  updateMeetingDateTime(meetingId: string, startTime: string, endTime: string): Promise<{success: boolean, result?: Meeting, error?: string}>
  deleteMeetingAttendee(meetingId: string, attendeeEmail: string): Promise<{success: boolean, error?: string}>
}
```

### New Database Service Methods

```typescript
// database.ts additions
class DatabaseService {
  // ... existing methods

  updateMeetingSubject(meetingId: string, subject: string): boolean
  updateMeetingDateTime(meetingId: string, startTime: Date, endTime: Date): boolean
  deleteMeetingAttendee(meetingId: string, attendeeEmail: string): boolean
}
```

---

## UI/UX Design Notes

### Meeting Metadata Display (Top of Summary View)

```
┌─────────────────────────────────────────────────────────┐
│ 📅 Weekly Team Standup                          [Edit]  │
│ Monday, January 7, 2026 • 2:00 PM - 3:00 PM            │
│ Organized by Alice Smith (alice@company.com)           │
└─────────────────────────────────────────────────────────┘
```

### Edit Mode

```
┌─────────────────────────────────────────────────────────┐
│ Meeting Title:                                          │
│ [Weekly Team Standup________________________]           │
│                                                         │
│ Date:          Start Time:      End Time:              │
│ [01/07/2026]   [02:00 PM ▾]    [03:00 PM ▾]           │
│                                                         │
│                               [Cancel] [Save Changes]   │
└─────────────────────────────────────────────────────────┘
```

### Participant List with Delete

```
Email Recipients:
☑ Alice Smith (alice@company.com) [Organizer - can't delete]
☑ Bob Johnson (bob@company.com)                        [×]
☑ Carol White (carol@company.com)                      [×]

[+ Add Custom Recipient]
```

---

## Dependencies

**New Dependencies**: None required (use existing libraries)

**Existing Dependencies Used**:
- React date/time pickers (check current UI library)
- better-sqlite3 (database operations)
- electron IPC (communication)

---

## Risk Assessment

### Low Risk
✅ Database operations (simple UPDATE/DELETE on existing tables)
✅ UI components (isolated, testable)

### Medium Risk
⚠️ **Participant deletion cascade effects**
  - Mitigation: Explicitly test speaker mappings still work
  - Mitigation: Don't auto-delete from speaker mappings

⚠️ **Date/time validation complexity**
  - Mitigation: Use proven date library (date-fns or native Date)
  - Mitigation: Comprehensive test cases

### High Risk
🔴 **Calendar sync conflicts**
  - Issue: User edits local copy, then calendar syncs from M365
  - Mitigation: Add `manually_edited` flag to prevent sync overwrite
  - Mitigation: Document that edits are local only

---

## Success Criteria

### Functionality
✅ All automated tests pass (database, IPC, UI, integration)
✅ Manual testing checklist completed
✅ `npm run type-check` passes
✅ `npm run build` succeeds

### Code Quality
✅ TDD approach followed (RED → GREEN → REFACTOR)
✅ Test coverage meets goals (100% DB, 100% IPC, 80%+ UI)
✅ Error handling for all edge cases
✅ No regressions in existing features

### Documentation
✅ Update CHANGELOG.md with new features
✅ Update `docs/technical/` with new IPC methods
✅ Update `docs/developer/architecture.md` if needed
✅ Add user-facing documentation for editing features

---

## Timeline Estimate (No Specific Dates)

**Phase 1-2** (Database + IPC): ~8-10 tests, 3 new methods each layer
**Phase 3** (UI Components): ~12-15 tests, 1 new component + 1 updated
**Phase 4** (Integration): ~3-5 tests
**Phase 5** (Manual Testing): Full checklist validation

**Total Estimated Tests**: ~25-30 automated tests

---

## Questions for Clarification

1. **Meeting Title vs Subject**: Prefer "Meeting Title" or "Meeting Subject" in UI? (Recommendation: "Meeting Title" is more user-friendly)

2. **Date/Time Editing for Standalone Recordings**: Should standalone recordings also have editable date/time, or just linked calendar meetings? (Recommendation: Allow for both)

3. **Participant Deletion Scope**: Should deletion also remove participant from speaker mappings, or keep speaker mappings intact? (Recommendation: Keep speaker mappings, only remove from attendees list)

4. **Calendar Sync Override**: After user edits meeting metadata locally, should future calendar syncs overwrite changes? (Recommendation: Add `manually_edited` flag and preserve user edits)

5. **UI Location**: Should meeting metadata editor be:
   - At top of SummaryDisplay (above summary text)? ✅ Recommended
   - In a separate tab/section?
   - In a modal dialog?

---

## Next Steps

1. **User Confirmation**: Review this TDD plan and answer clarification questions
2. **Setup Test Infrastructure**: Ensure Jest/Vitest configured for all layers
3. **Begin Phase 1**: Start with database layer tests (RED)
4. **Iterate**: Follow RED → GREEN → REFACTOR cycle through all phases
