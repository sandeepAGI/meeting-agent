/**
 * Email Preview Component
 *
 * Preview formatted email before sending
 * Phase 4b: Summary Editor & Email
 * Phase 5: Uses emailGenerator utility for HTML generation
 */

import type { MeetingSummary, SpeakerMapping, ActionItem, DetailedNotes, EmailRecipient } from '../../types/meetingSummary'
import { generateEmailHTML } from '../../utils/emailGenerator'

interface EmailPreviewProps {
  summary: string
  speakers: SpeakerMapping[]
  actionItems: ActionItem[]
  keyDecisions: string[]
  detailedNotes: DetailedNotes | null
  recipients: EmailRecipient[]
  subjectLine: string
  onClose: () => void
  onSend?: () => void
  // Phase 5: Email sending state
  isSending?: boolean
  sendError?: string | null
  sendSuccess?: boolean
}

export function EmailPreview({
  summary,
  speakers,
  actionItems,
  keyDecisions,
  detailedNotes,
  recipients,
  subjectLine,
  onClose,
  onSend,
  isSending = false,
  sendError = null,
  sendSuccess = false
}: EmailPreviewProps) {
  // Generate email HTML using utility
  const emailHtml = generateEmailHTML({
    summary,
    speakers,
    actionItems,
    keyDecisions,
    detailedNotes
  })

  return (
    <div className="email-preview-overlay" onClick={onClose}>
      <div className="email-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="email-preview-header">
          <h3>📧 Email Preview</h3>
          <button onClick={onClose} className="btn-close" title="Close preview">
            ✕
          </button>
        </div>

        <div className="email-preview-meta">
          <div className="email-meta-row">
            <strong>To:</strong>
            <span>
              {recipients.length === 0 ? (
                <em style={{ color: '#999' }}>No recipients selected</em>
              ) : (
                recipients.map(r => r.name).join(', ')
              )}
            </span>
          </div>
          <div className="email-meta-row">
            <strong>Subject:</strong>
            <span>{subjectLine}</span>
          </div>
        </div>

        <div className="email-preview-body">
          <div dangerouslySetInnerHTML={{ __html: emailHtml }} />
        </div>

        <div className="email-preview-actions">
          {onSend && recipients.length > 0 && (
            <button
              onClick={onSend}
              className="btn btn-primary"
              disabled={isSending || sendSuccess}
            >
              {isSending ? '📤 Sending...' : sendSuccess ? '✅ Sent!' : '📤 Send Email'}
            </button>
          )}
          <button
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isSending}
          >
            Close
          </button>

          {/* Error/Success Messages */}
          {sendSuccess && !isSending && (
            <div className="success-message" style={{ marginTop: '10px', color: '#28a745' }}>
              ✅ Email sent successfully!
            </div>
          )}

          {sendError && !isSending && (
            <div className="error-message" style={{ marginTop: '10px', color: '#dc3545' }}>
              ❌ {sendError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
