const mongoose = require('mongoose');

const chatInteractionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['chat', 'whatsapp'],
    default: 'chat'
  },
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  subject: String,
  topic: String,
  context: {
    retrievedDocuments: [{
      type: String,
      source: String
    }],
    studentData: mongoose.Schema.Types.Mixed
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1
  },
  feedback: {
    helpful: {
      type: Boolean,
      default: null
    },
    comments: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
chatInteractionSchema.index({ studentId: 1, timestamp: -1 });
chatInteractionSchema.index({ subject: 1, topic: 1 });

module.exports = mongoose.model('ChatInteraction', chatInteractionSchema);
