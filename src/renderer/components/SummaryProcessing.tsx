/**
 * Summary Processing Component
 *
 * Displays processing status with pass indicators and progress updates.
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 */

import type { SummaryStatusDisplay } from '../../types/meetingSummary'

interface SummaryProcessingProps {
  status: SummaryStatusDisplay
  onCancel: () => void
}

export function SummaryProcessing({ status, onCancel }: SummaryProcessingProps) {
  const formatElapsedTime = (minutes: number) => {
    if (minutes < 1) return 'Just started'
    if (minutes < 60) return `${Math.floor(minutes)} min`
    const hours = Math.floor(minutes / 60)
    const mins = Math.floor(minutes % 60)
    return `${hours}h ${mins}m`
  }

  const formatNextCheck = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    return `${mins}m`
  }

  const getPassStatus = (passNumber: 1 | 2) => {
    const currentPass = status.currentPass

    if (currentPass === null) {
      return 'pending'
    }

    if (passNumber < currentPass) {
      return 'complete'
    }

    if (passNumber === currentPass) {
      if (status.status.includes('submitted')) {
        return 'submitted'
      }
      return 'processing'
    }

    return 'pending'
  }

  const pass1Status = getPassStatus(1)
  const pass2Status = getPassStatus(2)

  const getStatusMessage = () => {
    switch (status.status) {
      case 'pending':
        return 'Preparing to start...'
      case 'pass1_submitted':
        return 'Pass 1: Batch submitted to Claude API'
      case 'pass1_processing':
        return 'Pass 1: Analyzing meeting, identifying speakers...'
      case 'pass1_complete':
        return 'Pass 1: Complete! Starting validation...'
      case 'pass2_submitted':
        return 'Pass 2: Batch submitted for validation'
      case 'pass2_processing':
        return 'Pass 2: Validating and refining summary...'
      case 'complete':
        return 'Summary complete!'
      case 'error':
        return status.errorMessage || 'An error occurred'
      case 'cancelled':
        return 'Cancelled by user'
      default:
        return 'Processing...'
    }
  }

  const isComplete = status.status === 'complete'
  const isError = status.status === 'error'
  const isCancelled = status.status === 'cancelled'
  const canCancel = !isComplete && !isError && !isCancelled

  return (
    <div className="summary-processing">
      <div className="processing-header">
        <h3>
          {isComplete ? '✅ Summary Complete' :
           isError ? '❌ Error' :
           isCancelled ? '⏹ Cancelled' :
           '⏳ Generating Summary'}
        </h3>
      </div>

      <div className="processing-status">
        <p className="status-message">{getStatusMessage()}</p>

        {!isComplete && !isError && !isCancelled && (
          <div className="processing-details">
            <span className="detail-item">
              ⏱️ Elapsed: {formatElapsedTime(status.elapsedMinutes)}
            </span>
            <span className="detail-item">
              🔄 Next check: {formatNextCheck(status.nextCheckInSeconds)}
            </span>
          </div>
        )}
      </div>

      <div className="pass-indicators">
        <div className={`pass-indicator pass-${pass1Status}`}>
          <div className="pass-icon">
            {pass1Status === 'complete' ? '✅' :
             pass1Status === 'processing' ? '⏳' :
             pass1Status === 'submitted' ? '📤' :
             '⏸️'}
          </div>
          <div className="pass-info">
            <h4>Pass 1: Initial Summary</h4>
            <p>Speaker identification + comprehensive summary</p>
          </div>
        </div>

        <div className="pass-arrow">→</div>

        <div className={`pass-indicator pass-${pass2Status}`}>
          <div className="pass-icon">
            {pass2Status === 'complete' ? '✅' :
             pass2Status === 'processing' ? '⏳' :
             pass2Status === 'submitted' ? '📤' :
             '⏸️'}
          </div>
          <div className="pass-info">
            <h4>Pass 2: Validation</h4>
            <p>Fact-checking + refinement</p>
          </div>
        </div>
      </div>

      {canCancel && (
        <button onClick={onCancel} className="btn btn-cancel">
          Cancel Generation
        </button>
      )}

      {!isComplete && !isError && !isCancelled && (
        <div className="processing-notice">
          <span className="notice-icon">ℹ️</span>
          <span>
            This process takes 30-60 minutes due to batch processing.
            You can close this app and check back later.
          </span>
        </div>
      )}
    </div>
  )
}
