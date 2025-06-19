const axios = require('axios');
const Student = require('../models/Student');
const ChatInteraction = require('../models/ChatInteraction');
const Assignment = require('../models/Assignment');

class ParentService {
  static async chatForParent(studentId, question) {
    try {
      const AI_SERVICE_URL ='http://0.0.0.0:8001';

      console.log('payload for parent chat:', { studentId, question });
      const response = await axios.post(`${AI_SERVICE_URL}/parent-chat`, {
        student_id: studentId,
        question
      });

      return {
        answer: response.data.answer,
        context: response.data.context
      };
    } catch (error) {
      console.error('Error in parent chat:', error);
      // Fallback: Return error response
      return {
        answer: "Sorry, I'm having trouble answering that right now.",
        context: null
      };
    }
  }

  static async formatProgressForParent(progress, studentName) {
    try {
      const AI_SERVICE_URL = 'http://0.0.0.0:8001';

      if (!progress.length) {
        return `${studentName} has no academic history available yet.`;
      }

      const response = await axios.post(`${AI_SERVICE_URL}/parent-chat`, {
        student_id: 'system',
        question: `Format this academic progress data into a friendly, encouraging summary for a parent about their child ${studentName}: ${JSON.stringify(progress, null, 2)}. Include overall progress, strong subjects, areas needing attention, recent improvements, and how the parent can help support their child's learning.`
      });

      return response.data.answer;
    } catch (error) {
      console.error('Error formatting progress for parent:', error);

      if (!progress.length) {
        return `${studentName} has no academic history available yet.`;
      }

      let summary = `📊 Academic Progress Report for ${studentName}\n\n`;

      progress.forEach(subject => {
        const avgScore = subject.topics.length > 0 
          ? subject.topics.reduce((sum, topic) => sum + topic.proficiencyScore, 0) / subject.topics.length
          : 0;

        summary += `📚 ${subject.subject}:\n`;
        summary += `   Overall Performance: ${Math.round(avgScore * 100)}%\n`;

        const strongTopics = subject.topics.filter(t => t.proficiencyScore >= 0.8);
        const improvingTopics = subject.topics.filter(t => t.proficiencyScore >= 0.6 && t.proficiencyScore < 0.8);
        const needsAttention = subject.topics.filter(t => t.proficiencyScore < 0.6);

        if (strongTopics.length > 0) {
          summary += `   ✅ Excelling in: ${strongTopics.map(t => t.name).join(', ')}\n`;
        }
        if (improvingTopics.length > 0) {
          summary += `   📈 Making progress: ${improvingTopics.map(t => t.name).join(', ')}\n`;
        }
        if (needsAttention.length > 0) {
          summary += `   🎯 Needs focus: ${needsAttention.map(t => t.name).join(', ')}\n`;
        }

        summary += '\n';
      });

      summary += `💡 How you can help:\n`;
      summary += `• Review homework together\n`;
      summary += `• Celebrate achievements in strong subjects\n`;
      summary += `• Provide extra support in challenging areas\n`;
      summary += `• Maintain regular study schedules\n`;

      return summary;
    }
  }
  static async getTeacherFeedback(studentId) {
    const student = await Student.findOne({ studentId });
    return student.feedbackHistory || [];
  }
  static async generateRecommendations(studentId, subject) {
    try {
      const AI_SERVICE_URL = 'http://0.0.0.0:8001';
      
      // Use the AI service for generating recommendations
      const response = await axios.post(`${AI_SERVICE_URL}/parent-chat`, {
        student_id: studentId,
        question: `Generate study recommendations for ${subject} based on my performance and learning history.`
      });

      return {
        recommendations: response.data.answer,
        subject: subject
      };
    } catch (error) {
      console.error('Error generating recommendations:', error);
      
      // Fallback logic
      const student = await Student.findOne({ studentId });
      const subjectProgress = student.academicHistory.find(s => s.subject === subject);
      
      if (!subjectProgress) {
        return {
          recommendations: "No data available for this subject yet. Start by taking some practice exercises to build your learning profile.",
          message: "No data available for this subject yet."
        };
      }

      // Get weak topics (proficiency < 0.7)
      const weakTopics = subjectProgress.topics
        .filter(t => t.proficiencyScore < 0.7)
        .sort((a, b) => a.proficiencyScore - b.proficiencyScore);

      let recommendations = `Based on your ${subject} performance, here are some recommendations:\n`;
      
      if (weakTopics.length > 0) {
        recommendations += `Focus on these areas that need improvement:\n`;
        weakTopics.slice(0, 3).forEach(topic => {
          recommendations += `- ${topic.name} (Current level: ${Math.round(topic.proficiencyScore * 100)}%)\n`;
        });
      } else {
        recommendations += `Great job! You're doing well in ${subject}. Keep practicing to maintain your progress.`;
      }

      return {
        weakTopics,
        recommendations,
        learningStyle: student.learningStyle
      };
    }
  }

  static async getProgress(studentId) {
    const student = await Student.findOne({ studentId });
    return student.academicHistory;
  }

  static async summarizeFeedbackForParent(feedback, studentName) {
    try {
      const AI_SERVICE_URL = 'http://0.0.0.0:8001';

      if (!feedback.length) {
        return `No teacher feedback is available yet for ${studentName}.`;
      }

      const response = await axios.post(`${AI_SERVICE_URL}/parent-chat`, {
        student_id: 'system',
        question: `Summarize this teacher feedback for a parent about their child ${studentName}: ${JSON.stringify(feedback, null, 2)}. Include key points from teachers, specific areas for improvement, positive reinforcement, and how the parent can support their child's learning.`
      });

      return response.data.answer;
    } catch (error) {
      console.error('Error summarizing feedback for parent:', error);

      if (!feedback.length) {
        return `No teacher feedback is available yet for ${studentName}.`;
      }

      let summary = `👩‍🏫 Teacher Feedback Summary for ${studentName}\n\n`;

      feedback.slice(0, 3).forEach((fb, index) => {
        summary += `${index + 1}. ${fb.subject || 'General Feedback'}:\n`;
        summary += `   "${fb.comment}"\n`;
        if (fb.suggestions) {
          summary += `   💡 Teacher's suggestion: ${fb.suggestions}\n`;
        }
        if (fb.date) {
          summary += `   📅 Date: ${new Date(fb.date).toLocaleDateString()}\n`;
        }
        summary += '\n';
      });

      summary += `🏠 How you can support at home:\n`;
      summary += `• Discuss daily learning with ${studentName}\n`;
      summary += `• Follow up on teacher suggestions\n`;
      summary += `• Create a positive learning environment\n`;
      summary += `• Communicate regularly with teachers\n`;

      return summary;
    }
  }

  static async getAssignmentScores(studentId) {
    try {
      const student = await Student.findOne({ studentId });
      if (!student) {
        return "Student not found.";
      }

      let assignments = [];
      try {
        assignments = await Assignment.find({ studentId: student._id })
          .sort({ dateSubmitted: -1 })
          .limit(10);
      } catch (assignmentError) {
        console.log('Assignment model not available, using academic history');
      }

      if (assignments.length > 0) {
        let scoresSummary = `📝 Recent Assignment Scores for ${student.userId?.name || 'Student'}:\n\n`;

        assignments.forEach((assignment, index) => {
          scoresSummary += `${index + 1}. ${assignment.title}\n`;
          scoresSummary += `   📊 Score: ${assignment.score}/${assignment.totalPoints} (${Math.round((assignment.score/assignment.totalPoints) * 100)}%)\n`;
          scoresSummary += `   📅 Date: ${new Date(assignment.dateSubmitted).toLocaleDateString()}\n`;
          if (assignment.subject) {
            scoresSummary += `   📚 Subject: ${assignment.subject}\n`;
          }
          scoresSummary += '\n';
        });

        return scoresSummary;
      } else {
        return await this.formatProgressForParent(student.academicHistory, student.userId?.name || 'Student');
      }
    } catch (error) {
      console.error('Error getting assignment scores:', error);
      return "I'm having trouble retrieving the assignment scores right now. Please try again later.";
    }
  }
}

module.exports = ParentService;