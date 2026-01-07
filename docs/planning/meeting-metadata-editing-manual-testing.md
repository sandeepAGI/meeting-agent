# Manual Testing Checklist: Meeting Metadata Editing & Participant Deletion

**Feature**: Meeting title/datetime editing and participant deletion
**Status**: Ready for manual testing
**Last Updated**: 2026-01-07

---

## Prerequisites

- [ ] Application builds successfully (`npm run build`)
- [ ] All automated tests pass (95 tests across 7 suites)
- [ ] Dev environment runs (`npm run dev`)

---

## Test Scenarios

### 1. Meeting Title Editing

#### 1.1 Edit Meeting Title - Happy Path
- [ ] Open Summary View for a meeting linked to a calendar event
- [ ] Verify MeetingMetadataEditor is displayed at top with current title
- [ ] Click "Edit" button
- [ ] Verify title input field appears with current value pre-filled
- [ ] Change title to "New Meeting Title"
- [ ] Click "Save"
- [ ] Verify "Saving..." loading state appears
- [ ] Verify edit mode closes and returns to view mode
- [ ] Verify new title is displayed
- [ ] Verify no error messages appear

#### 1.2 Edit Meeting Title - Validation Errors
- [ ] Enter edit mode
- [ ] Clear title completely (empty string)
- [ ] Click "Save"
- [ ] Verify error message: "Title cannot be empty"
- [ ] Verify stays in edit mode
- [ ] Enter valid title and save successfully

#### 1.3 Edit Meeting Title - Cancel
- [ ] Enter edit mode
- [ ] Change title to something different
- [ ] Click "Cancel"
- [ ] Verify original title is restored
- [ ] Verify no save operation occurred

#### 1.4 Edit Meeting Title - Standalone Recording
- [ ] Open Summary View for standalone recording (no calendar meeting)
- [ ] Verify MeetingMetadataEditor displays with current title
- [ ] Verify title editing works same as calendar meeting

---

### 2. Meeting Date/Time Editing

#### 2.1 Edit Date/Time - Happy Path
- [ ] Open Summary View for a meeting
- [ ] Click "Edit" button
- [ ] Verify date picker shows current date
- [ ] Verify start time picker shows current start time
- [ ] Verify end time picker shows current end time
- [ ] Change start time to 10:00 AM
- [ ] Change end time to 11:00 AM
- [ ] Click "Save"
- [ ] Verify times are updated in view mode

#### 2.2 Edit Date/Time - Validation: End Before Start
- [ ] Enter edit mode
- [ ] Set start time to 3:00 PM
- [ ] Set end time to 2:00 PM (before start)
- [ ] Click "Save"
- [ ] Verify error message: "End time must be after start time"
- [ ] Verify stays in edit mode
- [ ] Set valid times and save successfully

#### 2.3 Edit Date/Time - Same Start and End
- [ ] Enter edit mode
- [ ] Set start and end time to same value (e.g., 2:00 PM)
- [ ] Click "Save"
- [ ] Verify error message: "End time must be after start time"

#### 2.4 Edit Date - Change Day
- [ ] Enter edit mode
- [ ] Change date to tomorrow
- [ ] Keep times same
- [ ] Click "Save"
- [ ] Verify date is updated in view mode
- [ ] Verify times remain correct

---

### 3. Combined Title + DateTime Editing

#### 3.1 Edit Both in Single Session
- [ ] Enter edit mode
- [ ] Change title from "Weekly Standup" to "Daily Sync"
- [ ] Change start time from 2:00 PM to 10:00 AM
- [ ] Change end time from 3:00 PM to 11:00 AM
- [ ] Click "Save"
- [ ] Verify both title AND times are updated
- [ ] Verify only one save operation (no double save)

---

### 4. Participant Deletion - Calendar Meeting

#### 4.1 View Attendees List
- [ ] Open Summary View for meeting with multiple attendees
- [ ] Scroll to RecipientSelector component
- [ ] Verify all attendees from calendar are listed
- [ ] Verify organizer has "Organizer" badge
- [ ] Verify delete button (✕) appears next to each attendee

#### 4.2 Delete Button States
- [ ] Verify organizer's delete button is disabled (opacity: 0.3)
- [ ] Hover over organizer's delete button
- [ ] Verify tooltip: "Cannot delete organizer"
- [ ] Verify non-organizer delete buttons are enabled
- [ ] Hover over non-organizer delete button
- [ ] Verify tooltip: "Delete attendee"

#### 4.3 Delete Attendee - Happy Path
- [ ] Click delete (✕) button for "Bob Johnson"
- [ ] Verify confirmation dialog appears
- [ ] Verify dialog text: "Are you sure you want to remove Bob Johnson (bob@example.com) from this meeting?"
- [ ] Verify note: "This will not affect speaker mappings in existing transcripts"
- [ ] Verify "Cancel" and "Confirm" buttons present
- [ ] Click "Confirm"
- [ ] Verify dialog closes
- [ ] Verify "Bob Johnson" removed from attendee list
- [ ] Verify other attendees remain

#### 4.4 Delete Attendee - Cancel
- [ ] Click delete for an attendee
- [ ] Verify confirmation dialog appears
- [ ] Click "Cancel"
- [ ] Verify dialog closes
- [ ] Verify attendee remains in list (not deleted)

#### 4.5 Delete Attendee - Who Was Selected
- [ ] Select "Carol White" as email recipient (checkbox checked)
- [ ] Click delete for "Carol White"
- [ ] Confirm deletion
- [ ] Verify "Carol White" removed from attendees list
- [ ] Verify "Carol White" removed from Selected Recipients list

#### 4.6 Delete Multiple Attendees
- [ ] Delete first non-organizer attendee
- [ ] Verify deletion successful
- [ ] Delete second non-organizer attendee
- [ ] Verify deletion successful
- [ ] Verify only organizer remains in attendee list

#### 4.7 Attempt to Delete Organizer
- [ ] Try to click organizer's delete button
- [ ] Verify button is disabled (no click occurs)
- [ ] OR if API call somehow triggered (shouldn't happen):
  - [ ] Verify error message appears
  - [ ] Verify organizer remains in list

---

### 5. Participant Deletion - Standalone Recording

#### 5.1 View Custom Recipients
- [ ] Open Summary View for standalone recording
- [ ] Verify "Add Custom Recipient" form is shown
- [ ] Verify no calendar attendees shown
- [ ] Add custom recipient: "test@example.com"
- [ ] Verify recipient appears in Selected Recipients
- [ ] Verify can remove custom recipient with ✕ button

---

### 6. Error Handling

#### 6.1 Network/API Failures - Title Update
- [ ] Disconnect from network (or use dev tools to block requests)
- [ ] Try to update meeting title
- [ ] Verify error message displayed
- [ ] Reconnect network
- [ ] Verify can retry successfully

#### 6.2 Network/API Failures - Delete Attendee
- [ ] Disconnect from network
- [ ] Try to delete attendee
- [ ] Confirm in dialog
- [ ] Verify error message displayed
- [ ] Verify attendee still in list (deletion failed)
- [ ] Reconnect and retry successfully

#### 6.3 Non-Existent Meeting
- [ ] Use dev tools to call `updateMeetingSubject('fake-id', 'Title')`
- [ ] Verify returns `{success: false, error: 'Meeting not found'}`

---

### 7. Data Persistence

#### 7.1 Title Persists Across Refresh
- [ ] Edit meeting title
- [ ] Save successfully
- [ ] Refresh browser (F5)
- [ ] Verify new title still displayed

#### 7.2 DateTime Persists Across Refresh
- [ ] Edit meeting date/time
- [ ] Save successfully
- [ ] Refresh browser
- [ ] Verify new date/time still displayed

#### 7.3 Deletion Persists Across Refresh
- [ ] Delete an attendee
- [ ] Refresh browser
- [ ] Verify attendee still removed from list

---

### 8. Edge Cases

#### 8.1 Very Long Title
- [ ] Edit title
- [ ] Paste 300 characters
- [ ] Save
- [ ] Verify title truncated to 200 characters
- [ ] No error message (silent truncation)

#### 8.2 Title with Special Characters
- [ ] Edit title to: `"Meeting: O'Reilly's Q&A <Strategic> Plan"`
- [ ] Save
- [ ] Verify title saved correctly with all special chars

#### 8.3 All-Day Meeting
- [ ] Edit meeting with all-day event
- [ ] Verify date picker works
- [ ] Verify time pickers work correctly

#### 8.4 Meeting with No Attendees
- [ ] View meeting that has empty attendees_json
- [ ] Verify no crash
- [ ] Verify empty state or message displayed

---

### 9. Regression Testing

#### 9.1 Existing Features Still Work
- [ ] Verify transcription still works
- [ ] Verify diarization still works
- [ ] Verify summary generation still works
- [ ] Verify email sending still works
- [ ] Verify calendar sync still works

#### 9.2 Summary View Not Broken
- [ ] Verify summary text displays correctly
- [ ] Verify speaker mappings display correctly
- [ ] Verify action items display correctly
- [ ] Verify email preview works

---

## Test Results

### Test Run 1: [Date]
**Tester**: [Name]
**Environment**: Dev / Production
**Build Version**: [Version]

- [ ] All scenarios passed
- [ ] Some scenarios failed (document below)

**Failed Scenarios**:
```
[List any failed tests and details]
```

**Bugs Found**:
```
[List any bugs discovered during testing]
```

---

## Sign-Off

- [ ] All test scenarios completed
- [ ] All critical bugs resolved
- [ ] Feature ready for production

**Tested By**: ________________
**Date**: ________________
**Approved By**: ________________
**Date**: ________________
