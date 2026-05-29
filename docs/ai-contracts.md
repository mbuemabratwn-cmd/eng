# AI Contracts

This document defines how the app talks to AI providers and how AI output is allowed to affect the system.

## Core rule

AI is not the database.

AI can:

- generate replies
- explain English
- suggest learning events
- suggest word updates
- suggest grammar summaries
- suggest memory updates
- generate summaries

AI cannot directly:

- update word progress
- update grammar summaries
- import files
- delete data
- overwrite data
- update long-term memory without validation

All structured output must be validated by Action Validator and domain engines.

---

## Prompt modules

AI requests should be built from modules:

```text
global_system_prompt
mode_prompt
student_state
ai_memory_summary
retrieved_context
current_task_context
output_schema
style_examples
```

Do not build one giant prompt.

---

## structured_payload format

AI responses should be represented as:

```json
{
  "reply": "User-facing text.",
  "structured_payload": {
    "detected_intent": "word_theme_learning",
    "teacher_mode": "guide",
    "next_best_action": "ask_word_guess",
    "persistence_policy": "update_progress",
    "actions": [],
    "warnings": []
  }
}
```

The renderer displays only `reply`.

---

## Allowed action types

```text
create_learning_event
create_word_review_event
suggest_word_update
create_weak_candidate
create_sentence_progress
suggest_grammar_weakness
create_grammar_error_event
suggest_memory_update
create_summary
create_file_import_candidate
request_user_confirmation
```

---

## Action examples

### create_learning_event

```json
{
  "type": "create_learning_event",
  "event_type": "word_reviewed",
  "target_type": "word",
  "target_id": 123,
  "result": "partially_correct",
  "score": 0.6,
  "metadata": {
    "question_type": "context_guess",
    "note": "User guessed general meaning but confused a similar word."
  }
}
```

### suggest_word_update

```json
{
  "type": "suggest_word_update",
  "word_id": 123,
  "suggested_status": "weak",
  "score_delta": -8,
  "dimension_updates": {
    "recognition_score": 0,
    "recall_score": -5,
    "context_score": -10,
    "usage_score": 0
  },
  "reason": "User confused adapt/adopt in context.",
  "evidence": {
    "event_ids": [991, 992],
    "confidence": 0.72
  }
}
```

### create_sentence_progress

```json
{
  "type": "create_sentence_progress",
  "sentence_id": 456,
  "user_guess": "User understanding text.",
  "comprehension_score": 0.5,
  "structure_score": 0.4,
  "vocabulary_score": 0.7,
  "detected_weaknesses": {
    "grammar": ["relative_clause"],
    "vocabulary": [123, 124],
    "structure": ["missed_main_verb"]
  }
}
```

### create_grammar_error_event

```json
{
  "type": "create_grammar_error_event",
  "original_sentence": "I very like this method.",
  "corrected_sentence": "I really like this method.",
  "issue_type": "word_choice",
  "severity": "medium",
  "should_interrupt": true,
  "explanation": "very usually does not directly modify the verb like."
}
```

### suggest_memory_update

```json
{
  "type": "suggest_memory_update",
  "memory_type": "long_sentence",
  "summary": "User recently tends to lose the main clause when multiple modifiers appear.",
  "evidence_event_ids": [101, 102, 103],
  "confidence": 0.68
}
```

### request_user_confirmation

```json
{
  "type": "request_user_confirmation",
  "confirmation_type": "destructive_action",
  "message": "This will clear all weak word states. Continue?",
  "pending_action": {
    "type": "bulk_update_words",
    "scope": "all_weak_words"
  }
}
```

---

## AllowedActionsByMode

### word_theme_learning

Allowed:

- create_word_review_event
- suggest_word_update
- create_learning_event
- create_weak_candidate

### word_review

Allowed:

- create_word_review_event
- update_review_schedule
- suggest_word_update
- create_learning_event

### long_sentence

Allowed:

- create_sentence_progress
- create_learning_event
- suggest_vocabulary_weakness
- suggest_grammar_weakness

### grammar_correction

Allowed:

- create_grammar_error_event
- update_grammar_issue_summary_candidate
- create_learning_event

### free_chat

Allowed:

- create_light_grammar_feedback
- create_expression_feedback
- create_limited_learning_event

### summary

Allowed:

- create_block_summary
- create_daily_summary
- suggest_memory_update

### file_processing

Allowed:

- create_file_record
- create_import_candidate
- create_file_chunk

---

## Action Validator

Validate:

1. action type is legal
2. action is allowed in current mode
3. target_id exists
4. persistence_policy allows it
5. action is not destructive without confirmation
6. evidence is sufficient
7. score values are within range
8. enum values are legal
9. action does not conflict with explicit user instruction

If validation fails:

1. keep reply
2. reject action
3. write validation_failed event or system log
4. do not update learning state

---

## Failure handling

If AI API fails:

1. keep user message
2. show error or retry option
3. log AI request failure
4. do not update learning state

If `structured_payload` fails:

1. show reply
2. do not execute actions
3. write parse_failed event
4. optionally retry extraction in background

If AI suggests unsupported action:

1. reject it
2. log validation failure
3. keep reply
