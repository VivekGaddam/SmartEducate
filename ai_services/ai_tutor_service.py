import os
import json
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
from pathlib import Path

# Third-party imports
from fastapi import FastAPI, HTTPException, APIRouter
from pydantic import BaseModel
import google.generativeai as genai
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from jinja2 import Template
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Professional RAG AI Tutor Service", version="2.0.0")
router = APIRouter()

# Configuration
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/student-teacher-app')
GOOGLE_AI_API_KEY = os.getenv('GOOGLE_AI_API_KEY', 'AIzaSyDmJns1_1PTNInNeEyHNonUQKwYQgxjjx0')

# Initialize connections
client = MongoClient(MONGO_URI)
db = client['student-teacher-app']

# Initialize Gemini
genai.configure(api_key=GOOGLE_AI_API_KEY)
model = genai.GenerativeModel("models/gemini-1.5-flash")

# Initialize ChromaDB for RAG
CHROMA_DB_PATH = "./chroma_db"
chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
knowledge_collection = chroma_client.get_or_create_collection("educational_content")

# Initialize sentence transformer for embeddings
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')

# ------------------------------
# PYDANTIC MODELS
# ------------------------------

class IntentRequest(BaseModel):
    message: str

class IntentResponse(BaseModel):
    intent: str
    confidence: float
    subject: Optional[str] = None

class ChatRequest(BaseModel):
    student_id: str
    question: str
    
    class Config:
        # Allow extra fields to be ignored
        extra = "ignore"
    
    def __init__(self, **data):
        # Validate and clean the data
        if 'student_id' not in data or not data['student_id']:
            data['student_id'] = 'anonymous'
        if 'question' not in data or not data['question']:
            data['question'] = 'hi'
        
        # Strip whitespace from question
        data['question'] = data['question'].strip()
        
        super().__init__(**data)

class ChatResponse(BaseModel):
    answer: str
    intent: str
    retrieved_docs: List[str] = []
    context_used: Dict[str, Any] = {}

class DocumentRequest(BaseModel):
    subject: str
    topic: str
    content: str
    grade_level: Optional[str] = None

# ------------------------------
# INTENT CLASSIFICATION
# ------------------------------

INTENT_PATTERNS = {
    "greeting": ["hi", "hello", "hey", "good morning", "good evening", "how are you", "what's up"],
    "get_progress": ["progress", "how am I doing", "my performance", "grades", "scores", "improvement"],
    "get_feedback": ["feedback", "teacher comments", "what did teacher say", "review"],
    "ask_question": ["what is", "how do", "explain", "help me", "I don't understand", "solve", "calculate"],
    "get_help": ["help", "stuck", "confused", "don't know", "assistance"],
    "motivation": ["encourage", "motivate", "give up", "difficult", "hard", "frustrated"]
}

SUBJECT_KEYWORDS = {
    'mathematics': ['math', 'mathematics', 'algebra', 'geometry', 'calculus', 'arithmetic', 'equation'],
    'physics': ['physics', 'force', 'energy', 'momentum', 'thermodynamics', 'mechanics'],
    'chemistry': ['chemistry', 'chemical', 'reaction', 'molecule', 'compound', 'element'],
    'biology': ['biology', 'cell', 'organism', 'genetics', 'evolution', 'anatomy'],
    'english': ['english', 'grammar', 'literature', 'writing', 'essay', 'poem'],
    'history': ['history', 'historical', 'war', 'civilization', 'ancient', 'medieval'],
    'geography': ['geography', 'country', 'continent', 'climate', 'map', 'capital']
}

def classify_intent(message: str) -> tuple[str, float, Optional[str]]:
    """Classify user intent with confidence score and subject detection."""
    message_lower = message.lower()
    
    # Check for greeting patterns
    for pattern in INTENT_PATTERNS["greeting"]:
        if pattern in message_lower:
            return "greeting", 0.95, None
    
    # Check other intents
    for intent, patterns in INTENT_PATTERNS.items():
        if intent == "greeting":
            continue
        for pattern in patterns:
            if pattern in message_lower:
                subject = extract_subject(message_lower)
                confidence = 0.8 if subject else 0.7
                return intent, confidence, subject
    
    # Default to ask_question with subject detection
    subject = extract_subject(message_lower)
    confidence = 0.6 if subject else 0.5
    return "ask_question", confidence, subject

def extract_subject(message: str) -> Optional[str]:
    """Extract subject from message."""
    message_lower = message.lower()
    for subject, keywords in SUBJECT_KEYWORDS.items():
        for keyword in keywords:
            if keyword in message_lower:
                return subject
    return None

# ------------------------------
# RAG RETRIEVAL SYSTEM
# ------------------------------

class RAGRetriever:
    def __init__(self):
        self.collection = knowledge_collection
        self.embedding_model = embedding_model
        self._initialize_knowledge_base()
    
    def _initialize_knowledge_base(self):
        """Initialize with sample educational content."""
        sample_documents = [
            {
                "id": "math_algebra_basics",
                "subject": "mathematics",
                "topic": "algebra basics",
                "content": "Algebra is a branch of mathematics dealing with symbols and the rules for manipulating those symbols. Variables like x and y represent unknown numbers. Basic operations include addition, subtraction, multiplication, and division of algebraic expressions.",
                "grade_level": "8-10"
            },
            {
                "id": "physics_newton_laws",
                "subject": "physics", 
                "topic": "newton's laws",
                "content": "Newton's First Law: An object at rest stays at rest and an object in motion stays in motion unless acted upon by an unbalanced force. Newton's Second Law: Force equals mass times acceleration (F=ma). Newton's Third Law: For every action, there is an equal and opposite reaction.",
                "grade_level": "9-12"
            },
            {
                "id": "chemistry_periodic_table",
                "subject": "chemistry",
                "topic": "periodic table",
                "content": "The periodic table organizes chemical elements by atomic number. Elements in the same column (group) have similar properties. Metals are on the left, nonmetals on the right, and metalloids in between. The number of protons determines the element's identity.",
                "grade_level": "9-12"
            }
        ]
        
        # Check if collection is empty and populate it
        try:
            count = self.collection.count()
            if count == 0:
                self._add_documents(sample_documents)
        except Exception as e:
            print(f"Initializing knowledge base: {e}")
            self._add_documents(sample_documents)
    
    def _add_documents(self, documents: List[Dict]):
        """Add documents to ChromaDB."""
        for doc in documents:
            try:
                embedding = self.embedding_model.encode(doc["content"]).tolist()
                self.collection.add(
                    documents=[doc["content"]],  
                    metadatas=[{
                        "subject": doc["subject"],
                        "topic": doc["topic"],
                        "grade_level": doc.get("grade_level", "general")
                    }],
                    ids=[doc["id"]],
                    embeddings=[embedding]
                )
            except Exception as e:
                print(f"Error adding document {doc['id']}: {e}")
    
    def retrieve_relevant_docs(self, query: str, subject: Optional[str] = None, top_k: int = 3) -> List[str]:
        """Retrieve relevant documents for a query."""
        try:
            query_embedding = self.embedding_model.encode(query).tolist()
            
            where_clause = None
            if subject:
                where_clause = {"subject": {"$eq": subject}}
            
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where_clause
            )
            
            return results["documents"][0] if results["documents"] else []
        except Exception as e:
            print(f"Error retrieving documents: {e}")
            return []

rag_retriever = RAGRetriever()


async def generate_student_context(student_id: str) -> Dict[str, Any]:
    """Generate minimal context based on student data."""
    try:
        # Find student
        student = db.students.find_one({"studentId": student_id})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        
        user = None
        if "userId" in student and student["userId"]:
            try:
                user_id = ObjectId(student["userId"]) if isinstance(student["userId"], str) else student["userId"]
                user = db.users.find_one({"_id": user_id})
            except Exception as e:
                print(f"Error fetching user: {e}")
        
        recent_chats = []
        try:
            chats = list(db.chatinteractions.find(
                {"studentId": student_id}
            ).sort("timestamp", -1).limit(5))
            recent_chats = [
                {"question": chat.get("question", ""), "response": chat.get("response", "")}
                for chat in chats
            ]
        except Exception as e:
            print(f"Error fetching chat history: {e}")
        
        return {
            "name": user["name"] if user and "name" in user else "Student",
            "gradeLevel": student.get("gradeLevel", "Unknown"),
            "subjects": student.get("subjects", []),
            "learningStyle": student.get("learningStyle", "visual"),
            "academicHistory": student.get("academicHistory", []),
            "recentInteractions": recent_chats[:3]

        }
    except Exception as e:
        print(f"Error generating context: {e}")
        return {
            "name": "Student",
            "gradeLevel": "Unknown", 
            "subjects": [],
            "learningStyle": "visual",
            "academicHistory": [],
            "recentInteractions": []
        }

def summarize_academic_history(academic_history: List[Dict]) -> str:
    """Summarize academic history in natural language."""
    if not academic_history:
        return "No academic history available."
    
    summaries = []
    for subject_data in academic_history[:3]:  # Limit to 3 subjects
        subject = subject_data.get("subject", "Unknown")
        topics = subject_data.get("topics", [])
        if topics:
            topic_count = len(topics)
            summaries.append(f"{subject}: {topic_count} topics covered")
        else:
            summaries.append(f"{subject}: Just started")
    
    return "; ".join(summaries)

async def generate_parent_context(student_id: str) -> Dict[str, Any]:
    """Generate comprehensive context for parent chat, aggregating all student info."""
    try:
        # --- Student and User Info ---
        student = db.students.find_one({"studentId": student_id})
        if not student:
            raise HTTPException(status_code=404, detail="Student not found")
        user = None
        if "userId" in student and student["userId"]:
            try:
                user_id = ObjectId(student["userId"]) if isinstance(student["userId"], str) else student["userId"]
                user = db.users.find_one({"_id": user_id})
            except Exception as e:
                print(f"Error fetching user: {e}")
        parent_info = None
        if "parentId" in student and student["parentId"]:
            try:
                parent = db.users.find_one({"_id": student["parentId"]})
                if parent:
                    parent_info = {
                        "name": parent.get("name", ""),
                        "phone": parent.get("parentPhone", "")
                    }
            except Exception as e:
                print(f"Error fetching parent: {e}")
        # --- Attendance Summary ---
        attendance_records = list(db.attendance.find({"students.studentId": student.get("_id")}).sort("date", -1))
        total_classes = len(attendance_records)
        present_count = 0
        recent_absences = []
        for record in attendance_records:
            for s in record.get("students", []):
                if str(s.get("studentId")) == str(student.get("_id")):
                    if s.get("present", True):
                        present_count += 1
                    else:
                        recent_absences.append(record.get("date"))
        attendance_rate = (present_count / total_classes) * 100 if total_classes > 0 else None
        # --- Assignment & Submission Performance ---
        submissions = list(db.submissions.find({"studentId": student.get("_id")}))
        assignment_performance = []
        for sub in submissions[-5:]:  # last 5 submissions
            assignment = db.assignments.find_one({"_id": sub["assignmentId"]})
            if not assignment:
                continue
            scores = []
            feedbacks = []
            for ans in sub.get("answers", []):
                score = ans.get("aiScore") or (ans.get("teacherOverride", {}) or {}).get("score")
                if score is not None:
                    scores.append(score)
                fb = ans.get("aiFeedback") or (ans.get("teacherOverride", {}) or {}).get("feedback")
                if fb:
                    feedbacks.append(fb)
            avg_score = sum(scores) / len(scores) if scores else None
            assignment_performance.append({
                "title": assignment.get("title", "Assignment"),
                "avg_score": avg_score,
                "feedbacks": feedbacks[:2]
            })
        # --- Feedback History ---
        feedback_history = student.get("feedbackHistory", [])
        feedback_summary = []
        for fb in feedback_history[-3:]:
            feedback_summary.append({
                "subject": fb.get("subject", ""),
                "topic": fb.get("topic", ""),
                "feedback": fb.get("feedback", ""),
                "date": fb.get("date")
            })
        # --- Recent Interactions ---
        recent_chats = []
        try:
            chats = list(db.chatinteractions.find({"studentId": student_id}).sort("timestamp", -1).limit(5))
            recent_chats = [
                {"question": chat.get("question", ""), "response": chat.get("response", "")}
                for chat in chats
            ]
        except Exception as e:
            print(f"Error fetching chat history: {e}")
        # --- Interests & Goals ---
        interests = student.get("interests", [])
        # --- Academic History ---
        academic_history = student.get("academicHistory", [])
        # --- Photo URL ---
        photo_url = student.get("photoUrl", None)
        # --- Compose context ---
        return {
            "name": user["name"] if user and "name" in user else "Student",
            "gradeLevel": student.get("gradeLevel", "Unknown"),
            "subjects": student.get("subjects", []),
            "learningStyle": student.get("learningStyle", "visual"),
            "academicHistory": academic_history,
            "recentInteractions": recent_chats[:3],
            "interests": interests,
            "parentInfo": parent_info,
            # "attendanceRate": attendance_rate,
            "recentAbsences": recent_absences[:3],
            "assignmentPerformance": assignment_performance,
            "feedbackSummary": feedback_summary,
            "photoUrl": photo_url
        }
    except Exception as e:
        print(f"Error generating parent context: {e}")
        return {}

# ------------------------------
# PROMPT TEMPLATES
# ------------------------------

GREETING_RESPONSES = [
    "Hello! I'm your AI tutor. How can I help you learn today?",
    "Hi there! Ready to tackle some learning together?",
    "Good to see you! What subject would you like to explore?",
    "Hello! I'm here to help you succeed. What can we work on?"
]

TUTOR_PROMPT_TEMPLATE = Template("""
You are a professional subject tutor helping {{ name }}, a {{ gradeLevel }} student. Be encouraging, clear, and concise.

{% if intent == "get_progress" %}
Student Progress Summary:
- Learning style: {{ learningStyle }}
- Subjects: {{ subjects|join(", ") }}
- Academic progress: {{ academic_summary }}

Recent activity:
{% for interaction in recentInteractions[:2] %}
- Q: {{ interaction.question[:50] }}...
{% endfor %}

{% elif intent == "get_feedback" %}
Student Info:
- Name: {{ name }}
- Grade: {{ gradeLevel }}
- Academic progress: {{ academic_summary }}

{% elif intent == "ask_question" %}
Student: {{ name }} ({{ gradeLevel }}, {{ learningStyle }} learner)
Subject focus: {{ subjects|join(", ") }}

{% if retrieved_docs %}
Relevant Educational Material:
{% for doc in retrieved_docs %}
{{ doc }}

{% endfor %}
{% endif %}

{% if recentInteractions %}
Recent Learning Context:
{% for interaction in recentInteractions[:2] %}
Student asked: {{ interaction.question }}
{% endfor %}
{% endif %}

{% endif %}

Student's Question: {{ question }}

Instructions:
1. Answer clearly and concisely
2. Use examples or analogies appropriate for {{ gradeLevel }} level
3. Encourage the student
4. Ask if they need clarification or have follow-up questions
5. Keep response under 150 words unless complex explanation needed
""")

PARENT_PROMPT_TEMPLATE = Template("""
You are responding to a parent asking about their child {{ name }}, a {{ gradeLevel }} student.
Be professional, concise, and informative. Avoid repetition. Use only the facts below.

{% if photoUrl %}
- Student photo: {{ photoUrl }}
{% endif %}
- Learning style: {{ learningStyle }}
- Subjects: {{ subjects|join(", ") }}
- Interests: {{ interests|join(", ") if interests else 'N/A' }}

- Recent absences: {% for date in recentAbsences %}{{ date.strftime('%Y-%m-%d') if date else '' }} {% endfor %}
- Assignment performance:
{% for perf in assignmentPerformance %}
  - {{ perf.title }}: Avg score: {{ perf.avg_score|round(1) if perf.avg_score is not none else 'N/A' }}, Feedback: {% for fb in perf.feedbacks %}{{ fb }} {% endfor %}
{% endfor %}
- Teacher feedback:
{% for fb in feedbackSummary %}
  - {{ fb.subject }} {{ fb.topic }}: {{ fb.feedback }}
{% endfor %}

Recent activity:
{% for interaction in recentInteractions[:2] %}
- Q: {{ interaction.question[:50] }}...
{% endfor %}

Parent info: {% if parentInfo %}{{ parentInfo.name }} ({{ parentInfo.phone }}){% else %}N/A{% endif %}

Parent's Question: {{ question }}

Instructions:
1. Address the parent professionally
2. Provide only concrete, accurate information about {{ name }}'s learning
3. Suggest specific ways the parent can support their child at home
4. Be encouraging but honest about any challenges
5. Keep your tone warm, concise, and professional
6. Do not repeat information or speculate
7. Respect student privacy while being informative
""")

# ------------------------------
# RESPONSE GENERATION
# ------------------------------

async def generate_ai_response(question: str, context: Dict, intent: str, retrieved_docs: List[str]) -> str:
    """Generate AI response based on intent and context."""
    
    # Handle greetings without AI call
    if intent == "greeting":
        import random
        return random.choice(GREETING_RESPONSES)
    
    # Prepare context for prompt
    academic_summary = summarize_academic_history(context.get("academicHistory", []))
    
    # Generate prompt using template
    prompt = TUTOR_PROMPT_TEMPLATE.render(
        name=context.get("name", "Student"),
        gradeLevel=context.get("gradeLevel", "Unknown"),
        learningStyle=context.get("learningStyle", "visual"),
        subjects=context.get("subjects", []),
        academic_summary=academic_summary,
        recentInteractions=context.get("recentInteractions", []),
        retrieved_docs=retrieved_docs,
        question=question,
        intent=intent
    )
    
    try:
        # Generate response with Gemini
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Error generating AI response: {e}")
        return "I'm having trouble processing your question right now. Could you please try asking again?"

async def generate_parent_response(question: str, context: Dict, intent: str, retrieved_docs: List[str]) -> str:
    """Generate AI response for parent queries."""
    
    # Prepare context for prompt
    academic_summary = summarize_academic_history(context.get("academicHistory", []))
    student_name = context.get("name", "your child")
    
    # Create parent-specific prompt
    parent_prompt = PARENT_PROMPT_TEMPLATE.render(
        name=context.get("name", "Student"),
        gradeLevel=context.get("gradeLevel", "Unknown"),
        learningStyle=context.get("learningStyle", "visual"),
        subjects=context.get("subjects", []),
        academic_summary=academic_summary,
        recentInteractions=context.get("recentInteractions", []),
        retrieved_docs=retrieved_docs,
        question=question,
        intent=intent
    )
    
    try:
        # Generate response with Gemini
        response = model.generate_content(parent_prompt)
        return response.text.strip()
    except Exception as e:
        print(f"Error generating parent AI response: {e}")
        return f"I'm having trouble processing your question about {student_name} right now. Please try again later."

# ------------------------------
# API ENDPOINTS
# ------------------------------

@router.post("/classify-intent", response_model=IntentResponse)
async def classify_intent_endpoint(request: IntentRequest):
    """Classify user intent."""
    intent, confidence, subject = classify_intent(request.message)
    return IntentResponse(intent=intent, confidence=confidence, subject=subject)

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """Main chat endpoint with RAG implementation."""
    try:
        print(f"📝 Received chat request: student_id={request.student_id}, question='{request.question}'")
        
        # Classify intent
        intent, confidence, subject = classify_intent(request.question)
        print(f"🧠 Intent classified: {intent} (confidence: {confidence:.2f}, subject: {subject})")
        
        # Generate student context only if needed
        context = {}
        if intent != "greeting":
            context = await generate_student_context(request.student_id)
            print(f"📊 Context generated for non-greeting intent")
        
        # Retrieve relevant documents for learning questions
        retrieved_docs = []
        if intent in ["ask_question", "get_help"] and subject:
            retrieved_docs = rag_retriever.retrieve_relevant_docs(
                request.question, 
                subject=subject,
                top_k=3
            )
            print(f"📚 Retrieved {len(retrieved_docs)} documents for subject: {subject}")
        
        # Generate response
        answer = await generate_ai_response(
            request.question, 
            context, 
            intent, 
            retrieved_docs
        )
        print(f"✅ Generated response: {answer[:50]}...")
        
        # Save interaction to database
        try:
            interaction = {
                "studentId": request.student_id,
                "question": request.question,
                "response": answer,
                "intent": intent,
                "subject": subject,
                "timestamp": datetime.utcnow(),
                "retrievedDocs": len(retrieved_docs)
            }
            db.chatinteractions.insert_one(interaction)
            print(f"💾 Saved interaction to database")
        except Exception as e:
            print(f"⚠️ Error saving interaction: {e}")
        
        return ChatResponse(
            answer=answer,
            intent=intent,
            retrieved_docs=retrieved_docs[:2],  # Return only top 2 for response
            context_used={
                "subject": subject,
                "docs_retrieved": len(retrieved_docs),
                "context_level": "full" if intent != "greeting" else "minimal"
            }
        )
        
    except Exception as e:
        print(f"❌ Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing request: {str(e)}")

@router.post("/parent-chat", response_model=ChatResponse)
async def parent_chat_endpoint(request: ChatRequest):
    """Chat endpoint specialized for parent queries about their child."""
    try:
        print(f"👪 Received parent chat request: student_id={request.student_id}, question='{request.question}'")
        # Classify intent similar to regular chat
        intent, confidence, subject = classify_intent(request.question)
        print(f"🧠 Parent intent classified: {intent} (confidence: {confidence:.2f}, subject: {subject})")
        # Generate enhanced parent context
        context = await generate_parent_context(request.student_id)
        print(f"📊 Parent context generated for parent query")
        # Retrieve relevant documents if needed
        retrieved_docs = []
        if intent in ["ask_question", "get_help"] and subject:
            retrieved_docs = rag_retriever.retrieve_relevant_docs(
                request.question, 
                subject=subject,
                top_k=3
            )
            print(f"📚 Retrieved {len(retrieved_docs)} documents for parent query on subject: {subject}")
        # Generate parent-specific response
        answer = await generate_parent_response(
            request.question, 
            context, 
            intent, 
            retrieved_docs
        )
        print(f"✅ Generated parent response: {answer[:50]}...")
        # Save interaction to database with parent flag
        try:
            interaction = {
                "studentId": request.student_id,
                "question": request.question,
                "response": answer,
                "intent": intent,
                "subject": subject,
                "timestamp": datetime.utcnow(),
                "retrievedDocs": len(retrieved_docs),
                "type": "whatsapp"  # Mark as parent/WhatsApp interaction
            }
            db.chatinteractions.insert_one(interaction)
            print(f"💾 Saved parent interaction to database")
        except Exception as e:
            print(f"⚠️ Error saving parent interaction: {e}")
        return ChatResponse(
            answer=answer,
            intent=intent,
            retrieved_docs=retrieved_docs[:2],
            context_used={
                "subject": subject,
                "docs_retrieved": len(retrieved_docs),
                "context_level": "parent"
            }
        )
    except Exception as e:
        print(f"❌ Error in parent chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing parent request: {str(e)}")

@router.post("/add-document")
async def add_document_endpoint(request: DocumentRequest):
    """Add educational content to knowledge base."""
    try:
        doc = {
            "id": f"{request.subject}_{request.topic}_{datetime.now().timestamp()}",
            "subject": request.subject,
            "topic": request.topic,
            "content": request.content,
            "grade_level": request.grade_level or "general"
        }
        
        rag_retriever._add_documents([doc])
        return {"message": "Document added successfully", "id": doc["id"]}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding document: {str(e)}")

@router.get("/health")
async def health_check():
    """Health check endpoint."""
    try:
        # Test database connection
        db.students.find_one({}, {"_id": 1})
        
        # Test ChromaDB connection
        rag_retriever.collection.count()
        
        return {
            "status": "healthy",
            "timestamp": datetime.utcnow(),
            "services": {
                "mongodb": "connected",
                "chromadb": "connected", 
                "gemini": "configured"
            }
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow()
        }

@router.post("/test-chat")
async def test_chat_endpoint(data: dict):
    """Test endpoint to debug request format."""
    print(f"🔍 Raw request data: {data}")
    
    try:
        # Try to create ChatRequest manually
        chat_request = ChatRequest(**data)
        print(f"✅ ChatRequest created successfully: {chat_request}")
        
        return {
            "status": "success",
            "student_id": chat_request.student_id,
            "question": chat_request.question,
            "data_received": data
        }
    except Exception as e:
        print(f"❌ Error creating ChatRequest: {e}")
        return {
            "status": "error",
            "error": str(e),
            "data_received": data
        }

# Mount router
app.include_router(router)

# ------------------------------
# STARTUP EVENTS
# ------------------------------

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup."""
    print("🚀 Professional RAG AI Tutor Service Starting...")
    print(f"📊 MongoDB: {MONGO_URI}")
    print(f"🧠 ChromaDB: {CHROMA_DB_PATH}")
    print("✅ RAG System Initialized")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
