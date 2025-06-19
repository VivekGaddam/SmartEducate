# WhatsApp Bot Integration

This system includes a WhatsApp bot that allows parents to interact with the AI tutor system to get information about their children's academic progress, receive recommendations, and more.

## Setup Instructions

1. **Register for WhatsApp Business API**:
   - Create a Meta for Developers account at https://developers.facebook.com/
   - Set up a WhatsApp Business account
   - Create an app in the Meta for Developers dashboard
   - Configure the WhatsApp API in your app

2. **Configure Environment Variables**:
   - Update the `.env` file with your WhatsApp credentials:
     ```
     WHATSAPP_TOKEN=your_whatsapp_token
     WHATSAPP_PHONE_ID=your_phone_number_id
     WHATSAPP_VERIFY_TOKEN=your_verification_token
     ```

3. **Deploy the Webhook**:
   - Make sure your server is accessible via HTTPS (required by Meta)
   - Configure the webhook URL in the Meta for Developers dashboard:
     ```
     https://your-domain.com/api/whatsapp/webhook
     ```
   - Use the same verification token specified in your `.env` file

## Testing the Integration

1. **Send a Test Message**:
   - Use the provided script to send a test message:
     ```
     node scripts/send-test-message.js PHONE_NUMBER "Your test message"
     ```
   - Make sure to replace `PHONE_NUMBER` with the actual phone number (including country code)

2. **Manual Testing via API Request**:
   ```
   curl -i -X POST \
     https://graph.facebook.com/v22.0/WHATSAPP_PHONE_ID/messages \
     -H 'Authorization: Bearer WHATSAPP_TOKEN' \
     -H 'Content-Type: application/json' \
     -d '{
       "messaging_product": "whatsapp",
       "to": "RECIPIENT_PHONE_NUMBER",
       "type": "template",
       "template": {
         "name": "hello_world",
         "language": {
           "code": "en_US"
         }
       }
     }'
   ```

## Features

The WhatsApp bot provides the following functionality for parents:

1. **Academic Progress**: Parents can ask about their child's academic progress
2. **Teacher Feedback**: Parents can request summaries of teacher feedback
3. **Study Recommendations**: Parents can get personalized study recommendations for their child
4. **General Questions**: Parents can ask general questions about their child's education

## Multiple Children Support

If a parent has multiple children registered in the system, they need to specify which child they're asking about in their message. If no child is specified, the system will ask for clarification.

## Sample Queries

- "How is John doing in math?"
- "What did the teacher say about Maria's last assignment?"
- "Can you recommend study tips for David?"
- "What subjects is Lisa struggling with?"
