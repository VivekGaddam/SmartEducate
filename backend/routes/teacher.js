const express = require('express');
const router = express.Router();
const { auth, teacherOnly } = require('../middleware/auth');
const Assignment = require('../models/Assignment');
const { generateAssignment } = require('../services/aiServices');

// Generate AI assignment
router.post('/assignments/generate', auth, teacherOnly, async (req, res) => {
  try {
    const { studentId, classLevel, subject, topic } = req.body;

    if (!studentId || !classLevel || !subject || !topic) {
      return res.status(400).json({ message: 'Missing required fields: studentId, classLevel, subject, topic' });
    }

    // Call your FastAPI backend to generate assignment questions
    const response = await fetch('http://localhost:5001/generate-assignment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        class_level: classLevel,
        subject,
        topic
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Failed to generate questions');
    }

    const data = await response.json();

    // Create new assignment in your MongoDB
    const assignment = new Assignment({
      title: `${subject} Assignment - ${classLevel} Level`,
      description: `Auto-generated assignment for ${subject} on ${topic}`,
      classLevel,
      questions: data.questions.map(q => ({
        type: q.type,
        questionText: q.questionText,
        options: q.options || [],
        correctAnswer: q.correctAnswer || ''
      })),
      createdBy: req.user._id,
      isAiGenerated: true
    });

    await assignment.save();
    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({
      message: 'Error generating AI assignment',
      error: error.message
    });
  }
});


// Create new assignment
router.post('/assignments', auth, teacherOnly, async (req, res) => {
  try {
    const { title, description, classLevel, questions } = req.body;
    
    const assignment = new Assignment({
      title,
      description,
      classLevel,
      questions,
      createdBy: req.user._id
    });

    await assignment.save();
    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Error creating assignment', error: error.message });
  }
});

// Get all assignments created by teacher
router.get('/assignments', auth, teacherOnly, async (req, res) => {
  try {
    const assignments = await Assignment.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 });
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching assignments', error: error.message });
  }
});

// Generate AI assignment
router.post('/assignments/generate', auth, teacherOnly, async (req, res) => {
  try {
    const { studentId, classLevel, subject } = req.body;
    
    // Generate assignment using AI service
    const aiResponse = await generateAssignment(studentId, classLevel, subject);
    
    // Create new assignment with AI-generated questions
    const assignment = new Assignment({
      title: `${subject.charAt(0).toUpperCase() + subject.slice(1)} Assignment - ${classLevel}`,
      description: `AI-generated ${subject} assignment for ${classLevel} level`,
      classLevel,
      questions: aiResponse.questions.map(q => ({
        type: q.type,
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer
      })),
      createdBy: req.user._id,
      isAiGenerated: true
    });

    await assignment.save();
    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ message: 'Error generating assignment', error: error.message });
  }
});

module.exports = router;
