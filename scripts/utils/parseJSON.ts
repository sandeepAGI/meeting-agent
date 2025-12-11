/**
 * Parse JSON from LLM output, handling markdown code fences
 */
export function parseJSONFromLLM(text: string): any {
  // Remove markdown code fences if present
  let cleaned = text.trim()

  // Remove ```json ... ``` or ``` ... ```
  if (cleaned.startsWith('```')) {
    // Find the first newline after ```
    const firstNewline = cleaned.indexOf('\n')
    // Find the last ```
    const lastFence = cleaned.lastIndexOf('```')

    if (firstNewline !== -1 && lastFence > firstNewline) {
      cleaned = cleaned.substring(firstNewline + 1, lastFence).trim()
    }
  }

  return JSON.parse(cleaned)
}
