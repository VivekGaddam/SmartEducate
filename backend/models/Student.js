const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  proficiencyScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  lastReviewed: {
    type: Date,
    default: Date.now
  }
});

const subjectProgressSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true
  },
  topics: [topicSchema]
});

const feedbackSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: String,
  topic: String,
  feedback: String,
  date: {
    type: Date,
    default: Date.now
  }
});

const studentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  studentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  photoUrl: {
    type: String,
    default: 'default-avatar.png',
    validate: {
      validator: function(v) {
        return !v || v === 'default-avatar.png' || v.startsWith('http') || v.startsWith('data:image/');
      },
      message: props => `${props.value} is not a valid photo URL!`
    }
  },
  embedding: {
    type: [Number],
    required: false, // Make embedding optional
    validate: {
      validator: function(v) {
        return !v || (Array.isArray(v) && v.length === 512); // Optional, but if present must be 512-dimensional
      },
      message: props => `${props.value} is not a valid embedding vector!`
    }
  },
  // SmartTutor fields
  gradeLevel: {
    type: String,
    required: true
  },
  subjects: [String],
  academicHistory: [subjectProgressSchema],
  learningStyle: {
    type: String,
    enum: ['visual', 'auditory', 'reading', 'kinesthetic'],
    default: 'visual'
  },
  feedbackHistory: [feedbackSchema],
  goals: [{
    type: String,
    description: String,
    targetDate: Date,
    status: {
      type: String,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending'
    }
  }],
  interests: [String]
}, {
  timestamps: true
});

module.exports = mongoose.model('Student', studentSchema);
