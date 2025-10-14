/**
 * Types for Anthropic Message Batches API
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 */

export interface BatchRequest {
  custom_id: string
  params: {
    model: string
    max_tokens: number
    messages: Array<{
      role: 'user' | 'assistant'
      content: string
    }>
  }
}

export interface BatchJob {
  id: string
  type: 'message_batch'
  processing_status: BatchProcessingStatus
  request_counts: {
    processing: number
    succeeded: number
    errored: number
    canceled: number
    expired: number
  }
  ended_at: string | null
  created_at: string
  expires_at: string
  results_url: string | null
}

export type BatchProcessingStatus =
  | 'in_progress'
  | 'canceling'
  | 'ended'

export interface BatchResult {
  custom_id: string
  result: {
    type: 'succeeded' | 'errored' | 'canceled' | 'expired'
    message?: {
      id: string
      type: 'message'
      role: 'assistant'
      content: Array<{
        type: 'text'
        text: string
      }>
      model: string
      stop_reason: string
      usage: {
        input_tokens: number
        output_tokens: number
      }
    }
    error?: {
      type: string
      message: string
    }
  }
}

export interface BatchStatus {
  id: string
  status: BatchProcessingStatus
  request_counts: {
    processing: number
    succeeded: number
    errored: number
    canceled: number
    expired: number
  }
  ended_at: string | null
  results_url: string | null
}

export interface AdaptivePollingConfig {
  // Minutes elapsed → interval in milliseconds
  intervals: Array<{
    untilMinute: number
    intervalMs: number
  }>
}

export const DEFAULT_POLLING_CONFIG: AdaptivePollingConfig = {
  intervals: [
    { untilMinute: 30, intervalMs: 5 * 60 * 1000 },  // 0-30 min: every 5 min
    { untilMinute: 45, intervalMs: 3 * 60 * 1000 },  // 30-45 min: every 3 min
    { untilMinute: 55, intervalMs: 1 * 60 * 1000 },  // 45-55 min: every 1 min
    { untilMinute: Infinity, intervalMs: 30 * 1000 } // 55+ min: every 30 sec
  ]
}
