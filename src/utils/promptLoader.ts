/**
 * Prompt template loader and variable substitution utility
 * Phase 2.3-3: LLM-Based Meeting Intelligence
 */

import * as fs from 'fs'
import * as path from 'path'

export class PromptLoader {
  private promptsDir: string

  constructor(promptsDir?: string) {
    this.promptsDir = promptsDir || path.join(__dirname, '../prompts')
  }

  /**
   * Load a prompt template from file
   * @param filename Template filename (e.g., 'pass1-summary.txt')
   * @returns Template content
   */
  loadPrompt(filename: string): string {
    const filePath = path.join(this.promptsDir, filename)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Prompt template not found: ${filePath}`)
    }

    return fs.readFileSync(filePath, 'utf-8')
  }

  /**
   * Substitute variables in template
   * Variables are in format {{variableName}}
   *
   * @param template Template string
   * @param variables Object with variable values
   * @returns Template with substituted values
   */
  substitute(template: string, variables: Record<string, string>): string {
    let result = template

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`
      result = result.replace(new RegExp(placeholder, 'g'), value)
    }

    // Check for unsubstituted variables (for debugging)
    const remaining = result.match(/\{\{[^}]+\}\}/g)
    if (remaining) {
      console.warn('Unsubstituted variables in template:', remaining)
    }

    return result
  }

  /**
   * Load and substitute in one call
   * @param filename Template filename
   * @param variables Variable values
   * @returns Substituted template
   */
  loadAndSubstitute(
    filename: string,
    variables: Record<string, string>
  ): string {
    const template = this.loadPrompt(filename)
    return this.substitute(template, variables)
  }
}
