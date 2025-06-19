const express = require('express');
const router = express.Router();
const FormData = require('form-data');
const axios = require('axios');
const { auth, studentOnly, teacherOnly } = require('../middleware/auth');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// 📌 Get all assignments
router.get('/assignments', auth, studentOnly, async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name');
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching assignments', error: error.message });
  }
});

// 📌 Get student's submissions
router.get('/submissions', auth, studentOnly, async (req, res) => {
  try {
    const submissions = await Submission.find({ studentId: req.user._id })
      .populate('assignmentId')
      .sort({ createdAt: -1 });
    res.json(submissions);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching submissions', error: error.message });
  }
});

router.post('/submit/:assignmentId', auth, studentOnly, upload.array('images'), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const parsedAnswers = JSON.parse(req.body.answers);

    const assignment = await Assignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found' });

    if (req.files) {
      let fileIndex = 0;
      for (let i = 0; i < parsedAnswers.length; i++) {
        const answer = parsedAnswers[i];
        const question = assignment.questions[i];

        if (answer.type === 'written' && req.files[fileIndex]) {
          // Upload to Cloudinary
          const b64 = Buffer.from(req.files[fileIndex].buffer).toString('base64');
          const dataURI = "data:" + req.files[fileIndex].mimetype + ";base64," + b64;
          const uploadResponse = await cloudinary.uploader.upload(dataURI, {
            resource_type: 'auto',
            folder: 'assignment_submissions'
          });

          // Store Cloudinary URL
          answer.answerImage = uploadResponse.secure_url;

          // Create form data for AI evaluation
          const formData = new FormData();
          formData.append('image', req.files[fileIndex].buffer, { filename: 'answer.jpg' });
          formData.append('question_text', question.questionText);
          formData.append('expected_answer', question.correctAnswer);

          // Send to AI service for evaluation
          const aiResponse = await axios.post('http://localhost:5002/evaluate-answer', formData, {
            headers: {
              ...formData.getHeaders()
            }
          });

          const aiEvaluation = aiResponse.data;
          answer.aiScore = aiEvaluation.score;
          answer.aiMaxScore = aiEvaluation.maxScore;
          answer.aiFeedback = aiEvaluation.feedback;
          answer.aiExtractedText = aiEvaluation.extracted_text;

          fileIndex++;
        }
      }
    }

    const submission = new Submission({
      assignmentId,
      studentId: req.user._id,
      answers: parsedAnswers
    });

    await submission.save();
    res.status(201).json(submission);
  } catch (error) {
    console.error('Submission error:', error);
    res.status(500).json({ message: 'Error submitting assignment', error: error.message });
  }
});

// 📌 Evaluate full assignment image
router.post('/evaluate-assignment', auth, studentOnly, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image file uploaded' });

    // Upload to Cloudinary first
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    const result = await cloudinary.uploader.upload(dataURI, {
      resource_type: 'auto',
      folder: 'assignment_evaluations'
    });

    // Send Cloudinary URL to AI service
    const aiResponse = await axios.post('http://localhost:5002/evaluate-assignment', {
      image_url: result.secure_url
    });

    res.json(aiResponse.data);
  } catch (error) {
    console.error('Evaluation error:', error);
    res.status(500).json({ message: 'Error evaluating assignment', error: error.message });
  }
});

// 📌 Register student with face photo
router.post('/register', auth, upload.single('photo'), async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    // First, upload to Cloudinary to get the URL
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'student_photos',
      transformation: [
        { quality: "auto:best" },
        { fetch_format: "auto" }
      ]
    });

    // Get face embedding using the Cloudinary URL
    const faceResponse = await axios.post('http://localhost:5003/encode', {
      image_url: result.secure_url
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const embedding = faceResponse.data.embedding;

    const student = new Student({
      userId: req.user._id,
      studentId,
      photoUrl: result.secure_url,
      embedding
    });

    await student.save();
    res.status(201).json(student);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering student', error: error.message });
  }
});

router.post('/attendance', auth, teacherOnly, upload.single('photo'), async (req, res) => {
  try {
    const { classId } = req.body;
    if (!classId) {
      return res.status(400).json({ message: 'Class ID is required' });
    }
    if (!req.file) {
      return res.status(400).json({ message: 'No photo uploaded' });
    }

    // Validate image file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ 
        message: 'Invalid file type. Only JPEG, JPG and PNG are allowed'
      });
    }

    // Upload group photo to Cloudinary
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'attendance_photos',
      transformation: [
        { quality: "auto:best" },
        { fetch_format: "auto" },
        { width: 800 }, // Limit image size for better performance
        { crop: "limit" }
      ]
    });

    // Get recognized students using the Cloudinary URL
    try {
      const recognitionResponse = await axios.post('http://localhost:5003/recognize', {
        image_url: result.secure_url
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 second timeout
      });

      if (!recognitionResponse.data || !Array.isArray(recognitionResponse.data.recognized_students)) {
        throw new Error('Invalid recognition response format');
      }

      const recognizedStudentIds = recognitionResponse.data.recognized_students;
      
      if (recognizedStudentIds.length === 0) {
        return res.status(400).json({ 
          message: 'No students were recognized in the photo. Please ensure students are facing the camera and try again.' 
        });
      }

      // Verify that all recognized students exist in the database
      const students = await Student.find({
        studentId: { $in: recognizedStudentIds }
      });

      if (students.length === 0) {
        return res.status(400).json({ 
          message: 'None of the recognized students are registered in the system' 
        });
      }

      // Create attendance record
      const attendance = new Attendance({
        classId,
        teacher: req.user._id,
        photoUrl: result.secure_url,
        students: students.map(student => ({
          studentId: student._id,
          present: true,
          recognizedAt: new Date()
        }))
      });

      await attendance.save();

      // Return success with recognized student count
      res.status(201).json({
        message: `Successfully marked attendance for ${students.length} students`,
        attendance,
        recognizedCount: students.length
      });

    } catch (recognitionError) {
      // If face recognition fails, delete the uploaded image
      try {
        await cloudinary.uploader.destroy(result.public_id);
      } catch (deleteError) {
        console.error('Error deleting failed upload:', deleteError);
      }

      // Log the error and return appropriate message
      console.error('Face recognition error:', recognitionError);
      
      if (recognitionError.response?.status === 400) {
        return res.status(400).json({ 
          message: recognitionError.response.data.detail || 'Error detecting faces in image'
        });
      }
      
      throw new Error('Face recognition service error: ' + recognitionError.message);
    }
  } catch (error) {
    console.error('Attendance error:', error);
    res.status(500).json({ 
      message: 'Error marking attendance',
      error: error.message
    });
  }
});

// 📌 Get attendance records
router.get('/attendance', auth, teacherOnly, async (req, res) => {
  try {
    const { classId, date } = req.query;
    const query = { teacher: req.user._id };

    if (classId) query.classId = classId;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      query.date = { $gte: start, $lt: end };
    }

    const attendance = await Attendance.find(query)
      .populate('students.studentId', 'studentId')
      .sort('-date');

    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance records', error: error.message });
  }
});

module.exports = router;
