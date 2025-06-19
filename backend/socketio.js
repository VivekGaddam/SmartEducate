const socketio = require('socket.io');
const jwt = require('jsonwebtoken');
const { IntentClassificationService, INTENTS } = require('./services/intentClassificationService');
const TutorService = require('./services/tutorService');

function setupSocketIO(server) {  const io = socketio(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ['websocket', 'polling']
  });
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      // Remove 'Bearer ' prefix if present
      const tokenString = token.startsWith('Bearer ') ? token.slice(7) : token;

      try {
        const decoded = jwt.verify(tokenString, process.env.JWT_SECRET);
        socket.user = decoded;
        next();
      } catch (jwtError) {
        console.error('JWT verification failed:', jwtError);
        next(new Error('Authentication error: Invalid token'));
      }
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: ' + error.message));
    }
  });

  io.on('connection', (socket) => {

    socket.on('chat message', async ({ message }) => {
      try {
        socket.emit('bot typing', true);
        const classification = await IntentClassificationService.classifyIntent(message);

        let response;
        const studentId = socket.user.studentId;
        console.log(`User ${studentId} sent message: ${message}`);
        switch (classification.intent) {
          case INTENTS.GET_PROGRESS:
            const progress = await TutorService.getProgress(studentId);
            response = await TutorService.formatProgress(progress);
            break;
          case INTENTS.GET_RECOMMENDATIONS:
            const rec = await TutorService.generateRecommendations(studentId, classification.subject || 'general');
            response = rec.recommendations;
            break;
          case INTENTS.GET_FEEDBACK:
            const feedback = await TutorService.getTeacherFeedback(studentId);
            response = await TutorService.summarizeFeedback(feedback);
            break;
          default:
            const chatResponse = await TutorService.chat(studentId, message);
            response = chatResponse.answer;
        }

        await TutorService.storeChatInteraction({
          studentId,
          message,
          response,
          intent: classification.intent,
          subject: classification.subject
        });

        socket.emit('bot typing', false);
        socket.emit('chat response', {
          message: response,
          intent: classification.intent,
          timestamp: new Date()
        });
      } catch (err) {
        console.error(err);
        socket.emit('bot typing', false);
        socket.emit('error', { message: 'Error handling your message' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.studentId}`);
    });
  });

  return io;
}

module.exports = setupSocketIO;
