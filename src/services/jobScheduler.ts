/**
 * Job Scheduler Service
 * Phase 7: Storage Management - Task 1.1
 *
 * Manages periodic cleanup tasks for data retention policies.
 * Runs cleanup every 24 hours and enforces retention settings.
 */

import type { DatabaseService } from './database'
import type { SettingsService } from './settings'
import * as fs from 'fs'

export class JobScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private dbService: DatabaseService
  private settingsService: SettingsService

  constructor(dbService: DatabaseService, settingsService: SettingsService) {
    this.dbService = dbService
    this.settingsService = settingsService
  }

  /**
   * Start the job scheduler.
   * Runs cleanup immediately, then schedules to run every 24 hours.
   */
  start(): void {
    console.log('[JobScheduler] Starting job scheduler...')

    // Run cleanup immediately on start
    this.runRetentionCleanup().catch((error) => {
      console.error('[JobScheduler] Initial cleanup failed:', error)
    })

    // Schedule cleanup to run every 24 hours
    this.intervalId = setInterval(() => {
      this.runRetentionCleanup().catch((error) => {
        console.error('[JobScheduler] Scheduled cleanup failed:', error)
      })
    }, 24 * 60 * 60 * 1000) // 24 hours in milliseconds

    console.log('[JobScheduler] Job scheduler started (runs every 24 hours)')
  }

  /**
   * Stop the job scheduler.
   * Clears the scheduled interval.
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[JobScheduler] Job scheduler stopped')
    }
  }

  /**
   * Run all retention cleanup tasks.
   * Called immediately on start and every 24 hours thereafter.
   * @private
   */
  private async runRetentionCleanup(): Promise<void> {
    console.log('[JobScheduler] Starting retention cleanup...')

    try {
      await this.cleanupTranscripts()
    } catch (error) {
      console.error('[JobScheduler] Transcript cleanup failed:', error)
    }

    try {
      await this.cleanupSummaries()
    } catch (error) {
      console.error('[JobScheduler] Summary cleanup failed:', error)
    }

    try {
      await this.enforceAudioQuota()
    } catch (error) {
      console.error('[JobScheduler] Audio quota enforcement failed:', error)
    }

    console.log('[JobScheduler] Retention cleanup complete')
  }

  /**
   * Clean up old transcripts based on retention policy.
   * Phase 7: Storage Management - Task 1.2
   * @private
   */
  private async cleanupTranscripts(): Promise<void> {
    const settings = this.settingsService.getCategory('dataRetention')
    const retentionDays = settings.transcriptRetentionDays ?? 90

    const result = this.dbService.cleanupOldTranscripts(retentionDays)
    console.log(`[JobScheduler] Transcript cleanup: ${result.deletedCount} deleted (retention: ${retentionDays} days)`)
  }

  /**
   * Clean up old summaries based on retention policy.
   * Phase 7: Storage Management - Task 1.3
   * @private
   */
  private async cleanupSummaries(): Promise<void> {
    const settings = this.settingsService.getCategory('dataRetention')
    const retentionDays = settings.summaryRetentionDays ?? 365

    const result = this.dbService.cleanupOldSummaries(retentionDays)
    console.log(`[JobScheduler] Summary cleanup: ${result.deletedCount} deleted (retention: ${retentionDays} days)`)
  }

  /**
   * Enforce audio storage quota.
   * Phase 7: Storage Management - Task 1.4
   *
   * Deletes oldest audio files when quota is exceeded.
   * @returns Object with deletedCount and deletedMB
   * @private
   */
  private async enforceAudioQuota(): Promise<{ deletedCount: number; deletedMB: number }> {
    const settings = this.settingsService.getCategory('dataRetention')
    const quotaGB = settings.audioStorageQuotaGB ?? 0

    if (quotaGB === 0) {
      console.log('[JobScheduler] Audio quota enforcement skipped (quota = 0, unlimited)')
      return { deletedCount: 0, deletedMB: 0 } // Unlimited
    }

    const usage = this.dbService.getAudioStorageUsage()
    console.log(`[JobScheduler] Current audio storage: ${usage.totalGB.toFixed(2)} GB / ${quotaGB} GB`)

    if (usage.totalGB <= quotaGB) {
      console.log('[JobScheduler] Audio storage under quota, no action needed')
      return { deletedCount: 0, deletedMB: 0 } // Under quota
    }

    // Delete oldest files until under quota
    const quotaBytes = quotaGB * (1024 ** 3)
    let currentBytes = usage.totalBytes
    let deletedCount = 0
    let deletedBytes = 0

    const oldestRecordings = this.dbService.getOldestRecordings(1000) // Max 1000 at a time

    for (const recording of oldestRecordings) {
      if (currentBytes <= quotaBytes) {
        break // Under quota now
      }

      try {
        // Delete file from disk
        if (fs.existsSync(recording.file_path)) {
          fs.unlinkSync(recording.file_path)
          console.log(`[JobScheduler] Deleted audio file: ${recording.file_path} (${(recording.file_size_bytes / (1024 ** 2)).toFixed(1)} MB)`)
        } else {
          console.log(`[JobScheduler] Audio file not found (already deleted?): ${recording.file_path}`)
        }

        // Update database - set file_path to NULL
        this.dbService.clearRecordingFilePath(recording.id)

        currentBytes -= recording.file_size_bytes
        deletedBytes += recording.file_size_bytes
        deletedCount++
      } catch (error) {
        console.error(`[JobScheduler] Failed to delete ${recording.file_path}:`, error)
      }
    }

    const deletedMB = deletedBytes / (1024 ** 2)
    console.log(`[JobScheduler] Audio quota enforcement complete: ${deletedCount} files deleted (${deletedMB.toFixed(1)} MB freed)`)

    return { deletedCount, deletedMB }
  }
}
