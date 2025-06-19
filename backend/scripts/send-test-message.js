const axios = require('axios');
require('dotenv').config();

// WhatsApp credentials from .env
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID;

// Function to send a WhatsApp message
async function sendWhatsAppMessage(to, message) {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v22.0/${WHATSAPP_PHONE_ID}/messages`,
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

// Usage: node send-test-message.js PHONE_NUMBER "Your message"
const phoneNumber = process.argv[2];
const message = process.argv[3];

if (!phoneNumber || !message) {
  console.error('Usage: node send-test-message.js PHONE_NUMBER "Your message"');
  process.exit(1);
}

console.log(`Sending message to ${phoneNumber}: "${message}"`);
sendWhatsAppMessage(phoneNumber, message)
  .then(() => console.log('Message sent successfully!'))
  .catch(error => console.error('Failed to send message:', error));
