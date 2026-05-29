export interface StructuredPayload {
  detected_intent?: string
  teacher_mode?: string
  next_best_action?: string
  persistence_policy?: string
  actions: ParsedAction[]
  warnings: string[]
}

export interface ParsedAction {
  type: string
  [key: string]: unknown
}

export interface ParseResult {
  success: boolean
  reply: string
  payload: StructuredPayload | null
  error?: string
}

export class StructuredOutputParser {
  parse(rawOutput: string): ParseResult {
    // Try to extract JSON from the output
    const jsonMatch = rawOutput.match(/```json\s*([\s\S]*?)```/) ||
                      rawOutput.match(/\{[\s\S]*"reply"[\s\S]*\}/)

    if (!jsonMatch) {
      // No structured payload found - treat entire output as reply
      return {
        success: true,
        reply: rawOutput,
        payload: null
      }
    }

    try {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonStr)

      // Extract reply
      const reply = parsed.reply || rawOutput

      // Build structured payload
      const payload: StructuredPayload = {
        detected_intent: parsed.detected_intent || parsed.structured_payload?.detected_intent,
        teacher_mode: parsed.teacher_mode || parsed.structured_payload?.teacher_mode,
        next_best_action: parsed.next_best_action || parsed.structured_payload?.next_best_action,
        persistence_policy: parsed.persistence_policy || parsed.structured_payload?.persistence_policy,
        actions: parsed.actions || parsed.structured_payload?.actions || [],
        warnings: parsed.warnings || parsed.structured_payload?.warnings || []
      }

      return {
        success: true,
        reply,
        payload
      }
    } catch {
      // JSON parse failed - treat entire output as reply
      return {
        success: true,
        reply: rawOutput,
        payload: null,
        error: '解析结构化输出 JSON 失败'
      }
    }
  }
}
