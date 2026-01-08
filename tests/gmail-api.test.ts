/**
 * GmailApiService Tests
 * Phase 7: Gmail Integration - Task 2.2
 * TDD Approach: RED phase - Write failing tests first
 *
 * Tests Gmail API email sending functionality including MIME message
 * construction, Base64url encoding, and Gmail API integration.
 */

import { GmailApiService } from '../src/services/gmailApi'
import { GoogleAuthService } from '../src/services/googleAuth'

// Create mock send function
const mockGmailSend = jest.fn()

// Mock googleapis
jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(() => ({
      users: {
        messages: {
          send: mockGmailSend
        }
      }
    }))
  }
}))

describe('GmailApiService', () => {
  let gmailService: GmailApiService
  let mockAuthService: GoogleAuthService

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()

    // Mock GoogleAuthService
    mockAuthService = {
      getAuthenticatedClient: jest.fn()
    } as any

    gmailService = new GmailApiService(mockAuthService)
  })

  describe('MIME Message Construction', () => {
    it('should build basic MIME message with required headers', () => {
      const emailData = {
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test email body'
      }

      const mimeMessage = gmailService.buildMimeMessage(emailData)

      expect(mimeMessage).toContain('To: recipient@example.com')
      expect(mimeMessage).toContain('Subject: Test Subject')
      expect(mimeMessage).toContain('Content-Type: text/html; charset=utf-8')
      expect(mimeMessage).toContain('Test email body')
    })

    it('should handle multiple recipients in To field', () => {
      const emailData = {
        to: ['user1@example.com', 'user2@example.com', 'user3@example.com'],
        subject: 'Test',
        body: 'Body'
      }

      const mimeMessage = gmailService.buildMimeMessage(emailData)

      expect(mimeMessage).toContain('To: user1@example.com, user2@example.com, user3@example.com')
    })

    it('should handle CC recipients', () => {
      const emailData = {
        to: ['primary@example.com'],
        cc: ['cc1@example.com', 'cc2@example.com'],
        subject: 'Test',
        body: 'Body'
      }

      const mimeMessage = gmailService.buildMimeMessage(emailData)

      expect(mimeMessage).toContain('To: primary@example.com')
      expect(mimeMessage).toContain('Cc: cc1@example.com, cc2@example.com')
    })

    it('should handle BCC recipients', () => {
      const emailData = {
        to: ['primary@example.com'],
        bcc: ['bcc1@example.com'],
        subject: 'Test',
        body: 'Body'
      }

      const mimeMessage = gmailService.buildMimeMessage(emailData)

      expect(mimeMessage).toContain('Bcc: bcc1@example.com')
    })

    it('should set HTML content type', () => {
      const emailData = {
        to: ['test@example.com'],
        subject: 'HTML Test',
        body: '<h1>HTML Content</h1>'
      }

      const mimeMessage = gmailService.buildMimeMessage(emailData)

      expect(mimeMessage).toContain('Content-Type: text/html; charset=utf-8')
      expect(mimeMessage).toContain('<h1>HTML Content</h1>')
    })

    it('should include MIME-Version header', () => {
      const emailData = {
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Body'
      }

      const mimeMessage = gmailService.buildMimeMessage(emailData)

      expect(mimeMessage).toContain('MIME-Version: 1.0')
    })

    it('should handle empty CC/BCC gracefully', () => {
      const emailData = {
        to: ['test@example.com'],
        cc: [],
        bcc: [],
        subject: 'Test',
        body: 'Body'
      }

      const mimeMessage = gmailService.buildMimeMessage(emailData)

      expect(mimeMessage).not.toContain('Cc:')
      expect(mimeMessage).not.toContain('Bcc:')
    })

    it('should handle special characters in subject', () => {
      const emailData = {
        to: ['test@example.com'],
        subject: 'Test: Special "Characters" & Symbols',
        body: 'Body'
      }

      const mimeMessage = gmailService.buildMimeMessage(emailData)

      expect(mimeMessage).toContain('Subject: Test: Special "Characters" & Symbols')
    })

    it('should handle multiline body content', () => {
      const emailData = {
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Line 1\nLine 2\nLine 3'
      }

      const mimeMessage = gmailService.buildMimeMessage(emailData)

      expect(mimeMessage).toContain('Line 1\nLine 2\nLine 3')
    })
  })

  describe('Base64url Encoding', () => {
    it('should encode string to Base64url format', () => {
      const input = 'Hello, World!'
      const encoded = gmailService.encodeBase64url(input)

      // Base64url uses - and _ instead of + and /, and no padding
      expect(encoded).not.toContain('+')
      expect(encoded).not.toContain('/')
      expect(encoded).not.toContain('=')
    })

    it('should encode MIME message correctly', () => {
      const mimeMessage = 'To: test@example.com\nSubject: Test\n\nBody'
      const encoded = gmailService.encodeBase64url(mimeMessage)

      expect(typeof encoded).toBe('string')
      expect(encoded.length).toBeGreaterThan(0)
    })

    it('should handle empty string', () => {
      const encoded = gmailService.encodeBase64url('')
      expect(encoded).toBe('')
    })

    it('should handle unicode characters', () => {
      const input = 'Hello 世界 🌍'
      const encoded = gmailService.encodeBase64url(input)

      expect(encoded).toBeDefined()
      expect(encoded.length).toBeGreaterThan(0)
    })
  })

  describe('Email Sending', () => {
    it('should send email via Gmail API', async () => {
      const mockOAuth2Client = {
        credentials: { access_token: 'mock-token' }
      }

      ;(mockAuthService.getAuthenticatedClient as jest.Mock).mockResolvedValue(mockOAuth2Client)

      // Mock successful Gmail API response
      mockGmailSend.mockResolvedValue({
        data: { id: 'message-id-123', labelIds: ['SENT'] }
      })

      const emailData = {
        to: ['recipient@example.com'],
        subject: 'Test Email',
        body: 'Test body'
      }

      const result = await gmailService.sendEmail(emailData)

      expect(result).toBeDefined()
      expect(result.success).toBe(true)
      expect(result.messageId).toBe('message-id-123')
      expect(mockGmailSend).toHaveBeenCalled()
    })

    it('should handle Gmail API errors', async () => {
      const mockOAuth2Client = {
        credentials: { access_token: 'mock-token' }
      }

      ;(mockAuthService.getAuthenticatedClient as jest.Mock).mockResolvedValue(mockOAuth2Client)

      // Mock Gmail API error
      mockGmailSend.mockRejectedValue(new Error('Gmail API error'))

      const emailData = {
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Body'
      }

      const result = await gmailService.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })

    it('should validate email recipients before sending', () => {
      const invalidEmailData = {
        to: [],
        subject: 'Test',
        body: 'Body'
      }

      expect(() => {
        gmailService.buildMimeMessage(invalidEmailData)
      }).toThrow('At least one recipient is required')
    })

    it('should validate subject is not empty', () => {
      const invalidEmailData = {
        to: ['test@example.com'],
        subject: '',
        body: 'Body'
      }

      expect(() => {
        gmailService.buildMimeMessage(invalidEmailData)
      }).toThrow('Subject is required')
    })

    it('should return message ID on successful send', async () => {
      const mockOAuth2Client = {
        credentials: { access_token: 'mock-token' }
      }

      ;(mockAuthService.getAuthenticatedClient as jest.Mock).mockResolvedValue(mockOAuth2Client)

      // Mock successful Gmail API response
      mockGmailSend.mockResolvedValue({
        data: { id: 'msg-456' }
      })

      const emailData = {
        to: ['test@example.com'],
        subject: 'Success Test',
        body: 'Body'
      }

      const result = await gmailService.sendEmail(emailData)

      expect(result.success).toBe(true)
      expect(result.messageId).toBeDefined()
      expect(typeof result.messageId).toBe('string')
      expect(result.messageId).toBe('msg-456')
    })
  })

  describe('Email Data Validation', () => {
    it('should validate email format in To field', () => {
      const invalidData = {
        to: ['not-an-email'],
        subject: 'Test',
        body: 'Body'
      }

      expect(() => {
        gmailService.validateEmailData(invalidData)
      }).toThrow('Invalid email format')
    })

    it('should validate email format in CC field', () => {
      const invalidData = {
        to: ['valid@example.com'],
        cc: ['invalid-email'],
        subject: 'Test',
        body: 'Body'
      }

      expect(() => {
        gmailService.validateEmailData(invalidData)
      }).toThrow('Invalid email format')
    })

    it('should accept valid email formats', () => {
      const validData = {
        to: ['user@example.com', 'test.user+tag@domain.co.uk'],
        cc: ['cc@test.com'],
        subject: 'Test',
        body: 'Body'
      }

      expect(() => {
        gmailService.validateEmailData(validData)
      }).not.toThrow()
    })

    it('should validate body is not empty', () => {
      const invalidData = {
        to: ['test@example.com'],
        subject: 'Test',
        body: ''
      }

      expect(() => {
        gmailService.validateEmailData(invalidData)
      }).toThrow('Email body is required')
    })
  })

  describe('Integration with GoogleAuthService', () => {
    it('should use authenticated OAuth2 client for API calls', async () => {
      const mockClient = { credentials: { access_token: 'test-token' } }
      ;(mockAuthService.getAuthenticatedClient as jest.Mock).mockResolvedValue(mockClient)

      // Mock successful send
      mockGmailSend.mockResolvedValue({
        data: { id: 'test-id' }
      })

      const emailData = {
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Body'
      }

      await gmailService.sendEmail(emailData)

      expect(mockAuthService.getAuthenticatedClient).toHaveBeenCalled()
    })

    it('should handle authentication failure', async () => {
      ;(mockAuthService.getAuthenticatedClient as jest.Mock).mockRejectedValue(
        new Error('Not authenticated')
      )

      const emailData = {
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Body'
      }

      const result = await gmailService.sendEmail(emailData)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Not authenticated')
    })
  })
})
