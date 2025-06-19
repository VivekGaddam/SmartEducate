from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict
import json
from pymongo import MongoClient
import random
from bson import ObjectId
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables
load_dotenv()

# Configure Gemini API
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Initialize FastAPI
app = FastAPI()

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["student-teacher-app"]

# ------------------ Models ------------------ #

class Question(BaseModel):
    type: str
    questionText: str
    options: Optional[List[str]] = None
    correctAnswer: Optional[str] = None

class GenerateRequest(BaseModel):
    student_id: str
    class_level: str
    subject: str
    topic: str

class PreviewResponse(BaseModel):
    questions: List[Question]
    analysis: Dict
    preview_id: str

# ------------------ Utils ------------------ #

def analyze_past_performance(student_id: str) -> dict:
    submissions = list(db.submissions.find({"studentId": student_id}))

    if not submissions:
        return {"weak_areas": [], "strong_areas": []}

    performance = {}
    for submission in submissions:
        assignment = db.assignments.find_one({"_id": submission["assignmentId"]})
        if not assignment:
            continue

        for ans, q in zip(submission["answers"], assignment["questions"]):
            q_type = q["type"]
            if q_type == "mcq":
                is_correct = ans.get("answerText") == q.get("correctAnswer")
                if q_type not in performance:
                    performance[q_type] = {"correct": 0, "total": 0}
                performance[q_type]["total"] += 1
                if is_correct:
                    performance[q_type]["correct"] += 1

    weak_areas, strong_areas = [], []
    for q_type, stats in performance.items():
        success_rate = stats["correct"] / stats["total"]
        if success_rate < 0.7:
            weak_areas.append(q_type)
        else:
            strong_areas.append(q_type)

    return {"weak_areas": weak_areas, "strong_areas": strong_areas}

# ------------------ AI Generator ------------------ #

async def generate_questions_with_gemini(class_level: str, subject: str, topic: str, analysis: dict) -> List[Question]:
    system_prompt = """You are an expert teacher creating questions for students.
Generate both multiple choice and written questions based on the given parameters.
Focus more on weak areas if specified. Format your response as valid JSON with the following structure:
{
    "mcq": [
        {
            "question": "Question text",
            "options": ["A", "B", "C", "D"],
            "correct": "B"
        }
    ],
    "written": [
        {
            "question": "Written question text"
        }
    ]
}"""

    user_prompt = f"""Create an educational assessment with:
- 3 multiple choice questions
- 2 written response questions
For: Class {class_level}
Subject: {subject}
Topic: {topic}

Requirements:
- MCQs should have 4 options each
- Questions should be grade-appropriate
- Include a mix of recall and understanding questions
- Written questions should encourage critical thinking
"""

    if analysis["weak_areas"]:
        user_prompt += f"\nNote: The student needs extra practice with {', '.join(analysis['weak_areas'])} type questions."

    try:
        model = genai.GenerativeModel("models/gemini-1.5-flash")
        response = model.generate_content([system_prompt, user_prompt])
        print("🧠 Gemini raw output:\n", response.text)  # For debugging
        
        # Improved JSON extraction logic
        response_text = response.text.strip()
        
        # Remove markdown code blocks if present
        if response_text.startswith("```json"):
            response_text = response_text[7:]  # Remove ```json
        elif response_text.startswith("```"):
            response_text = response_text[3:]   # Remove ```
            
        if response_text.endswith("```"):
            response_text = response_text[:-3]  # Remove trailing ```
            
        response_text = response_text.strip()
        
        try:
            question_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            print(f"JSON Parse Error: {e}")
            print(f"Cleaned text: {response_text}")
            raise HTTPException(status_code=500, detail=f"Invalid JSON from Gemini: {str(e)}\n\nCleaned Response:\n{response_text}")

        questions = []

        for mcq in question_data.get("mcq", []):
            questions.append(Question(
                type="mcq",
                questionText=mcq["question"],
                options=mcq["options"],
                correctAnswer=mcq["correct"]
            ))

        for written in question_data.get("written", []):
            questions.append(Question(
                type="written",
                questionText=written["question"]
            ))

        return questions

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate questions using Gemini: {str(e)}")
# ------------------ Routes ------------------ #

@app.post("/generate-assignment", response_model=PreviewResponse)
async def generate_assignment(request: GenerateRequest):
    try:
        analysis = analyze_past_performance(request.student_id)

        questions = await generate_questions_with_gemini(
            request.class_level,
            request.subject,
            request.topic,
            analysis
        )

        preview = {
            "student_id": request.student_id,
            "class_level": request.class_level,
            "subject": request.subject,
            "topic": request.topic,
            "questions": [q.dict() for q in questions],
            "analysis": analysis,
            "status": "preview"
        }

        result = db.assignment_previews.insert_one(preview)

        return {
            "questions": questions,
            "analysis": analysis,
            "preview_id": str(result.inserted_id)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save-assignment/{preview_id}")
async def save_assignment(preview_id: str):
    try:
        preview = db.assignment_previews.find_one({"_id": ObjectId(preview_id)})
        if not preview:
            raise HTTPException(status_code=404, detail="Preview not found")

        assignment = {
            "title": f"{preview['subject']} - {preview['topic']}",
            "description": f"AI-generated assignment for {preview['class_level']} level {preview['subject']} on {preview['topic']}",
            "classLevel": preview['class_level'],
            "questions": preview['questions'],
            "isAiGenerated": True,
            "createdBy": preview['student_id']  # Ideally should be teacher_id
        }

        result = db.assignments.insert_one(assignment)

        db.assignment_previews.update_one(
            {"_id": ObjectId(preview_id)},
            {"$set": {"status": "saved"}}
        )

        return {
            "message": "Assignment saved successfully",
            "assignment_id": str(result.inserted_id)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
