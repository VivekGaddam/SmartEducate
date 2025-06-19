# Setting Up Your WhatsApp Bot Webhook

This guide explains how to set up and verify your WhatsApp webhook with Meta's Platform.

## Prerequisites

1. A Meta for Developers account
2. A WhatsApp Business Account
3. A Facebook App with WhatsApp API configured
4. Your backend server accessible via HTTPS

## Step 1: Configure Environment Variables

Ensure your `.env` file contains the following variables:

```
WHATSAPP_TOKEN=your_whatsapp_token
WHATSAPP_PHONE_ID=your_phone_number_id
WHATSAPP_VERIFY_TOKEN=your_verification_token
```

- `WHATSAPP_TOKEN`: The access token for your WhatsApp Business API
- `WHATSAPP_PHONE_ID`: Your WhatsApp Phone Number ID from the Meta Dashboard
- `WHATSAPP_VERIFY_TOKEN`: A custom string you create for webhook verification

## Step 2: Configure Webhook in Meta Dashboard

1. Go to your app in the Meta for Developers dashboard
2. Navigate to WhatsApp → Configuration
3. In the Webhooks section, click "Configure"
4. Enter your webhook URL: `https://your-domain.com/api/whatsapp/webhook`
5. Enter your verification token (same as `WHATSAPP_VERIFY_TOKEN` in your `.env` file)
6. Select the following webhook fields:
   - messages
   - message_deliveries
   - message_reads
   - message_templates

## Step 3: Verify the Webhook

When you save the webhook configuration, Meta will send a verification request to your webhook URL. Our server will automatically verify this request if:

1. The server is running
2. The route is correctly configured
3. The verification token matches

The verification process works like this:
1. Meta sends a GET request to your webhook URL with the following query parameters:
   - `hub.mode`: "subscribe"
   - `hub.verify_token`: Your verification token
   - `hub.challenge`: A challenge string
2. Your server checks if the mode is "subscribe" and the token matches
3. If they match, your server responds with the challenge string
4. If successful, the webhook will be verified in the Meta dashboard

## Step 4: Testing the Webhook

After verification, you can test the webhook by sending a message to your WhatsApp Business phone number:

1. Use the provided test script:
   ```
   node scripts/send-test-message.js PHONE_NUMBER "Test message"
   ```

2. Or use the Meta API directly:
   ```
   curl -i -X POST \
     https://graph.facebook.com/v22.0/WHATSAPP_PHONE_ID/messages \
     -H 'Authorization: Bearer WHATSAPP_TOKEN' \
     -H 'Content-Type: application/json' \
     -d '{
       "messaging_product": "whatsapp",
       "to": "RECIPIENT_PHONE_NUMBER",
       "type": "text",
       "text": { "body": "Hello, this is a test message!" }
     }'
   ```

## Troubleshooting

1. **Webhook Verification Fails**:
   - Ensure your server is accessible via HTTPS
   - Check that your verification token matches
   - Verify your server is correctly responding to the challenge

2. **Not Receiving Messages**:
   - Check your webhook subscriptions in the Meta dashboard
   - Verify that your server is handling the POST requests correctly
   - Look for errors in your server logs

3. **Messages Not Being Sent**:
   - Verify your WhatsApp token is valid
   - Check for rate limiting or other API restrictions
   - Ensure the recipient's phone number is in the correct format (with country code)
