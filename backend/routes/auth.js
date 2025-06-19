const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Student = require('../models/Student');
const jwt = require('jsonwebtoken');

router.post('/signup', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      studentId,
      gradeLevel,
      subjects,
      learningStyle,
      interests,
      goals,
      parentPhone
    } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Check if student ID already exists for student role
    if (role === 'student') {
      const existingStudent = await Student.findOne({ studentId });
      if (existingStudent) {
        return res.status(400).json({ message: 'Student ID already exists' });
      }
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      role,
      parentPhone
    });

    await user.save();

    // Create student profile if role is student
    if (role === 'student') {
      const student = new Student({
        userId: user._id,
        studentId,
        gradeLevel,
        subjects,
        learningStyle,
        interests,
        goals: goals.map(goal => ({
          type: 'academic',
          description: goal.description,
          targetDate: goal.targetDate,
          status: 'pending'
        })),
        academicHistory: subjects.map(subject => ({
          subject,
          topics: []
        }))
      });

      await student.save();
    }

    // Generate JWT token
    const tokenPayload = { userId: user._id };

    if (role === 'student') {
      tokenPayload.studentId = studentId; // Include studentId for students
    }

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating user', error: error.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Fetch studentId if the user is a student
    let studentId = null;
    if (user.role === 'student') {
      const student = await Student.findOne({ userId: user._id });
      if (student) {
        studentId = student.studentId;
        console.log('Student ID found:', studentId);
      }
    }

    // Generate JWT token
    const tokenPayload = { userId: user._id };
    if (studentId) {
      tokenPayload.studentId = studentId; // Include studentId for students
    }

    const token = jwt.sign(
      tokenPayload,
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        studentId:studentId,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error logging in', error: error.message });
  }
});

module.exports = router;
