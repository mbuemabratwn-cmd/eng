import { AIProvider, AIRequest, AIResponse, AIStreamChunk } from './provider'

export interface OpenAIProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export class OpenAIProvider implements AIProvider {
  name = 'openai'
  private baseUrl: string
  private apiKey: string
  private model: string
  private abortController: AbortController | null = null

  constructor(config: OpenAIProviderConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '')
    this.apiKey = config.apiKey
    this.model = config.model
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const url = `${this.baseUrl}/chat/completions`

    const body = {
      model: request.model || this.model,
      messages: request.messages,
      max_tokens: request.maxTokens || 2048,
      temperature: request.temperature ?? 0.7
    }

    // Create new abort controller for this request
    this.abortController = new AbortController()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body),
      signal: this.abortController.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI API error ${response.status}: ${errorText}`)
    }

    const data = await response.json() as any
    const choice = data.choices?.[0]

    if (!choice) {
      throw new Error('No response from AI API')
    }

    return {
      content: choice.message?.content || '',
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens || 0,
        outputTokens: data.usage.completion_tokens || 0
      } : undefined
    }
  }

  async *chatStream(request: AIRequest): AsyncIterable<AIStreamChunk> {
    const url = `${this.baseUrl}/chat/completions`

    const body = {
      model: request.model || this.model,
      messages: request.messages,
      max_tokens: request.maxTokens || 2048,
      temperature: request.temperature ?? 0.7,
      stream: true
    }

    // Create new abort controller for this request
    this.abortController = new AbortController()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(body),
      signal: this.abortController.signal
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`AI API error ${response.status}: ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('No response body')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = JSON.parse(trimmed.slice(6))
            const content = json.choices?.[0]?.delta?.content || ''
            if (content) {
              yield { content, done: false }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    yield { content: '', done: true }
  }
}
