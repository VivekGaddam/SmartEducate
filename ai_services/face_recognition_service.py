from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from deepface import DeepFace
import cv2
import numpy as np
from typing import List, Dict, Optional, Tuple
from pymongo import MongoClient
import requests
from PIL import Image
from io import BytesIO
import os
from dotenv import load_dotenv
import logging
import uuid
from pydantic import BaseModel
import time
from concurrent.futures import ThreadPoolExecutor

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

load_dotenv()

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ImageURL(BaseModel):
    image_url: str

def preprocess_image(image: np.ndarray) -> np.ndarray:
    """Preprocess image for better face detection"""
    try:
        # Convert to RGB if needed
        if len(image.shape) == 2:  # Grayscale
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        elif image.shape[2] == 4:  # RGBA
            image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
        
        # Resize if image is too large
        max_dimension = 1200
        height, width = image.shape[:2]
        if height > max_dimension or width > max_dimension:
            scale = max_dimension / max(height, width)
            new_width = int(width * scale)
            new_height = int(height * scale)
            image = cv2.resize(image, (new_width, new_height))
        
        # Enhance contrast
        lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        enhanced = cv2.merge((cl, a, b))
        image = cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)
        
        return image
    except Exception as e:
        logger.error(f"Error preprocessing image: {str(e)}")
        raise

def download_image_as_array(url: str) -> np.ndarray:
    """Download image from Cloudinary URL and convert to numpy array"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        
        image = Image.open(BytesIO(response.content))
        image_array = np.array(image)
        
        # Convert RGB to BGR for OpenCV compatibility
        if len(image_array.shape) == 3 and image_array.shape[2] == 3:
            image_array = cv2.cvtColor(image_array, cv2.COLOR_RGB2BGR)
            
        # Preprocess image
        image_array = preprocess_image(image_array)
        
        return image_array
    except requests.Timeout:
        logger.error("Timeout downloading image")
        raise HTTPException(status_code=408, detail="Timeout downloading image")
    except requests.RequestException as e:
        logger.error(f"Error downloading image: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to download image: {str(e)}")
    except Exception as e:
        logger.error(f"Error processing downloaded image: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error processing image: {str(e)}")

class FaceRecognitionService:
    def __init__(self):
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        try:
            self.mongo = MongoClient(mongo_uri)
            self.db = self.mongo["student-teacher-app"]
            self.students = self.db["students"]
            self.thread_pool = ThreadPoolExecutor(max_workers=3)
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {str(e)}")
            raise

    async def get_all_embeddings(self) -> List[Dict]:
        try:
            students = list(self.students.find(
                {"embedding": {"$exists": True}},
                {"studentId": 1, "embedding": 1, "_id": 0}
            ))
            if not students:
                logger.warning("No student embeddings found in database")
            return students
        except Exception as e:
            logger.error(f"Database error while fetching embeddings: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    def extract_faces_with_retry(self, img_path: str, max_retries: int = 3) -> List[Dict]:
        """Extract faces with retry mechanism"""
        for attempt in range(max_retries):
            try:
                faces = DeepFace.extract_faces(
                    img_path=img_path,
                    detector_backend='retinaface',
                    enforce_detection=False,
                    align=True
                )
                if faces:
                    return faces
                if attempt < max_retries - 1:
                    logger.warning(f"No faces detected, attempt {attempt + 1}/{max_retries}")
                    time.sleep(1)  # Wait before retry
            except Exception as e:
                if attempt < max_retries - 1:
                    logger.warning(f"Face detection failed, attempt {attempt + 1}/{max_retries}: {str(e)}")
                    time.sleep(1)
                else:
                    raise

        return []

    async def get_face_embedding_from_url(self, image_url: str) -> List[float]:
        try:
            image_array = download_image_as_array(image_url)
            success, buffer = cv2.imencode('.jpg', image_array)
            if not success:
                raise ValueError("Failed to encode image as JPG")
            image_bytes = buffer.tobytes()
            return await self.get_face_embedding(image_bytes)
        except Exception as e:
            logger.error(f"Error processing image URL: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_face_embedding(self, image_bytes: bytes) -> List[float]:
        temp_img_path = None
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                raise ValueError("Failed to decode image")

            # Preprocess image
            img = preprocess_image(img)

            # Save preprocessed image
            temp_img_path = f"temp_{uuid.uuid4().hex}.jpg"
            cv2.imwrite(temp_img_path, img)

            # Extract faces with retry
            faces = self.extract_faces_with_retry(temp_img_path)

            if not faces:
                raise HTTPException(status_code=400, detail="No face detected in image")
            if len(faces) > 1:
                raise HTTPException(status_code=400, detail="Multiple faces detected in image")

            # Get embedding using detected face
            embedding = DeepFace.represent(
                img_path=temp_img_path,
                model_name='ArcFace',
                detector_backend='retinaface',
                enforce_detection=False,
                align=True
            )

            if not embedding or not embedding[0].get('embedding'):
                raise ValueError("Failed to generate embedding")

            return embedding[0]['embedding']

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error processing face: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error processing face: {str(e)}")
        finally:
            if temp_img_path and os.path.exists(temp_img_path):
                try:
                    os.remove(temp_img_path)
                except Exception as e:
                    logger.warning(f"Failed to remove temporary file: {str(e)}")

    async def process_single_face(self, face: Dict, face_idx: int, students: List[Dict]) -> Optional[str]:
        """Process a single face and return matched student ID if found"""
        face_path = f"temp_face_{uuid.uuid4().hex}_{face_idx}.jpg"
        try:
            cv2.imwrite(face_path, face['face'])
            embedding = DeepFace.represent(
                img_path=face_path,
                model_name='ArcFace',
                detector_backend='retinaface',
                enforce_detection=False,
                align=True
            )

            min_distance = float('inf')
            matched_student = None

            # Compare with all student embeddings
            for student in students:
                distance = np.linalg.norm(
                    np.array(embedding[0]['embedding']) - np.array(student['embedding'])
                )
                if distance < min_distance and distance < 0.6:  # Threshold for face matching
                    min_distance = distance
                    matched_student = student['studentId']

            return matched_student

        except Exception as e:
            logger.error(f"Error processing face {face_idx}: {str(e)}")
            return None
        finally:
            if os.path.exists(face_path):
                try:
                    os.remove(face_path)
                except Exception as e:
                    logger.warning(f"Failed to remove temporary face file: {str(e)}")

    async def recognize_faces(self, image_bytes: bytes) -> List[str]:
        temp_img_path = None
        try:
            # Convert bytes to image
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                raise ValueError("Failed to decode image")

            # Preprocess image
            img = preprocess_image(img)

            # Get student embeddings
            students = await self.get_all_embeddings()
            if not students:
                logger.warning("No student embeddings available for comparison")
                return []

            # Save preprocessed image
            temp_img_path = f"temp_{uuid.uuid4().hex}.jpg"
            cv2.imwrite(temp_img_path, img)

            # Extract faces with retry
            faces = self.extract_faces_with_retry(temp_img_path)
            if not faces:
                logger.warning("No faces detected in image")
                return []

            logger.info(f"Detected {len(faces)} faces in image")

            # Process each face
            recognized_students = []
            face_tasks = []
            
            for idx, face in enumerate(faces):
                result = await self.process_single_face(face, idx, students)
                if result:
                    recognized_students.append(result)

            if not recognized_students:
                logger.warning("No students were recognized in the detected faces")

            return recognized_students

        except Exception as e:
            logger.error(f"Error recognizing faces: {str(e)}")
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            if temp_img_path and os.path.exists(temp_img_path):
                try:
                    os.remove(temp_img_path)
                except Exception as e:
                    logger.warning(f"Failed to remove temporary file: {str(e)}")

face_service = FaceRecognitionService()

@app.post("/encode")
async def encode_face_url(data: ImageURL):
    try:
        image_url = data.image_url
        embedding = await face_service.get_face_embedding_from_url(image_url)
        return {
            "status": "success",
            "embedding": embedding.tolist() if isinstance(embedding, np.ndarray) else embedding
        }
    except Exception as e:
        logger.error(f"Error in encode_face_url: {str(e)}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recognize")
async def recognize_students(data: ImageURL):
    try:
        image_url = data.image_url
        image_array = download_image_as_array(image_url)

        success, buffer = cv2.imencode('.jpg', image_array)
        if not success:
            raise ValueError("Failed to encode image as JPG")
        image_bytes = buffer.tobytes()

        recognized_students = await face_service.recognize_faces(image_bytes)

        return {
            "status": "success",
            "recognized_students": recognized_students,
            "count": len(recognized_students)
        }
    except Exception as e:
        logger.error(f"Error in recognize_students: {str(e)}")
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5003)
