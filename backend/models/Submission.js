const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  assignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assignment',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: [{
    questionId: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['mcq', 'written'],
      required: true
    },    answerText: String,
    answerImage: String,
    aiScore: Number,
    aiMaxScore: Number,
    aiFeedback: String,
    aiExtractedText: String,
    teacherOverride: {
      score: Number,
      feedback: String,
      updatedAt: Date
    }
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Submission', submissionSchema);
