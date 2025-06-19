const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI('AIzaSyDmJns1_1PTNInNeEyHNonUQKwYQgxjjx0');
const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" });

// Intent types
const INTENTS = {
  GET_PROGRESS: 'get_progress',
  GET_RECOMMENDATIONS: 'get_recommendations',
  ASK_QUESTION: 'ask_question',
  GET_FEEDBACK: 'get_feedback',
  SET_GOALS: 'set_goals',
  UNKNOWN: 'unknown'
};

class IntentClassificationService {
  static intentPatterns = {
    [INTENTS.GET_PROGRESS]: [
      'progress', 'how am i doing', 'performance', 'grade', 'score',
      'improvement', 'track', 'statistics', 'stats'
    ],
    [INTENTS.GET_RECOMMENDATIONS]: [
      'recommend', 'suggest', 'help me with', 'how should i', 'what should i',
      'improve', 'tips', 'advice'
    ],
    [INTENTS.GET_FEEDBACK]: [
      'feedback', 'teacher comments', 'what did my teacher say',
      'evaluation', 'assessment'
    ],
    [INTENTS.SET_GOALS]: [
      'goal', 'target', 'aim', 'want to achieve', 'plan to',
      'objective', 'aspiration'
    ]
  };

  static async classifyIntent(message) {
    try {
      // First try rule-based classification
      const lowercaseMessage = message.toLowerCase();
      for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
        if (patterns.some(pattern => lowercaseMessage.includes(pattern))) {
          return {
            intent,
            confidence: 0.8,
            subject: this.extractSubject(message)
          };
        }
      }

      // If no match, use Gemini for more complex classification
      const prompt = `Classify the following student message into one of these intents:
- get_progress: Questions about academic progress or performance
- get_recommendations: Requests for study tips or improvement suggestions
- ask_question: General academic questions
- get_feedback: Requests for teacher feedback
- set_goals: Discussions about academic goals
- unknown: If none of the above match

Message: "${message}"

Respond in JSON format with:
{
  "intent": "the_intent",
  "confidence": 0.0 to 1.0,
  "subject": "detected_subject_or_null"
}`;

      const result = await model.generateContent(prompt);
      // Gemini SDK returns { response: { candidates: [ { content: { parts: [ { text: ... }] } } ] } }
      let text = '';
      if (result && result.response && result.response.candidates && result.response.candidates[0] && result.response.candidates[0].content && result.response.candidates[0].content.parts && result.response.candidates[0].content.parts[0] && result.response.candidates[0].content.parts[0].text) {
        text = result.response.candidates[0].content.parts[0].text;
      } else if (result && result.response && typeof result.response.text === 'function') {
        text = result.response.text();
      } else if (result && result.text) {
        text = result.text;
      } else {
        throw new Error('Unexpected Gemini API response structure');
      }
      const classification = JSON.parse(text);
      return classification;

    } catch (error) {
      // Optionally log error for debugging
      // console.error('Intent classification error:', error);
      return {
        intent: INTENTS.ASK_QUESTION,
        confidence: 0.5,
        subject: this.extractSubject(message)
      };
    }
  }

  static extractSubject(message) {
    const subjects = [
      'math', 'mathematics', 'algebra', 'geometry', 'calculus',
      'physics', 'chemistry', 'biology', 'science',
      'history', 'geography', 'english', 'literature'
    ];

    const lowercaseMessage = message.toLowerCase();
    for (const subject of subjects) {
      if (lowercaseMessage.includes(subject)) {
        return subject;
      }
    }
    return null;
  }

  static async getPromptByIntent(intent, message, context) {
    const baseContext = `Based on the student's learning style (${context.learningStyle}) and current progress...`;

    switch (intent) {
      case INTENTS.GET_PROGRESS:
        return `${baseContext}
Analyze and summarize the student's academic progress:
${JSON.stringify(context.academicHistory, null, 2)}

Focus on:
1. Areas of strength
2. Recent improvements
3. Subjects/topics needing attention
4. Comparison with previous performance`;

      case INTENTS.GET_RECOMMENDATIONS:
        return `${baseContext}
Provide personalized study recommendations considering:
1. The student's learning style: ${context.learningStyle}
2. Current academic performance
3. Previous successful strategies
4. Specific areas needing improvement

Question: ${message}`;

      case INTENTS.GET_FEEDBACK:
        return `${baseContext}
Summarize and analyze teacher feedback:
${JSON.stringify(context.feedbackHistory, null, 2)}

Provide:
1. Key points from teacher feedback
2. Actionable improvements
3. Recognition of progress
4. Specific areas to focus on`;

      default:
        return `${baseContext}
Answer the student's question:
${message}

Consider:
1. Their learning style
2. Academic history
3. Previous interactions
4. Current progress`;
    }
  }
}

module.exports = {
  IntentClassificationService,
  INTENTS
};
