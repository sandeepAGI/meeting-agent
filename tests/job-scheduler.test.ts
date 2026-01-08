/**
 * Job Scheduler Tests
 * Phase 7: Storage Management - Task 1.1
 * TDD Approach: RED phase - Write failing tests first
 */

import { JobScheduler } from '../src/services/jobScheduler'
import type { DatabaseService } from '../src/services/database'
import type { SettingsService } from '../src/services/settings'

describe('JobScheduler', () => {
  let scheduler: JobScheduler
  let setIntervalSpy: jest.SpyInstance
  let clearIntervalSpy: jest.SpyInstance
  let mockDbService: Partial<DatabaseService>
  let mockSettingsService: Partial<SettingsService>

  beforeEach(() => {
    jest.useFakeTimers()
    setIntervalSpy = jest.spyOn(global, 'setInterval')
    clearIntervalSpy = jest.spyOn(global, 'clearInterval')

    // Create mock services
    mockDbService = {
      cleanupOldTranscripts: jest.fn().mockReturnValue({ deletedCount: 0 })
    }
    mockSettingsService = {
      getCategory: jest.fn().mockReturnValue({ transcriptRetentionDays: 90 })
    }
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.restoreAllMocks()
  })

  it('should start with 24-hour interval', () => {
    scheduler = new JobScheduler(mockDbService as DatabaseService, mockSettingsService as SettingsService)
    scheduler.start()

    // Verify setInterval called with 24 hours in milliseconds
    expect(setIntervalSpy).toHaveBeenCalledWith(
      expect.any(Function),
      24 * 60 * 60 * 1000
    )
  })

  it('should run cleanup immediately on start', async () => {
    scheduler = new JobScheduler(mockDbService as DatabaseService, mockSettingsService as SettingsService)

    // Spy on private method via prototype
    const runCleanupSpy = jest.spyOn(scheduler as any, 'runRetentionCleanup')
      .mockResolvedValue(undefined)

    scheduler.start()

    // Should call cleanup immediately (not wait for interval)
    expect(runCleanupSpy).toHaveBeenCalledTimes(1)
  })

  it('should stop interval on stop()', () => {
    scheduler = new JobScheduler(mockDbService as DatabaseService, mockSettingsService as SettingsService)
    scheduler.start()

    const intervalId = setIntervalSpy.mock.results[0].value

    scheduler.stop()

    expect(clearIntervalSpy).toHaveBeenCalledWith(intervalId)
  })

  it('should call all cleanup methods', async () => {
    scheduler = new JobScheduler(mockDbService as DatabaseService, mockSettingsService as SettingsService)

    // Spy on private cleanup methods
    const cleanupTranscriptsSpy = jest.spyOn(scheduler as any, 'cleanupTranscripts')
      .mockResolvedValue(undefined)
    const cleanupSummariesSpy = jest.spyOn(scheduler as any, 'cleanupSummaries')
      .mockResolvedValue(undefined)
    const enforceAudioQuotaSpy = jest.spyOn(scheduler as any, 'enforceAudioQuota')
      .mockResolvedValue(undefined)

    // Manually call runRetentionCleanup
    await (scheduler as any).runRetentionCleanup()

    expect(cleanupTranscriptsSpy).toHaveBeenCalledTimes(1)
    expect(cleanupSummariesSpy).toHaveBeenCalledTimes(1)
    expect(enforceAudioQuotaSpy).toHaveBeenCalledTimes(1)
  })

  it('should handle errors in cleanup gracefully', async () => {
    scheduler = new JobScheduler(mockDbService as DatabaseService, mockSettingsService as SettingsService)

    // Mock one cleanup method to throw error
    jest.spyOn(scheduler as any, 'cleanupTranscripts')
      .mockRejectedValue(new Error('Database error'))
    jest.spyOn(scheduler as any, 'cleanupSummaries')
      .mockResolvedValue(undefined)
    jest.spyOn(scheduler as any, 'enforceAudioQuota')
      .mockResolvedValue(undefined)

    // Should not throw - errors should be caught and logged
    await expect((scheduler as any).runRetentionCleanup()).resolves.not.toThrow()
  })
})
