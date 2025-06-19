const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const User = require('../models/User');
const ParentService = require('../services/parentService');
const { IntentClassificationService, INTENTS } = require('../services/intentClassificationService');
const ChatInteraction = require('../models/ChatInteraction');
const axios = require('axios');
require('dotenv').config();

// WhatsApp API credentials
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// Enhanced intent patterns for assignment scores
const ASSIGNMENT_KEYWORDS = [
  'assignment score', 'assignment scores', 'test score', 'test scores',
  'exam score', 'exam scores', 'quiz score', 'quiz scores',
  'homework score', 'homework scores', 'grades', 'marks',
  'results', 'performance', 'how did', 'how is doing'
];

function detectAssignmentScoreIntent(message) {
  const messageLower = message.toLowerCase();
  return ASSIGNMENT_KEYWORDS.some(keyword => messageLower.includes(keyword));
}

// Webhook verification
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(404);
  }
});

// Webhook to receive messages
router.post('/webhook', async (req, res) => {
  try {
    res.status(200).send('EVENT_RECEIVED');
    const body = req.body;

    if (
      body.object &&
      body.entry &&
      body.entry[0].changes &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
      const from = body.entry[0].changes[0].value.messages[0].from;
      const messageText = body.entry[0].changes[0].value.messages[0].text?.body;

      if (!messageText) {
        console.log('Received non-text message');
        return;
      }

      console.log(`Received message from ${from}: ${messageText}`);

      // 🔧 Strip country code
      const plainPhone = from.startsWith('91') ? from.slice(2) : from;

      // 🔍 Find parent
      const parent = await User.findOne({ parentPhone: plainPhone });
      if (!parent) {
        await sendWhatsAppMessage(phoneNumberId, from,
          "I couldn't find a registered student associated with this phone number. Please make sure you've registered this number in our system."
        );
        return;
      }

      // 👨‍🎓 Get students linked to this parent
      const students = await Student.find({
        $or: [{ userId: parent._id }, { parentId: parent._id }]
      }).populate('userId');

      if (students.length === 0) {
        await sendWhatsAppMessage(phoneNumberId, from,
          "I found your account, but couldn't locate any student profiles. Please contact the school for assistance."
        );
        return;
      }

      // 🤖 Handle multiple students
      let targetStudent = students.length === 1 ? students[0] : null;

      if (!targetStudent && students.length > 1) {
        const messageLC = messageText.toLowerCase();
        targetStudent = students.find(s =>
          messageLC.includes(s.userId.name.toLowerCase())
        );

        if (!targetStudent) {
          const studentNames = students.map(s => s.userId.name).join(", ");
          await sendWhatsAppMessage(phoneNumberId, from,
            `You have multiple students in our system (${studentNames}). Please include your student's name in your message.`
          );
          return;
        }
      }

      // ✨ Enhanced intent classification & response generation
      const student = targetStudent;
      const studentName = student.userId.name;
      let response;
      let intent;
      let subject;

      // Check for assignment score specific intent
      if (detectAssignmentScoreIntent(messageText)) {
        intent = 'GET_ASSIGNMENT_SCORES';
        response = await ParentService.getAssignmentScores(student.studentId);
      } else {
        // Use existing intent classification
        const classification = await IntentClassificationService.classifyIntent(messageText);
        intent = classification.intent;
        subject = classification.subject;
        console.log(`Classified intent: ${intent}, subject: ${subject}`);

        switch (classification.intent) {
          case INTENTS.GET_PROGRESS:
            const progress = await ParentService.getProgress(student.studentId);
            response = await ParentService.formatProgressForParent(progress, studentName);
            break;

          case INTENTS.GET_RECOMMENDATIONS:
            const rec = await ParentService.generateRecommendations(student.studentId, classification.subject || 'general');
            response = `Recommendations for ${studentName}: ${rec.recommendations}`;
            break;

          case INTENTS.GET_FEEDBACK:
            const feedback = await ParentService.getTeacherFeedback(student.studentId);
            response = await ParentService.summarizeFeedbackForParent(feedback, studentName);
            break;

          default:
            const chatResponse = await ParentService.chatForParent(student.studentId, messageText);
            response = chatResponse.answer;
        }
      }


      // 📤 Send reply
      await sendWhatsAppMessage(phoneNumberId, from, response);
    }
  } catch (error) {
    console.error('Error processing WhatsApp webhook:', error);
    
    // Send error message to user if possible
    try {
      const phoneNumberId = req.body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
      const from = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from;
      
      if (phoneNumberId && from) {
        await sendWhatsAppMessage(phoneNumberId, from,
          "I'm experiencing some technical difficulties right now. Please try again in a few minutes, or contact the school if the issue persists."
        );
      }
    } catch (sendError) {
      console.error('Error sending error message:', sendError);
    }
  }
});

// Send WhatsApp message
async function sendWhatsAppMessage(phoneNumberId, to, message) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );
    console.log('Message sent successfully:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

// 🔧 Optional: test endpoint
router.post('/send-test', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;
    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }

    const result = await sendWhatsAppMessage(WHATSAPP_PHONE_ID, phoneNumber, message);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;