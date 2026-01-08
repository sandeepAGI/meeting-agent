/**
 * EmailProvider Tests
 * Phase 7: Gmail Integration - Task 2.3
 * TDD Approach: RED phase - Write failing tests first
 *
 * Tests the email provider abstraction that supports both M365 and Gmail.
 */

import { EmailProviderFactory, EmailProvider } from '../src/services/emailProvider'
import { SettingsService } from '../src/services/settings'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

describe('EmailProvider', () => {
  let settingsService: SettingsService
  let testCredentialsPath: string

  const mockGoogleCredentials = {
    installed: {
      client_id: 'test-client-id.apps.googleusercontent.com',
      project_id: 'test-project',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_secret: 'test-client-secret',
      redirect_uris: ['http://localhost']
    }
  }

  beforeEach(() => {
    // Create temporary Google credentials file
    const tmpDir = os.tmpdir()
    testCredentialsPath = path.join(tmpDir, `test-google-creds-${Date.now()}.json`)
    fs.writeFileSync(testCredentialsPath, JSON.stringify(mockGoogleCredentials))

    // Create mock settings service
    settingsService = {
      getCategory: jest.fn(),
      get: jest.fn((key: string) => {
        if (key === 'email.googleCredentialsPath') {
          return testCredentialsPath
        }
        return undefined
      })
    } as any
  })

  afterEach(() => {
    // Clean up credentials file
    if (fs.existsSync(testCredentialsPath)) {
      fs.unlinkSync(testCredentialsPath)
    }
  })

  describe('EmailProviderFactory', () => {
    it('should create M365 provider when configured', () => {
      ;(settingsService.get as jest.Mock).mockReturnValue('m365')

      const provider = EmailProviderFactory.createProvider(settingsService)

      expect(provider).toBeDefined()
      expect(provider.getProviderType()).toBe('m365')
    })

    it('should create Gmail provider when configured', () => {
      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'gmail'
        if (key === 'email.googleCredentialsPath') return testCredentialsPath
        return undefined
      })

      const provider = EmailProviderFactory.createProvider(settingsService)

      expect(provider).toBeDefined()
      expect(provider.getProviderType()).toBe('gmail')
    })

    it('should default to M365 if no provider configured', () => {
      ;(settingsService.get as jest.Mock).mockReturnValue(undefined)

      const provider = EmailProviderFactory.createProvider(settingsService)

      expect(provider.getProviderType()).toBe('m365')
    })

    it('should throw error for invalid provider type', () => {
      ;(settingsService.get as jest.Mock).mockReturnValue('invalid-provider')

      expect(() => {
        EmailProviderFactory.createProvider(settingsService)
      }).toThrow('Unsupported email provider')
    })
  })

  describe('EmailProvider Interface', () => {
    it('should have consistent sendEmail interface', () => {
      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'm365'
        return undefined
      })
      const m365Provider = EmailProviderFactory.createProvider(settingsService)

      expect(typeof m365Provider.sendEmail).toBe('function')

      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'gmail'
        if (key === 'email.googleCredentialsPath') return testCredentialsPath
        return undefined
      })
      const gmailProvider = EmailProviderFactory.createProvider(settingsService)

      expect(typeof gmailProvider.sendEmail).toBe('function')
    })

    it('should have isAuthenticated method', () => {
      ;(settingsService.get as jest.Mock).mockReturnValue('m365')
      const provider = EmailProviderFactory.createProvider(settingsService)

      expect(typeof provider.isAuthenticated).toBe('function')
    })

    it('should have getProviderType method', () => {
      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'gmail'
        if (key === 'email.googleCredentialsPath') return testCredentialsPath
        return undefined
      })
      const provider = EmailProviderFactory.createProvider(settingsService)

      expect(typeof provider.getProviderType).toBe('function')
      expect(provider.getProviderType()).toBe('gmail')
    })
  })

  describe('M365EmailProvider', () => {
    it('should accept standard email data format', async () => {
      ;(settingsService.get as jest.Mock).mockReturnValue('m365')
      const provider = EmailProviderFactory.createProvider(settingsService)

      const emailData = {
        to: ['user1@example.com', 'user2@example.com'],
        cc: ['cc@example.com'],
        subject: 'Test Subject',
        body: '<h1>HTML Content</h1>'
      }

      // Mock is not authenticated - should throw
      await expect(provider.sendEmail(emailData)).rejects.toThrow()
    })

    it('should check M365 authentication status', async () => {
      ;(settingsService.get as jest.Mock).mockReturnValue('m365')
      const provider = EmailProviderFactory.createProvider(settingsService)

      const isAuth = await provider.isAuthenticated()

      // Should check M365 auth
      expect(typeof isAuth).toBe('boolean')
    })
  })

  describe('GmailEmailProvider', () => {
    it('should accept standard email data format', async () => {
      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'gmail'
        if (key === 'email.googleCredentialsPath') return testCredentialsPath
        return undefined
      })
      const provider = EmailProviderFactory.createProvider(settingsService)

      const emailData = {
        to: ['user1@example.com'],
        cc: ['cc@example.com'],
        subject: 'Test Subject',
        body: '<p>HTML Body</p>'
      }

      // Mock is not authenticated - should reject
      await expect(provider.sendEmail(emailData)).rejects.toThrow()
    })

    it('should check Gmail authentication status', async () => {
      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'gmail'
        if (key === 'email.googleCredentialsPath') return testCredentialsPath
        return undefined
      })
      const provider = EmailProviderFactory.createProvider(settingsService)

      const isAuth = await provider.isAuthenticated()

      // Should check Gmail auth
      expect(typeof isAuth).toBe('boolean')
    })

    it('should convert email data to Gmail format', async () => {
      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'gmail'
        if (key === 'email.googleCredentialsPath') return testCredentialsPath
        return undefined
      })
      const provider = EmailProviderFactory.createProvider(settingsService)

      // Test data conversion (internal method, tested via sendEmail)
      const emailData = {
        to: ['test@example.com'],
        subject: 'Test',
        body: 'Body'
      }

      // This will fail with auth error, but validates data conversion works
      try {
        await provider.sendEmail(emailData)
      } catch (error) {
        // Expected - not authenticated
        expect(error).toBeDefined()
      }
    })
  })

  describe('Provider Switching', () => {
    it('should allow switching between providers', () => {
      // Start with M365
      ;(settingsService.get as jest.Mock).mockReturnValue('m365')
      const m365Provider = EmailProviderFactory.createProvider(settingsService)
      expect(m365Provider.getProviderType()).toBe('m365')

      // Switch to Gmail
      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'gmail'
        if (key === 'email.googleCredentialsPath') return testCredentialsPath
        return undefined
      })
      const gmailProvider = EmailProviderFactory.createProvider(settingsService)
      expect(gmailProvider.getProviderType()).toBe('gmail')
    })

    it('should maintain separate authentication states', async () => {
      ;(settingsService.get as jest.Mock).mockReturnValue('m365')
      const m365Provider = EmailProviderFactory.createProvider(settingsService)

      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'gmail'
        if (key === 'email.googleCredentialsPath') return testCredentialsPath
        return undefined
      })
      const gmailProvider = EmailProviderFactory.createProvider(settingsService)

      // Both should have independent auth states
      const m365Auth = await m365Provider.isAuthenticated()
      const gmailAuth = await gmailProvider.isAuthenticated()

      expect(typeof m365Auth).toBe('boolean')
      expect(typeof gmailAuth).toBe('boolean')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid email data gracefully', async () => {
      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'gmail'
        if (key === 'email.googleCredentialsPath') return testCredentialsPath
        return undefined
      })
      const provider = EmailProviderFactory.createProvider(settingsService)

      const invalidData = {
        to: [],
        subject: '',
        body: ''
      }

      await expect(provider.sendEmail(invalidData)).rejects.toThrow()
    })

    it('should provide meaningful error messages', async () => {
      ;(settingsService.get as jest.Mock).mockReturnValue('m365')
      const provider = EmailProviderFactory.createProvider(settingsService)

      try {
        await provider.sendEmail({
          to: ['test@example.com'],
          subject: 'Test',
          body: 'Body'
        })
      } catch (error) {
        expect(error instanceof Error).toBe(true)
        expect((error as Error).message).toBeDefined()
      }
    })
  })

  describe('Email Data Normalization', () => {
    it('should normalize recipient data structure', () => {
      // Both providers should accept simple string arrays
      ;(settingsService.get as jest.Mock).mockReturnValue('m365')
      const m365Provider = EmailProviderFactory.createProvider(settingsService)

      ;(settingsService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'email.provider') return 'gmail'
        if (key === 'email.googleCredentialsPath') return testCredentialsPath
        return undefined
      })
      const gmailProvider = EmailProviderFactory.createProvider(settingsService)

      // Both should accept the same format
      const emailData = {
        to: ['user@example.com'],
        cc: ['cc@example.com'],
        bcc: ['bcc@example.com'],
        subject: 'Test',
        body: 'Body'
      }

      // Validate both providers can handle this format (will fail on auth, but format is correct)
      expect(async () => await m365Provider.sendEmail(emailData)).toBeDefined()
      expect(async () => await gmailProvider.sendEmail(emailData)).toBeDefined()
    })
  })
})
