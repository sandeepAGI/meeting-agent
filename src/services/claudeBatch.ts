/**
 * ClaudeBatchService - Anthropic Message Batches API integration
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 *
 * Handles batch job submission, adaptive polling, and result retrieval.
 * Uses 50% discounted Batch API pricing vs standard Messages API.
 */

import Anthropic from '@anthropic-ai/sdk'
import type {
  BatchRequest,
  BatchJob,
  BatchResult,
  BatchStatus,
  DEFAULT_POLLING_CONFIG
} from '../types'

export class ClaudeBatchService {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model: string = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  /**
   * Submit a batch job to Anthropic
   * @param requests Array of batch requests with custom_id
   * @returns Batch ID
   */
  async submitBatch(requests: BatchRequest[]): Promise<string> {
    try {
      const batch = await this.client.beta.messages.batches.create({
        requests: requests.map((req) => ({
          custom_id: req.custom_id,
          params: {
            model: req.params.model || this.model,
            max_tokens: req.params.max_tokens,
            messages: req.params.messages
          }
        }))
      })

      console.log(
        `Batch submitted: ${batch.id}, processing_status: ${batch.processing_status}`
      )
      return batch.id
    } catch (error: any) {
      console.error('Failed to submit batch:', error)
      throw new Error(`Batch submission failed: ${error.message}`)
    }
  }

  /**
   * Poll batch status with adaptive intervals
   * Starts with 5-minute intervals, decreases to 30 seconds as completion nears
   *
   * @param batchId Batch ID from submitBatch
   * @param onProgress Optional callback for progress updates
   * @returns Final batch status when complete
   */
  async pollBatchStatus(
    batchId: string,
    onProgress?: (status: BatchStatus) => void
  ): Promise<BatchStatus> {
    const startTime = Date.now()
    let attempts = 0

    while (true) {
      attempts++
      const elapsedMs = Date.now() - startTime
      const elapsedMinutes = elapsedMs / 60000

      try {
        // Fetch current status
        const batch = await this.client.beta.messages.batches.retrieve(batchId)

        const status: BatchStatus = {
          id: batch.id,
          status: batch.processing_status,
          request_counts: batch.request_counts,
          ended_at: batch.ended_at,
          results_url: batch.results_url
        }

        // Call progress callback
        if (onProgress) {
          onProgress(status)
        }

        console.log(
          `Batch ${batchId} status: ${status.status}, ` +
            `elapsed: ${Math.floor(elapsedMinutes)}m, ` +
            `attempt: ${attempts}`
        )

        // Check if complete
        if (status.status === 'ended') {
          console.log(`Batch ${batchId} complete after ${Math.floor(elapsedMinutes)} minutes`)
          return status
        }

        // Check if canceling (treat as ended)
        if (status.status === 'canceling') {
          console.log(`Batch ${batchId} is canceling`)
          // Wait a bit more for cancellation to complete
          await this.sleep(10000) // 10 seconds
          continue
        }

        // Calculate next polling interval based on elapsed time
        const intervalMs = this.getPollingInterval(elapsedMinutes)
        console.log(`Next poll in ${intervalMs / 1000}s`)

        await this.sleep(intervalMs)
      } catch (error: any) {
        console.error(`Error polling batch ${batchId}:`, error)

        // Retry with exponential backoff for transient errors
        if (attempts < 3) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempts), 30000)
          console.log(`Retrying in ${backoffMs / 1000}s...`)
          await this.sleep(backoffMs)
          continue
        }

        throw new Error(`Failed to poll batch status: ${error.message}`)
      }
    }
  }

  /**
   * Retrieve batch results (JSONL format)
   * @param batchId Batch ID
   * @returns Array of batch results
   */
  async retrieveResults(batchId: string): Promise<BatchResult[]> {
    try {
      // First get the batch to check status
      const batch = await this.client.beta.messages.batches.retrieve(batchId)

      if (batch.processing_status !== 'ended') {
        throw new Error(
          `Batch not complete yet. Status: ${batch.processing_status}`
        )
      }

      if (!batch.results_url) {
        throw new Error('Batch complete but no results URL available')
      }

      // Fetch results from URL (requires authentication)
      const apiKey = this.client.apiKey || ''
      const response = await fetch(batch.results_url, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      })
      if (!response.ok) {
        throw new Error(`Failed to fetch results: ${response.statusText}`)
      }

      // Parse JSONL (one JSON object per line)
      const jsonlText = await response.text()
      const lines = jsonlText
        .trim()
        .split('\n')
        .filter((line) => line.trim())

      const results: BatchResult[] = lines.map((line) => JSON.parse(line))

      console.log(
        `Retrieved ${results.length} results from batch ${batchId}`
      )

      // Check for errors
      const errored = results.filter((r) => r.result.type === 'errored')
      if (errored.length > 0) {
        console.warn(`${errored.length} requests errored:`, errored)
      }

      return results
    } catch (error: any) {
      console.error(`Failed to retrieve batch results:`, error)
      throw new Error(`Failed to retrieve results: ${error.message}`)
    }
  }

  /**
   * Cancel a batch job
   * @param batchId Batch ID to cancel
   */
  async cancelBatch(batchId: string): Promise<void> {
    try {
      const batch = await this.client.beta.messages.batches.cancel(batchId)
      console.log(`Batch ${batchId} cancelled. Status: ${batch.processing_status}`)
    } catch (error: any) {
      console.error(`Failed to cancel batch ${batchId}:`, error)
      throw new Error(`Failed to cancel batch: ${error.message}`)
    }
  }

  /**
   * Get batch status (one-time check, no polling)
   * @param batchId Batch ID
   * @returns Current batch status
   */
  async getBatchStatus(batchId: string): Promise<BatchStatus> {
    try {
      const batch = await this.client.beta.messages.batches.retrieve(batchId)
      return {
        id: batch.id,
        status: batch.processing_status,
        request_counts: batch.request_counts,
        ended_at: batch.ended_at,
        results_url: batch.results_url
      }
    } catch (error: any) {
      console.error(`Failed to get batch status:`, error)
      throw new Error(`Failed to get batch status: ${error.message}`)
    }
  }

  /**
   * Calculate polling interval based on elapsed time
   * Adaptive polling: Start slow, accelerate as completion nears
   *
   * @param elapsedMinutes Minutes since batch submission
   * @returns Interval in milliseconds
   */
  private getPollingInterval(elapsedMinutes: number): number {
    // 0-30 min: every 5 minutes (most batches take 30-60 min, start slow)
    if (elapsedMinutes < 30) return 5 * 60 * 1000

    // 30-45 min: every 3 minutes (accelerate)
    if (elapsedMinutes < 45) return 3 * 60 * 1000

    // 45-55 min: every 1 minute (accelerate more as we approach 1 hour)
    if (elapsedMinutes < 55) return 1 * 60 * 1000

    // 55+ min: every 30 seconds (very fast near expected completion time)
    return 30 * 1000
  }

  /**
   * Sleep utility for polling delays
   * @param ms Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Create a batch request with proper formatting
   * Helper method for creating BatchRequest objects
   */
  static createBatchRequest(
    customId: string,
    prompt: string,
    model?: string,
    maxTokens: number = 4096
  ): BatchRequest {
    return {
      custom_id: customId,
      params: {
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }
    }
  }

  /**
   * Extract text from batch result
   * @param result Single batch result
   * @returns Extracted text content or error message
   */
  static extractTextFromResult(result: BatchResult): string {
    if (result.result.type === 'succeeded' && result.result.message) {
      const content = result.result.message.content[0]
      if (content.type === 'text') {
        return content.text
      }
    }

    if (result.result.type === 'errored' && result.result.error) {
      throw new Error(
        `Request ${result.custom_id} errored: ${result.result.error.message}`
      )
    }

    throw new Error(`Unexpected result type: ${result.result.type}`)
  }
}
