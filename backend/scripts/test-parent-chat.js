const axios = require('axios');
require('dotenv').config();

async function testParentChat() {
  try {
    const AI_SERVICE_URL = 'http://0.0.0.0:8001'; // Update with your AI service URL
    const studentId = process.argv[2]; // Take student ID from command line
    const question = process.argv[3] || "How is my child doing in school?"; // Default question or from command line
    
    console.log(`Testing parent-chat endpoint with studentId=${studentId} and question="${question}"`);
    
    // Test the parent-chat endpoint
    const response = await axios.post(`${AI_SERVICE_URL}/parent-chat`, {
      student_id: studentId,
      question
    });
    
    console.log('Response from parent-chat endpoint:');
    console.log('Answer:', response.data.answer);
    console.log('Intent:', response.data.intent);
    console.log('Context Used:', response.data.context_used);
    
    // Optionally, test the regular chat endpoint for comparison
    if (process.argv[4] === '--compare') {
      console.log('\nComparing with regular chat endpoint:');
      const regularResponse = await axios.post(`${AI_SERVICE_URL}/chat`, {
        student_id: studentId,
        question
      });
      
      console.log('Regular Chat Answer:', regularResponse.data.answer);
    }
    
  } catch (error) {
    console.error('Error testing parent-chat endpoint:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

if (!process.argv[2]) {
  console.log('Usage: node test-parent-chat.js <studentId> [question] [--compare]');
  console.log('Example: node test-parent-chat.js 12345 "How is my child doing in math?"');
  process.exit(1);
}

testParentChat();
