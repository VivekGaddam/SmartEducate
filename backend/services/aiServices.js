const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs').promises;

const AI_CORRECTION_URL = 'http://localhost:5002';
const AI_ASSIGNMENT_URL = 'http://localhost:5001';

exports.correctAnswerImage = async (imageBuffer, questionText, expectedAnswer) => {
  try {
    const formData = new FormData();
    const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'answer.jpg');
    formData.append('request', JSON.stringify({
      question_text: questionText,
      expected_answer: expectedAnswer
    }));

    const response = await axios.post(`${AI_CORRECTION_URL}/evaluate-answer`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return response.data;
  } catch (error) {
    console.error('AI Correction Service Error:', error);
    throw new Error('Failed to evaluate answer with AI service');
  }
};

exports.generateAssignment = async (studentId, classLevel, subject) => {
  try {
    const response = await axios.post(`${AI_ASSIGNMENT_URL}/generate-assignment`, {
      student_id: studentId,
      class_level: classLevel,
      subject: subject
    });

    return response.data;
  } catch (error) {
    console.error('AI Assignment Service Error:', error);
    throw new Error('Failed to generate assignment with AI service');
  }
};

exports.evaluateAssignment = async (imagePath) => {
  try {
    const formData = new FormData();
    const imageBuffer = await fs.readFile(imagePath);
    formData.append('image', imageBuffer, {
      filename: 'assignment.jpg',
      contentType: 'image/jpeg'
    });

    const response = await axios.post(`${AI_CORRECTION_URL}/evaluate-assignment`, formData, {
      headers: {
        ...formData.getHeaders()
      }
    });

    return response.data;
  } catch (error) {
    console.error('AI Evaluation Service Error:', error);
    throw new Error('Failed to evaluate assignment with AI service');
  }
};
