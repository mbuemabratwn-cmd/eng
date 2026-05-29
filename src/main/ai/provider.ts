export interface AIRequest {
  messages: Array<{ role: string; content: string }>
  model?: string
  maxTokens?: number
  temperature?: number
}

export interface AIResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export interface AIProvider {
  name: string
  chat(request: AIRequest): Promise<AIResponse>
  abort(): void
}
