from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import cv2
import numpy as np
from PIL import Image
import io
import os
import re
import google.generativeai as genai
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY not found in environment variables")

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")

app = FastAPI(title="Gemini Handwriting Assignment Evaluator", version="1.0.0")

class StudentInfo(BaseModel):
    student_id: str
    name: str
    grade_level: str
    subject: str
    previous_scores: Optional[List[float]] = None
    learning_style: Optional[str] = None
    strengths: Optional[List[str]] = None
    areas_for_improvement: Optional[List[str]] = None

class AnswerRequest(BaseModel):
    question_text: str
    expected_answer: Optional[str] = None
    student_info: Optional[StudentInfo] = None

class QuestionAnswer(BaseModel):
    question: str
    answer: str
    feedback: Optional[str] = None
    score: Optional[float] = None
    is_correct: Optional[bool] = None

class EvaluationResponse(BaseModel):
    pairs: List[QuestionAnswer]
    raw_text: str
    overall_feedback: str
    total_score: float
    max_score: float
    confidence: str
    personalized_advice: Optional[str] = None

class SingleAnswerResponse(BaseModel):
    score: float
    max_score: float
    feedback: str
    extracted_text: str
    confidence: str
    personalized_advice: Optional[str] = None

def prepare_image_for_gemini(image_bytes):
    """Prepare image for Gemini API processing"""
    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if too large (Gemini has size limits)
        max_size = 2048
        if max(image.size) > max_size:
            image.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
            print(f"📏 Resized image to fit within {max_size}px")
        
        return image
        
    except Exception as e:
        raise ValueError(f"Error preparing image: {e}")

def extract_handwritten_text(image_bytes):
    """Extract text from handwritten image using Gemini"""
    try:
        image = prepare_image_for_gemini(image_bytes)
        
        prompt = """
        Please extract ALL text from this handwritten image with high accuracy.
        This appears to be a student's assignment or homework.
        
        Important instructions:
        1. Extract every visible word, number, and symbol
        2. Maintain the original structure and line breaks
        3. If you see question numbers (like Q1, Q2, etc.), include them
        4. If you see "Ans:" or "Answer:" labels, include them
        5. Be very careful with mathematical expressions and numbers
        6. If handwriting is unclear, provide your best interpretation
        
        Return ONLY the extracted text, preserving the original formatting as much as possible.
        """
        
        response = model.generate_content([prompt, image])
        return response.text.strip()
        
    except Exception as e:
        print(f"Gemini OCR Error: {str(e)}")
        return ""

def extract_qa_pairs_advanced(text: str) -> List[QuestionAnswer]:
    """
    Advanced extraction of question-answer pairs using multiple patterns
    """
    pairs = []
    
    # Pattern 1: Q1) Question \n Ans: Answer
    pattern1 = r"(Q\d+\)?\.?\s*[^Qq\n]+?)(?:\n\s*)?(Ans[:\-]?\s*[^\nQ]+)"
    matches1 = re.finditer(pattern1, text, re.IGNORECASE | re.MULTILINE)
    
    for match in matches1:
        question_line = match.group(1).strip()
        answer_line = match.group(2).strip()
        
        # Clean question
        question = re.sub(r"^Q\d+\)?\.?\s*", "", question_line).strip()
        # Clean answer
        answer = re.sub(r"^Ans[:\-]?\s*", "", answer_line, flags=re.IGNORECASE).strip()
        
        if question and answer:
            pairs.append(QuestionAnswer(question=question, answer=answer))
    
    # Pattern 2: Question? \n Answer (without Q labels)
    if not pairs:
        lines = text.split('\n')
        current_question = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Check if line looks like a question
            if '?' in line or line.lower().startswith(('what', 'how', 'why', 'when', 'where')):
                current_question = line
            elif current_question and not line.lower().startswith(('ans', 'answer')):
                # This might be an answer
                answer = re.sub(r"^(ans|answer)[:\-]?\s*", "", line, flags=re.IGNORECASE).strip()
                if answer:
                    pairs.append(QuestionAnswer(question=current_question, answer=answer))
                    current_question = None
    
    return pairs

def clean_json_response(text: str) -> str:
    """Clean and extract JSON from Gemini response"""
    # Remove markdown code blocks
    text = re.sub(r'```json\n?', '', text)
    text = re.sub(r'\n?```', '', text)
    
    # Find JSON content between curly braces
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if json_match:
        return json_match.group(0)
    
    return text

def evaluate_with_gemini(pairs: List[QuestionAnswer], student_info: Optional[StudentInfo] = None) -> Dict:
    """Use Gemini to evaluate the question-answer pairs with enhanced feedback"""
    try:
        evaluation_prompt = f"""
        You are an expert teacher evaluating a student's handwritten assignment.
        
        {"Student Information:" if student_info else ""}
        {f"Name: {student_info.name}" if student_info and student_info.name else ""}
        {f"Grade Level: {student_info.grade_level}" if student_info and student_info.grade_level else ""}
        {f"Subject: {student_info.subject}" if student_info and student_info.subject else ""}
        {f"Previous Performance: {student_info.previous_scores}" if student_info and student_info.previous_scores else ""}
        {f"Learning Style: {student_info.learning_style}" if student_info and student_info.learning_style else ""}
        {f"Strengths: {', '.join(student_info.strengths)}" if student_info and student_info.strengths else ""}
        {f"Areas for Improvement: {', '.join(student_info.areas_for_improvement)}" if student_info and student_info.areas_for_improvement else ""}
        
        For each question-answer pair below, please:
        1. Determine if the answer is correct
        2. Provide specific, encouraging feedback
        3. Give a score out of 10
        4. Rate your confidence in reading the handwriting (High/Medium/Low)
        
        Please respond ONLY in JSON format (no markdown, no extra text):
        {{
            "evaluations": [
                {{
                    "question_number": 1,
                    "is_correct": true,
                    "score": 10,
                    "feedback": "Great work! Your answer is correct and shows good understanding.",
                    "confidence": "High"
                }}
            ],
            "overall_feedback": "You're doing well! Keep practicing and focus on...",
            "handwriting_quality": "Good - clear and readable",
            "personalized_advice": "Based on your learning style and strengths..."
        }}
        
        Questions and Answers to evaluate:
        """
        
        for i, pair in enumerate(pairs, 1):
            evaluation_prompt += f"\n\nQuestion {i}: {pair.question}"
            evaluation_prompt += f"\nStudent's Answer: {pair.answer}"
        
        response = model.generate_content(evaluation_prompt)
        
        # Clean and parse JSON response
        cleaned_response = clean_json_response(response.text)
        
        try:
            return json.loads(cleaned_response)
        except json.JSONDecodeError as e:
            print(f"JSON Parse Error: {e}")
            print(f"Cleaned Response: {cleaned_response}")
            # Fallback response
            return {
                "evaluations": [
                    {
                        "question_number": i+1,
                        "is_correct": True,
                        "score": 8,
                        "feedback": "Good effort! Keep practicing.",
                        "confidence": "Medium"
                    } for i in range(len(pairs))
                ],
                "overall_feedback": "Great work on this assignment! You're showing good understanding of the concepts.",
                "handwriting_quality": "Good",
                "personalized_advice": "Continue practicing regularly to improve your skills further."
            }
            
    except Exception as e:
        print(f"Evaluation Error: {str(e)}")
        return {
            "evaluations": [
                {
                    "question_number": i+1,
                    "is_correct": True,
                    "score": 5,
                    "feedback": "Please review this topic and try again.",
                    "confidence": "Low"
                } for i in range(len(pairs))
            ],
            "overall_feedback": f"There was an issue with evaluation. Please try again.",
            "handwriting_quality": "Needs improvement",
            "personalized_advice": "Focus on writing more clearly and review the material."
        }

def generate_tutor_feedback(student_info: Optional[StudentInfo], total_score: float, max_score: float, subject_area: str = "general") -> str:
    """Generate personalized tutor-like feedback based on student information"""
    
    percentage = (total_score / max_score) * 100 if max_score > 0 else 0
    
    base_feedback = ""
    
    # Performance-based feedback
    if percentage >= 90:
        base_feedback = "Excellent work! You've demonstrated a strong mastery of the concepts. "
    elif percentage >= 80:
        base_feedback = "Great job! You're showing good understanding with room for small improvements. "
    elif percentage >= 70:
        base_feedback = "Good effort! You're on the right track, but let's work on strengthening a few areas. "
    elif percentage >= 60:
        base_feedback = "You're making progress! Let's focus on reviewing some key concepts to boost your confidence. "
    else:
        base_feedback = "Don't worry - everyone learns at their own pace! Let's work together to build your understanding step by step. "
    
    # Add personalized advice if student info is available
    if student_info:
        personalized_advice = f"Hi {student_info.name}! "
        
        # Grade-level specific advice
        if student_info.grade_level:
            if student_info.grade_level.lower() in ['1', '2', '3', 'first', 'second', 'third']:
                personalized_advice += "You're doing great for your grade level! Keep practicing every day. "
            elif student_info.grade_level.lower() in ['4', '5', '6', 'fourth', 'fifth', 'sixth']:
                personalized_advice += "You're building important foundational skills. Focus on understanding the 'why' behind each answer. "
            else:
                personalized_advice += "You're developing advanced problem-solving skills. Think critically about each question. "
        
        # Learning style advice
        if student_info.learning_style:
            if student_info.learning_style.lower() == 'visual':
                personalized_advice += "Since you're a visual learner, try drawing diagrams or using colors to organize your work. "
            elif student_info.learning_style.lower() == 'auditory':
                personalized_advice += "As an auditory learner, try reading questions aloud or explaining your answers to someone. "
            elif student_info.learning_style.lower() == 'kinesthetic':
                personalized_advice += "Use hands-on activities and physical movement to help reinforce these concepts. "
        
        # Strengths-based encouragement
        if student_info.strengths:
            personalized_advice += f"Your strengths in {', '.join(student_info.strengths)} really show in this work! "
        
        # Areas for improvement
        if student_info.areas_for_improvement:
            personalized_advice += f"Let's continue working on {', '.join(student_info.areas_for_improvement)} - you're making good progress! "
        
        # Previous performance context
        if student_info.previous_scores:
            avg_previous = sum(student_info.previous_scores) / len(student_info.previous_scores)
            if percentage > avg_previous * 10:  # Assuming previous scores are also percentages
                personalized_advice += "I can see you've improved from your previous work - keep up the momentum! "
            elif percentage < avg_previous * 10:
                personalized_advice += "This might be a bit lower than your usual performance. Let's review together to get you back on track. "
        
        return base_feedback + personalized_advice
    
    return base_feedback + "Keep practicing and don't hesitate to ask questions when you need help!"

def evaluate_single_answer(extracted_text: str, expected_answer: str = None, student_info: Optional[StudentInfo] = None) -> Dict:
    """Evaluate a single answer using Gemini with enhanced feedback"""
    try:
        prompt = f"""
        You are a caring teacher evaluating a student's handwritten answer.
        
        {f"Student: {student_info.name}" if student_info and student_info.name else ""}
        {f"Grade: {student_info.grade_level}" if student_info and student_info.grade_level else ""}
        
        Extracted text: "{extracted_text}"
        """
        
        if expected_answer:
            prompt += f"\nExpected answer: {expected_answer}"
        
        prompt += """
        
        Please provide encouraging, constructive feedback like a supportive tutor would.
        
        Respond ONLY in JSON format:
        {
            "score": 8,
            "feedback": "Great effort! You got the main idea right. Here's how to make it even better...",
            "confidence": "High",
            "is_correct": true
        }
        """
        
        response = model.generate_content(prompt)
        cleaned_response = clean_json_response(response.text)
        
        try:
            return json.loads(cleaned_response)
        except json.JSONDecodeError:
            return {
                "score": 7,
                "feedback": "Good work! Keep practicing to improve further.",
                "confidence": "Medium",
                "is_correct": True
            }
            
    except Exception as e:
        return {
            "score": 5,
            "feedback": f"There was an issue evaluating your answer. Please try writing more clearly.",
            "confidence": "Low",
            "is_correct": False
        }

@app.post("/evaluate-answer", response_model=SingleAnswerResponse)
async def evaluate_answer(image: UploadFile = File(...), 
                         question_text: str = None, 
                         expected_answer: str = None,
                         student_name: str = None,
                         grade_level: str = None,
                         subject: str = None):
    """Evaluate a single handwritten answer with personalized feedback"""
    try:
        # Read image
        image_bytes = await image.read()
        
        # Create student info if provided
        student_info = None
        if student_name or grade_level or subject:
            student_info = StudentInfo(
                student_id="temp",
                name=student_name or "Student",
                grade_level=grade_level or "Unknown",
                subject=subject or "General"
            )
        
        # Extract text using Gemini
        extracted_text = extract_handwritten_text(image_bytes)
        print("EXTRACTED TEXT:\n", extracted_text)
        
        if not extracted_text:
            return SingleAnswerResponse(
                score=0,
                max_score=10,
                feedback="I couldn't read your handwriting clearly. Try writing a bit bigger and clearer next time!",
                extracted_text="",
                confidence="Low",
                personalized_advice="Practice writing neatly - it will help you in all your subjects!"
            )
        
        # Evaluate with Gemini
        evaluation = evaluate_single_answer(extracted_text, expected_answer, student_info)
        
        # Generate personalized advice
        personalized_advice = generate_tutor_feedback(
            student_info, 
            evaluation.get("score", 0), 
            10, 
            subject or "general"
        )
        
        return SingleAnswerResponse(
            score=evaluation.get("score", 0),
            max_score=10,
            feedback=evaluation.get("feedback", "Keep working hard!"),
            extracted_text=extracted_text,
            confidence=evaluation.get("confidence", "Medium"),
            personalized_advice=personalized_advice
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/evaluate-assignment", response_model=EvaluationResponse)
async def evaluate_assignment(image: UploadFile = File(...),
                            student_name: str = None,
                            grade_level: str = None,
                            subject: str = None,
                            learning_style: str = None):
    """Evaluate a complete handwritten assignment with personalized tutor feedback"""
    try:
        # Read image
        image_bytes = await image.read()
        
        # Create student info if provided
        student_info = None
        if student_name or grade_level or subject:
            student_info = StudentInfo(
                student_id="temp",
                name=student_name or "Student",
                grade_level=grade_level or "Unknown",
                subject=subject or "General",
                learning_style=learning_style
            )
        
        # Extract text using Gemini
        extracted_text = extract_handwritten_text(image_bytes)
        print("EXTRACTED TEXT:\n", extracted_text)
        
        if not extracted_text:
            raise HTTPException(
                status_code=400,
                detail="No text could be extracted from the image. Please ensure the image is clear and well-lit."
            )
        
        # Extract Q&A pairs
        qa_pairs = extract_qa_pairs_advanced(extracted_text)
        if not qa_pairs:
            raise HTTPException(
                status_code=400,
                detail="No question-answer pairs found. Please ensure your assignment has clear Q: and Ans: labels."
            )
        
        # Evaluate with Gemini
        evaluation_result = evaluate_with_gemini(qa_pairs, student_info)
        
        # Update qa_pairs with evaluation results
        evaluations = evaluation_result.get("evaluations", [])
        total_score = 0
        confidence_levels = []
        
        for i, pair in enumerate(qa_pairs):
            if i < len(evaluations):
                eval_data = evaluations[i]
                pair.score = eval_data.get("score", 5)
                pair.feedback = eval_data.get("feedback", "Good effort!")
                pair.is_correct = eval_data.get("is_correct", True)
                total_score += pair.score
                confidence_levels.append(eval_data.get("confidence", "Medium"))
            else:
                # Fallback for missing evaluations
                pair.score = 7
                pair.feedback = "Good work! Keep practicing."
                pair.is_correct = True
                total_score += 7
                confidence_levels.append("Medium")
        
        # Determine overall confidence
        if not confidence_levels:
            overall_confidence = "Medium"
        else:
            high_count = confidence_levels.count("High")
            low_count = confidence_levels.count("Low")
            if high_count > len(confidence_levels) / 2:
                overall_confidence = "High"
            elif low_count > len(confidence_levels) / 2:
                overall_confidence = "Low"
            else:
                overall_confidence = "Medium"
        
        max_score = len(qa_pairs) * 10
        
        # Generate personalized tutor feedback
        personalized_advice = generate_tutor_feedback(
            student_info, 
            total_score, 
            max_score, 
            subject or "general"
        )
        
        return EvaluationResponse(
            pairs=qa_pairs,
            raw_text=extracted_text,
            overall_feedback=evaluation_result.get("overall_feedback", "Great work on completing this assignment!"),
            total_score=total_score,
            max_score=max_score,
            confidence=overall_confidence,
            personalized_advice=personalized_advice
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing assignment: {str(e)}"
        )

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "Enhanced Gemini Handwriting Assignment Evaluator is running!",
        "version": "2.0.0",
        "features": [
            "Handwriting OCR with Gemini AI",
            "Intelligent scoring and feedback", 
            "Personalized tutor-like advice",
            "Student profile integration",
            "Multiple question format support"
        ],
        "endpoints": [
            "/evaluate-answer - Evaluate single handwritten answer",
            "/evaluate-assignment - Evaluate complete assignment",
            "/docs - API documentation"
        ]
    }

@app.get("/health")
async def health_check():
    """Health check for monitoring"""
    try:
        # Test Gemini API connection
        test_response = model.generate_content("Hello")
        return {
            "status": "healthy",
            "gemini_api": "connected",
            "message": "All systems operational"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "gemini_api": "error",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5002)