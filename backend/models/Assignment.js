const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['mcq', 'written'],
    required: true
  },
  questionText: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    validate: {
      validator: function (val) {
        return this.type !== 'mcq' || (Array.isArray(val) && val.length > 0);
      },
      message: 'MCQ questions must have options'
    },
    default: undefined
  },
  correctAnswer: {
    type: String,
    validate: {
      validator: function (val) {
        return this.type !== 'mcq' || (typeof val === 'string' && val.length > 0);
      },
      message: 'MCQ questions must have a correct answer'
    },
    default: undefined
  }
});

const assignmentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  classLevel: {
    type: String,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isAiGenerated: {
    type: Boolean,
    default: false
  },
  questions: [questionSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Assignment', assignmentSchema);
