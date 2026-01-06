# TDD Plan: Meeting Intelligence Error Recovery

**Date**: 2026-01-06
**Bug**: UI stuck in error state with no recovery options
**Impact**: Users cannot retry, cancel, or recover from batch processing errors without restarting app
**Priority**: CRITICAL (blocks user workflow)

---

## Problem Analysis

### The Screenshot Evidence

![Error State](../../Downloads/Screenshot%202026-01-06%20at%2012.38.29%20PM.png)

**What user sees:**
- ❌ Red "Error" heading
- Error message: "Failed to poll batch status: 500 Internal server error"
- Pass 1 and Pass 2 shown with pause icons
- **NO action buttons** (no Retry, Cancel, or Go Back)
- User is completely stuck

### Root Cause Analysis

#### Bug Location #1: `SummaryProcessing.tsx` Line 105

```typescript
const canCancel = !isComplete && !isError && !isCancelled
```

**Problem**: When `isError` is true, `canCancel` becomes false, hiding the "Cancel Generation" button (lines 165-169).

**Impact**: Button disappears precisely when user needs it most!

#### Bug Location #2: Missing Error Recovery UI

The component has three terminal states:
- `complete` ✅ - Shows summary
- `cancelled` ⏹ - Shows cancelled message
- `error` ❌ - Shows error BUT NO ACTIONS

**Missing actions in error state:**
- No "Retry" button to poll status again
- No "Cancel and Resubmit" to start fresh
- No "Go Back" to return to recording selection
- No "Clear Error" to reset state

#### Bug Location #3: Polling Stops on Error

`useMeetingIntelligence.ts` lines 88-95:

```typescript
const isProcessing =
  state.status.status === 'pass1_submitted' ||
  state.status.status === 'pass1_processing' ||
  // ... other processing states
  // 'error' is NOT included!

if (!isProcessing) return // Polling stops
```

When status becomes 'error', polling stops. User can't recover.

---

## User Scenarios

### Scenario A: Transient API Error (Common)
1. Batch processing for 30+ minutes
2. Anthropic API returns 500 error (server hiccup)
3. User stuck with error message
4. **Desired**: Retry polling - batch might still complete
5. **Actual**: Must restart app, lose context

### Scenario B: Long-Running Batch Timeout
1. Batch running for 2+ hours (longer than expected)
2. API returns error or rate limit
3. User wants to cancel and resubmit
4. **Desired**: "Cancel and Resubmit" button
5. **Actual**: Stuck, must restart app

### Scenario C: Wrong Recording Selected
1. Started intelligence for wrong meeting
2. Realizes mistake during processing
3. Wants to go back and select correct recording
4. **Desired**: "Go Back" button
5. **Actual**: Stuck, must restart app

---

## TDD Plan: RED → GREEN → REFACTOR

### Phase 1: RED - Write Failing Tests

#### Test 1: Error State Shows Recovery Actions

**File**: `tests/meeting-intelligence-error-recovery.test.tsx` (new)

```typescript
import { describe, it, expect, vi } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import { SummaryProcessing } from '../src/renderer/components/SummaryProcessing'
import type { SummaryStatusDisplay } from '../src/types/meetingSummary'

describe('SummaryProcessing Error Recovery', () => {
  it('should show Retry button when in error state', () => {
    const mockStatus: SummaryStatusDisplay = {
      status: 'error',
      currentPass: 1,
      elapsedMinutes: 45,
      errorMessage: 'API error: 500 Internal server error',
      backendNextCheckSeconds: null
    }

    const mockOnCancel = vi.fn()
    const mockOnRetry = vi.fn()
    const mockOnGoBack = vi.fn()

    render(
      <SummaryProcessing
        status={mockStatus}
        onCancel={mockOnCancel}
        onRetry={mockOnRetry}
        onGoBack={mockOnGoBack}
      />
    )

    // Assert: Retry button exists
    const retryButton = screen.getByText(/Retry Status Check/i)
    expect(retryButton).toBeInTheDocument()

    // Act: Click retry
    fireEvent.click(retryButton)

    // Assert: Handler called
    expect(mockOnRetry).toHaveBeenCalledOnce()
  })

  it('should show Go Back button when in error state', () => {
    const mockStatus: SummaryStatusDisplay = {
      status: 'error',
      currentPass: 1,
      elapsedMinutes: 45,
      errorMessage: 'Failed to poll batch status',
      backendNextCheckSeconds: null
    }

    const mockHandlers = {
      onCancel: vi.fn(),
      onRetry: vi.fn(),
      onGoBack: vi.fn()
    }

    render(<SummaryProcessing status={mockStatus} {...mockHandlers} />)

    // Assert: Go Back button exists
    const goBackButton = screen.getByText(/Go Back/i)
    expect(goBackButton).toBeInTheDocument()

    // Act: Click
    fireEvent.click(goBackButton)

    // Assert: Handler called
    expect(mockHandlers.onGoBack).toHaveBeenCalledOnce()
  })

  it('should show Cancel and Resubmit button when in error state', () => {
    const mockStatus: SummaryStatusDisplay = {
      status: 'error',
      currentPass: 2,
      elapsedMinutes: 120,
      errorMessage: 'Timeout error',
      backendNextCheckSeconds: null
    }

    const mockOnCancel = vi.fn()

    render(
      <SummaryProcessing
        status={mockStatus}
        onCancel={mockOnCancel}
        onRetry={vi.fn()}
        onGoBack={vi.fn()}
      />
    )

    // Assert: Cancel button exists
    const cancelButton = screen.getByText(/Cancel.*Resubmit/i)
    expect(cancelButton).toBeInTheDocument()
  })

  it('should NOT hide buttons when error occurs', () => {
    const mockStatus: SummaryStatusDisplay = {
      status: 'error',
      currentPass: 1,
      elapsedMinutes: 30,
      errorMessage: 'API Error',
      backendNextCheckSeconds: null
    }

    render(
      <SummaryProcessing
        status={mockStatus}
        onCancel={vi.fn()}
        onRetry={vi.fn()}
        onGoBack={vi.fn()}
      />
    )

    // Assert: At least one action button exists
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })
})
```

**Expected Result**: ❌ ALL TESTS FAIL (buttons don't exist in error state)

---

### Phase 2: GREEN - Make Tests Pass

#### Step 2.1: Update SummaryProcessing Component

**File**: `src/renderer/components/SummaryProcessing.tsx`

**Changes:**

1. **Add new props:**

```typescript
interface SummaryProcessingProps {
  status: SummaryStatusDisplay
  onCancel: () => void
  onRetry?: () => void  // NEW
  onGoBack?: () => void // NEW
}

export function SummaryProcessing({
  status,
  onCancel,
  onRetry,
  onGoBack
}: SummaryProcessingProps) {
  // ... existing code
```

2. **Fix canCancel logic (line 105):**

```typescript
// OLD:
const canCancel = !isComplete && !isError && !isCancelled

// NEW: Allow actions in error state
const canCancel = !isComplete && !isCancelled
const showErrorActions = isError
```

3. **Add error recovery UI (after line 169):**

```typescript
{canCancel && (
  <button onClick={onCancel} className="btn btn-cancel">
    Cancel Generation
  </button>
)}

{/* NEW: Error recovery actions */}
{showErrorActions && (
  <div className="error-actions">
    <p className="error-help-text">
      What would you like to do?
    </p>

    <div className="error-buttons">
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-primary"
          title="Check batch status again (in case of transient error)"
        >
          🔄 Retry Status Check
        </button>
      )}

      {onCancel && (
        <button
          onClick={onCancel}
          className="btn btn-warning"
          title="Cancel this batch and start a new one"
        >
          🔁 Cancel and Resubmit
        </button>
      )}

      {onGoBack && (
        <button
          onClick={onGoBack}
          className="btn btn-secondary"
          title="Return to recording selection"
        >
          ← Go Back
        </button>
      )}
    </div>

    <div className="error-advice">
      <span className="advice-icon">💡</span>
      <span className="advice-text">
        Transient errors: Try "Retry Status Check" first.
        If the batch is stuck, use "Cancel and Resubmit".
      </span>
    </div>
  </div>
)}

{!isComplete && !isError && !isCancelled && (
  <div className="processing-notice">
    {/* ... existing notice ... */}
  </div>
)}
```

#### Step 2.2: Wire Up Handlers in App.tsx

**File**: `src/renderer/App.tsx`

Find where `<SummaryProcessing />` is rendered and add handlers:

```typescript
{intelligenceState.status && (
  <SummaryProcessing
    status={intelligenceState.status}
    onCancel={async () => {
      if (intelligenceState.summaryId) {
        await intelligenceActions.cancel(intelligenceState.summaryId)
      }
    }}
    onRetry={async () => {
      // Retry status check
      if (intelligenceState.summaryId) {
        await intelligenceActions.fetchStatus(intelligenceState.summaryId)
      }
    }}
    onGoBack={() => {
      // Clear intelligence state and return to recording selection
      intelligenceActions.clear()
    }}
  />
)}
```

#### Step 2.3: Add TypeScript Types

**File**: `src/types/meetingSummary.ts` (if needed)

No changes needed - types already compatible.

#### Step 2.4: Add CSS Styles

**File**: `src/renderer/styles/index.css`

```css
.error-actions {
  margin-top: 24px;
  padding: 20px;
  background: #fff3cd;
  border-radius: 8px;
  border: 1px solid #ffc107;
}

.error-help-text {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 16px;
  text-align: center;
}

.error-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.error-buttons .btn {
  flex: 1;
  min-width: 160px;
  max-width: 220px;
}

.error-advice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
  font-size: 14px;
  color: #666;
}

.advice-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.advice-text {
  line-height: 1.5;
}

/* Button variants */
.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-warning {
  background: #ffc107;
  color: #000;
}

.btn-warning:hover {
  background: #e0a800;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #545b62;
}
```

**Expected Result**: ✅ Tests PASS - buttons now visible and functional

---

### Phase 3: REFACTOR - Improve Error Handling

#### Refactor 3.1: Add Retry with Exponential Backoff

When user clicks "Retry", implement smart retry:

```typescript
onRetry={async () => {
  if (!intelligenceState.summaryId) return

  // Show retrying state
  setRetryCount(prev => prev + 1)

  // Exponential backoff: 5s, 10s, 20s
  const delay = Math.min(5000 * Math.pow(2, retryCount), 20000)

  await new Promise(resolve => setTimeout(resolve, delay))
  await intelligenceActions.fetchStatus(intelligenceState.summaryId)
}}
```

#### Refactor 3.2: Persist Error Details for Debugging

Save error to database for debugging:

```typescript
// In useMeetingIntelligence.ts, when error occurs:
if (status && status.status === 'error') {
  // Log to database
  await window.electronAPI.database.logError({
    summaryId,
    error: status.errorMessage,
    timestamp: new Date().toISOString(),
    context: 'meeting-intelligence-polling'
  })
}
```

#### Refactor 3.3: Add Error Type Classification

Classify errors and suggest appropriate action:

```typescript
const classifyError = (errorMessage: string) => {
  if (errorMessage.includes('500')) {
    return {
      type: 'transient',
      suggestion: 'This might be temporary. Try "Retry Status Check".'
    }
  }
  if (errorMessage.includes('timeout')) {
    return {
      type: 'timeout',
      suggestion: 'The batch might be stuck. Use "Cancel and Resubmit".'
    }
  }
  return {
    type: 'unknown',
    suggestion: 'Try retrying first, then resubmit if issue persists.'
  }
}
```

---

## Testing Checklist

### Unit Tests
- [ ] Error state shows all three action buttons
- [ ] Retry button calls `onRetry` handler
- [ ] Cancel button calls `onCancel` handler
- [ ] Go Back button calls `onGoBack` handler
- [ ] Buttons have correct labels and tooltips
- [ ] Error advice text displays correctly

### Integration Tests
- [ ] Retry successfully polls status again
- [ ] Cancel and Resubmit clears state and allows new submission
- [ ] Go Back returns to recording selection UI
- [ ] Error state no longer blocks user workflow

### Manual Tests
- [ ] **Test 1**: Trigger API error → See recovery buttons
- [ ] **Test 2**: Click Retry → Status check runs again
- [ ] **Test 3**: Click Cancel → Can start new batch
- [ ] **Test 4**: Click Go Back → Returns to recording list
- [ ] **Test 5**: Error after 2 hours → All actions work

---

## Success Criteria

✅ **Error state shows actionable buttons** (Retry, Cancel, Go Back)
✅ **User can recover without restarting app**
✅ **Clear guidance** on which action to take
✅ **All tests pass** (unit + integration + manual)
✅ **No regression** in normal flow (non-error states)

---

## Rollback Plan

If bugs discovered:
1. Revert component changes
2. Keep new props optional (backward compatible)
3. Error state will show old behavior (no actions)
4. Document issue for future fix

---

## Files Modified

1. `tests/meeting-intelligence-error-recovery.test.tsx` (NEW)
2. `src/renderer/components/SummaryProcessing.tsx` - Add error recovery UI
3. `src/renderer/App.tsx` - Wire up handlers
4. `src/renderer/styles/index.css` - Add error action styles
5. `src/renderer/hooks/useMeetingIntelligence.ts` - Optional improvements

---

## Estimated Time

- **RED (Tests)**: 20 minutes
- **GREEN (Implementation)**: 40 minutes
- **REFACTOR (Improvements)**: 30 minutes
- **Manual Testing**: 20 minutes (need to trigger real error)
- **Total**: ~2 hours

---

## Priority vs Recording Database Bug

**This bug is HIGHER priority** because:
- Blocks user RIGHT NOW (user stuck with 44-min recording)
- No workaround except restarting app
- Affects active user workflow
- Simpler fix (UI only, no database changes)

**Suggested order:**
1. Fix this error recovery bug first (unlock user)
2. Then fix recording database bug (prevent future issues)
3. Both fixes can use same test session

---

## Notes

- **Bug discovered**: Jan 6, 2026 during 2-hour batch processing
- **Trigger**: Anthropic API 500 error after ~2 hours
- **User blocked**: Cannot retry, cancel, or recover
- **Impact**: HIGH - User must restart app, loses context
- **Workaround**: None (must restart)
- **Root cause**: UI hides buttons when error occurs (opposite of what user needs!)
