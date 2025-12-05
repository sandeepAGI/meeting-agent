/**
 * Email Section Toggles Component
 *
 * Allows users to show/hide sections in the email
 * Phase 5.5: Enhanced Email Customization
 */

import { useState } from 'react'
import type { EmailSectionToggles as EmailSectionTogglesType } from '../../types/meetingSummary'

interface EmailSectionTogglesProps {
  initialSections: EmailSectionTogglesType
  onChange: (sections: EmailSectionTogglesType) => void
}

// Section metadata with display names and descriptions
const SECTION_INFO = [
  {
    key: 'summary' as keyof EmailSectionTogglesType,
    label: 'Summary',
    description: 'Executive summary of the meeting',
    icon: '📄'
  },
  {
    key: 'participants' as keyof EmailSectionTogglesType,
    label: 'Participants',
    description: 'List of meeting attendees',
    icon: '👥'
  },
  {
    key: 'actionItems' as keyof EmailSectionTogglesType,
    label: 'Action Items',
    description: 'Tasks assigned during the meeting',
    icon: '✅'
  },
  {
    key: 'decisions' as keyof EmailSectionTogglesType,
    label: 'Key Decisions',
    description: 'Important decisions made',
    icon: '🎯'
  },
  {
    key: 'discussionTopics' as keyof EmailSectionTogglesType,
    label: 'Discussion Topics',
    description: 'Detailed notes organized by topic',
    icon: '💬'
  },
  {
    key: 'quotes' as keyof EmailSectionTogglesType,
    label: 'Notable Quotes',
    description: 'Important statements from participants',
    icon: '💭'
  },
  {
    key: 'questions' as keyof EmailSectionTogglesType,
    label: 'Open Questions',
    description: 'Unresolved questions to follow up on',
    icon: '❓'
  },
  {
    key: 'parkingLot' as keyof EmailSectionTogglesType,
    label: 'Parking Lot',
    description: 'Topics deferred for later discussion',
    icon: '🅿️'
  }
]

export function EmailSectionToggles({ initialSections, onChange }: EmailSectionTogglesProps) {
  // Track sections state locally - initialized from props but managed locally
  // We do NOT sync from props after initial mount to prevent infinite loops
  const [sections, setSections] = useState<EmailSectionTogglesType>(initialSections)

  // Handle toggle - call onChange immediately on user interaction
  const handleToggle = (key: keyof EmailSectionTogglesType) => {
    const newSections = {
      ...sections,
      [key]: !sections[key]
    }
    setSections(newSections)
    onChange(newSections)
  }

  const handleSelectAll = () => {
    const allEnabled: EmailSectionTogglesType = {
      summary: true,
      participants: true,
      actionItems: true,
      decisions: true,
      discussionTopics: true,
      quotes: true,
      questions: true,
      parkingLot: true
    }
    setSections(allEnabled)
    onChange(allEnabled)
  }

  const handleDeselectAll = () => {
    const allDisabled: EmailSectionTogglesType = {
      summary: false,
      participants: false,
      actionItems: false,
      decisions: false,
      discussionTopics: false,
      quotes: false,
      questions: false,
      parkingLot: false
    }
    setSections(allDisabled)
    onChange(allDisabled)
  }

  const enabledCount = Object.values(sections).filter(Boolean).length

  return (
    <div style={{ marginTop: '30px', marginBottom: '30px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '15px'
      }}>
        <h3 style={{
          color: '#2D2042',
          fontSize: '18px',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>📧</span>
          <span>Email Sections</span>
          <span style={{
            fontSize: '14px',
            color: '#777',
            fontWeight: 'normal'
          }}>
            ({enabledCount}/8 enabled)
          </span>
        </h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleSelectAll}
            style={{
              padding: '6px 12px',
              background: '#60B5E5',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            style={{
              padding: '6px 12px',
              background: '#95a5a6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            Deselect All
          </button>
        </div>
      </div>

      <div style={{
        background: '#f8f8f8',
        padding: '20px',
        borderRadius: '8px',
        border: '1px solid #e0e0e0'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '12px'
        }}>
          {SECTION_INFO.map(section => (
            <label
              key={section.key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px',
                background: 'white',
                borderRadius: '6px',
                border: `2px solid ${sections[section.key] ? '#60B5E5' : '#e0e0e0'}`,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                ...(sections[section.key] ? {
                  boxShadow: '0 2px 4px rgba(96, 181, 229, 0.2)'
                } : {})
              }}
              onMouseOver={(e) => {
                if (!sections[section.key]) {
                  e.currentTarget.style.borderColor = '#ccc'
                }
              }}
              onMouseOut={(e) => {
                if (!sections[section.key]) {
                  e.currentTarget.style.borderColor = '#e0e0e0'
                }
              }}
            >
              <input
                type="checkbox"
                checked={sections[section.key]}
                onChange={() => handleToggle(section.key)}
                style={{
                  marginTop: '2px',
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer',
                  accentColor: '#60B5E5'
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px'
                }}>
                  <span style={{ fontSize: '16px' }}>{section.icon}</span>
                  <span style={{
                    fontWeight: '600',
                    color: '#2D2042',
                    fontSize: '14px'
                  }}>
                    {section.label}
                  </span>
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#666',
                  lineHeight: '1.4'
                }}>
                  {section.description}
                </div>
              </div>
            </label>
          ))}
        </div>

        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: '#EBF4FF',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#555',
          lineHeight: '1.5'
        }}>
          <strong>💡 Tip:</strong> Uncheck sections to hide them from the email. The AI disclaimer will always be included.
        </div>
      </div>
    </div>
  )
}
