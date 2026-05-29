export interface LintResult {
  hasIssues: boolean
  cleanedReply: string
  issues: LintIssue[]
}

export interface LintIssue {
  type: 'customer_service_opening' | 'excessive_encouragement' | 'consecutive_questions' | 'unanswered_question'
  description: string
  position?: { start: number; end: number }
  autoFixable: boolean
}

export class OutputLinter {
  private customerServicePatterns = [
    /^(当然可以|当然没问题|好的呢|没问题的?|很高兴[为您帮您])/,
    /^(非常感谢您的|感谢您[的提出])/,
    /^(我来帮您|让我来帮|我来为您)/,
    /^(您好[！!]?\s*)/
  ]

  private excessiveEncouragementPatterns = [
    /太[棒好厉害了]/g,
    /非常好[！!]/g,
    /做[得的]很好[！!]/g,
    /真[棒厉害聪明][！!]?/g,
    /继续保持[！!]?/g,
    /加油[！!]?/g,
    /你[已一]定[可以能]的/g
  ]

  private questionPattern = /[？?]/g

  lint(reply: string, context?: { hasUserQuestion?: boolean }): LintResult {
    const issues: LintIssue[] = []
    let cleaned = reply

    // Check for customer service style opening
    const openingIssue = this.checkCustomerServiceOpening(cleaned)
    if (openingIssue) {
      issues.push(openingIssue)
      if (openingIssue.autoFixable && openingIssue.position) {
        cleaned = cleaned.slice(openingIssue.position.end).trimStart()
        // Recalculate positions
        this.recalculatePositions(issues, openingIssue.position.end)
      }
    }

    // Check for excessive encouragement
    const encouragementIssues = this.checkExcessiveEncouragement(cleaned)
    for (const issue of encouragementIssues) {
      issues.push(issue)
      if (issue.autoFixable && issue.position) {
        const before = cleaned.slice(0, issue.position.start)
        const after = cleaned.slice(issue.position.end)
        cleaned = (before + after).trim()
        this.recalculatePositions(issues, issue.position.end - issue.position.start)
      }
    }

    // Check for consecutive questions
    const questionIssue = this.checkConsecutiveQuestions(cleaned)
    if (questionIssue) {
      issues.push(questionIssue)
    }

    // Check if user's question was answered
    if (context?.hasUserQuestion) {
      const answerIssue = this.checkQuestionAnswered(cleaned)
      if (answerIssue) {
        issues.push(answerIssue)
      }
    }

    return {
      hasIssues: issues.length > 0,
      cleanedReply: cleaned,
      issues
    }
  }

  private checkCustomerServiceOpening(text: string): LintIssue | null {
    for (const pattern of this.customerServicePatterns) {
      const match = text.match(pattern)
      if (match && match.index !== undefined) {
        return {
          type: 'customer_service_opening',
          description: `客服式开场: "${match[0]}"`,
          position: { start: match.index, end: match.index + match[0].length },
          autoFixable: true
        }
      }
    }
    return null
  }

  private checkExcessiveEncouragement(text: string): LintIssue[] {
    const issues: LintIssue[] = []

    for (const pattern of this.excessiveEncouragementPatterns) {
      const regex = new RegExp(pattern.source, pattern.flags)
      let match

      while ((match = regex.exec(text)) !== null) {
        issues.push({
          type: 'excessive_encouragement',
          description: `过度鼓励: "${match[0]}"`,
          position: { start: match.index, end: match.index + match[0].length },
          autoFixable: true
        })
      }
    }

    return issues
  }

  private checkConsecutiveQuestions(text: string): LintIssue | null {
    // Split into sentences
    const sentences = text.split(/[。！!？?\n]+/).filter(s => s.trim())

    let consecutiveQuestions = 0
    let lastQuestionEnd = -1

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim()
      const questionMarks = (sentence.match(this.questionPattern) || []).length

      if (questionMarks > 0) {
        consecutiveQuestions++
        if (consecutiveQuestions >= 2) {
          return {
            type: 'consecutive_questions',
            description: `连续反问: 连续 ${consecutiveQuestions} 个句子包含问号`,
            autoFixable: false
          }
        }
      } else {
        consecutiveQuestions = 0
      }
    }

    return null
  }

  private checkQuestionAnswered(text: string): LintIssue | null {
    // Simple heuristic: if the reply is very short and doesn't contain any explanation markers
    const hasExplanation = /因为|由于|所以|因此|如果|假如|虽然|但是|然而|不过|而是|而且|并且|或者/.test(text)
    const hasContent = text.length > 50

    if (!hasExplanation && !hasContent) {
      return {
        type: 'unanswered_question',
        description: '回复过短，可能没有回答用户的问题',
        autoFixable: false
      }
    }

    return null
  }

  private recalculatePositions(issues: LintIssue[], removedLength: number): void {
    for (const issue of issues) {
      if (issue.position && issue.position.start > removedLength) {
        issue.position.start -= removedLength
        issue.position.end -= removedLength
      }
    }
  }

  /**
   * Get a human-readable summary of lint issues
   */
  getSummary(result: LintResult): string {
    if (!result.hasIssues) return '无问题'

    const issueTypes = result.issues.map(i => {
      switch (i.type) {
        case 'customer_service_opening': return '客服式开场'
        case 'excessive_encouragement': return '过度鼓励'
        case 'consecutive_questions': return '连续反问'
        case 'unanswered_question': return '未回答问题'
        default: return i.type
      }
    })

    return `发现 ${result.issues.length} 个问题: ${[...new Set(issueTypes)].join(', ')}`
  }
}
