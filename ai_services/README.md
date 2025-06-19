# Professional RAG AI Tutor Service

A comprehensive Retrieval-Augmented Generation (RAG) system for personalized tutoring with intelligent intent classification and vector-based document retrieval.

## 🚀 Features

### ✅ Problems Solved
- **No more data verbosity**: Context is intelligently filtered based on user intent
- **Smart greetings**: Simple greetings don't trigger full AI processing
- **True RAG implementation**: Vector-based document retrieval for relevant educational content
- **Intent-aware responses**: Different response strategies for different types of questions

### 🧠 Core Components

1. **Intent Classification**
   - `greeting`: Hi, hello, good morning
   - `get_progress`: How am I doing, my performance, grades
   - `get_feedback`: Teacher comments, feedback, reviews
   - `ask_question`: What is, how do, explain, help me
   - `get_help`: Stuck, confused, need assistance
   - `motivation`: Encourage, difficult, frustrated

2. **RAG Retrieval System**
   - ChromaDB vector database for educational content
   - Sentence Transformers for embeddings
   - Subject-specific document filtering
   - Top-K document retrieval with relevance scoring

3. **Context Management**
   - Minimal context for greetings
   - Targeted context based on intent
   - Academic history summarization
   - Recent interaction tracking

4. **Professional Prompt Design**
   - Jinja2 templates for structured prompts
   - Grade-level appropriate responses
   - Concise, encouraging communication
   - Clear answer structure with examples

## 📋 Requirements

```
fastapi==0.104.1
python-multipart==0.0.6
uvicorn==0.24.0
google-generativeai==0.3.2
pymongo==4.6.0
python-dotenv==1.0.0
pydantic==2.5.2
requests==2.31.0
pillow==10.1.0
chromadb==0.4.18
sentence-transformers==2.2.2
jinja2==3.1.2
numpy==1.24.3
scikit-learn==1.3.2
```

## 🛠️ Installation & Setup

1. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Environment Variables**
   Create a `.env` file:
   ```
   MONGO_URI=mongodb://localhost:27017/student-teacher-app
   GOOGLE_AI_API_KEY=your_gemini_api_key_here
   ```

3. **Initialize Knowledge Base**
   ```bash
   python init_knowledge_base.py
   ```

4. **Start the Service**
   ```bash
   python ai_tutor_service.py
   ```
   Or use the batch file:
   ```bash
   start_service.bat
   ```

## 🔧 API Endpoints

### 1. Chat Endpoint
```bash
POST /chat
{
  "student_id": "STU2025001",
  "question": "What is photosynthesis?"
}
```

**Response:**
```json
{
  "answer": "Photosynthesis is the process where plants convert light energy...",
  "intent": "ask_question",
  "retrieved_docs": ["Photosynthesis: 6CO₂ + 6H₂O + light → C₆H₁₂O₆ + 6O₂..."],
  "context_used": {
    "subject": "biology",
    "docs_retrieved": 2,
    "context_level": "full"
  }
}
```

### 2. Intent Classification
```bash
POST /classify-intent
{
  "message": "I need help with algebra"
}
```

**Response:**
```json
{
  "intent": "get_help",
  "confidence": 0.8,
  "subject": "mathematics"
}
```

### 3. Add Document
```bash
POST /add-document
{
  "subject": "physics",
  "topic": "quantum mechanics",
  "content": "Quantum mechanics describes the behavior of matter and energy...",
  "grade_level": "12"
}
```

### 4. Health Check
```bash
GET /health
```

## 🎯 Usage Examples

### Example 1: Greeting
```bash
curl -X POST "http://localhost:8001/chat" \
-H "Content-Type: application/json" \
-d '{"student_id": "STU2025001", "question": "hi"}'
```

**Response:** Simple greeting without AI processing or full context.

### Example 2: Academic Question
```bash
curl -X POST "http://localhost:8001/chat" \
-H "Content-Type: application/json" \
-d '{"student_id": "STU2025001", "question": "explain quadratic equations"}'
```

**Response:** Detailed explanation with retrieved educational content and student-appropriate examples.

### Example 3: Progress Inquiry
```bash
curl -X POST "http://localhost:8001/chat" \
-H "Content-Type: application/json" \
-d '{"student_id": "STU2025001", "question": "how am I doing in math?"}'
```

**Response:** Personalized progress report based on academic history and recent interactions.

## 📊 Testing

Run the comprehensive test suite:
```bash
python test_rag_service.py
```

Tests include:
- Intent classification accuracy
- RAG document retrieval
- Context-aware responses
- Document addition functionality
- Health check verification

## 🔄 Integration with Node.js Backend

The Python RAG service runs on port 8001 and can be integrated with your Node.js backend:

```javascript
// In your Node.js backend
const axios = require('axios');

async function getAITutorResponse(studentId, question) {
  try {
    const response = await axios.post('http://localhost:8001/chat', {
      student_id: studentId,
      question: question
    });
    return response.data;
  } catch (error) {
    console.error('AI Tutor service error:', error);
    return { answer: 'Sorry, I am having trouble right now. Please try again later.' };
  }
}
```

## 📈 Performance Optimizations

1. **Context Filtering**: Only relevant data is included based on intent
2. **Greeting Optimization**: No AI calls for simple greetings
3. **Document Caching**: ChromaDB provides efficient vector search
4. **Batch Processing**: Multiple embeddings processed together
5. **Response Caching**: Common questions can be cached

## 🔍 Monitoring & Logging

The service logs:
- Intent classification results
- Document retrieval metrics
- Response generation time
- Error tracking
- Database connection status

## 🚀 Production Deployment

For production deployment:

1. **Environment Variables**: Use secure environment variable management
2. **Database**: Use MongoDB Atlas or secure MongoDB instance
3. **Vector DB**: Consider Pinecone for production-scale vector search
4. **Load Balancing**: Use multiple service instances behind a load balancer
5. **Monitoring**: Implement comprehensive logging and monitoring

## 📚 Knowledge Base Management

The system supports:
- Dynamic document addition via API
- Subject-specific filtering
- Grade-level appropriate content
- Automatic embedding generation
- Content versioning and updates

## 🤝 Contributing

To add new features or improve the system:

1. Follow the modular architecture
2. Add comprehensive tests
3. Update documentation
4. Ensure backward compatibility
5. Test with real student data

---

## 🎓 Educational Impact

This RAG system provides:
- **Personalized Learning**: Responses tailored to student's grade level and subjects
- **Efficient Tutoring**: Quick access to relevant educational content  
- **Progress Tracking**: Integration with student academic history
- **Scalable Support**: Can handle multiple students simultaneously
- **Continuous Learning**: Knowledge base can be expanded over time
