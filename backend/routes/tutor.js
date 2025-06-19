const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const { auth, studentOnly, teacherOnly } = require('../middleware/auth'); // Assuming you have an auth middleware
router.get('/progress', auth,studentOnly ,async (req, res) => {
  try {
    // Example: get studentId from auth middleware or query
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }
    const student = await Student.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    // Return academic history or progress info
    res.json({ academicHistory: student.academicHistory || [] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/tutor/preferences
router.put('/preferences', auth,studentOnly,async (req, res) => {
  try {
    const studentId = req.user.studentId;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId required' });
    }
    const preferences = req.body.preferences;
    if (!preferences) {
      return res.status(400).json({ error: 'preferences required' });
    }
    const student = await Student.findOneAndUpdate(
      { studentId },
      { $set: { preferences } },
      { new: true }
    );
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Preferences updated', preferences: student.preferences });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
