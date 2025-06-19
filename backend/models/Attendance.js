const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  classId: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  students: [{
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    present: {
      type: Boolean,
      default: true
    },
    recognizedAt: {
      type: Date,
      default: Date.now
    }
  }],
  photoUrl: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Attendance', attendanceSchema);
