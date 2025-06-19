# Parent-Chat API Documentation

The Parent-Chat API is a specialized endpoint in the AI Tutor Service designed to handle queries from parents about their children's academic progress, performance, and educational needs.

## Endpoint

```
POST /parent-chat
```

## Request Format

```json
{
  "student_id": "STUDENT_ID",
  "question": "How is my child doing in mathematics?"
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `student_id` | string | The unique identifier for the student |
| `question` | string | The parent's question about their child |

## Response Format

```json
{
  "answer": "Your child has been making steady progress in mathematics...",
  "intent": "get_progress",
  "retrieved_docs": ["Mathematics content document 1", "Mathematics content document 2"],
  "context_used": {
    "subject": "mathematics",
    "docs_retrieved": 2,
    "context_level": "parent"
  }
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `answer` | string | The AI-generated response to the parent's question |
| `intent` | string | The classified intent of the parent's question |
| `retrieved_docs` | array | Educational documents retrieved to help answer the question |
| `context_used` | object | Metadata about the context used to generate the response |

## Features

1. **Parent-Specific Responses**: Tailored responses that are appropriate for parents rather than students
2. **Privacy-Conscious**: Balances providing useful information while respecting student privacy
3. **Actionable Advice**: Includes suggestions for how parents can support their child's learning
4. **Professional Tone**: Maintains a professional, empathetic tone suitable for parent communication

## Intent Classification

The parent-chat endpoint uses the same intent classification system as the student chat, but interprets the intents differently:

- **get_progress**: Provides an overview of the student's academic progress
- **get_feedback**: Summarizes teacher feedback about the student
- **get_recommendations**: Offers recommendations for supporting the student's learning
- **ask_question**: Answers general questions about the student's education

## Testing

You can test the parent-chat endpoint using the provided test script:

```
node scripts/test-parent-chat.js <studentId> "How is my child doing in mathematics?"
```

## Integration with WhatsApp

The parent-chat endpoint is designed to work with the WhatsApp webhook, allowing parents to query about their children's education through WhatsApp messages. The webhook identifies the parent by phone number, determines which student they're asking about, and then uses this endpoint to generate appropriate responses.

## Error Handling

If the parent-chat endpoint is unavailable, the system will fall back to the regular chat endpoint but still frame the response appropriately for parents.
