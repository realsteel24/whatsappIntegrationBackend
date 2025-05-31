const db = require("../db"); // Ensure you import your database module

async function sendMessage({
  to,
  templateName,
  messageText,
  languageCode = "en",
  components,
  campaignId,
  contactId,
}) {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const token = process.env.WA_ACCESS_TOKEN;

  let body;

  if (templateName) {
    body = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    if (components && components.length > 0) {
      body.template.components = components;
    }
  } else if (messageText) {
    body = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: messageText,
      },
    };
  } else {
    return { success: false, error: "No message content provided" };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("API Error Details:", data);

      if (campaignId && contactId) {
        await db.query(
          `UPDATE campaign_contacts
           SET status = 'failed'
           WHERE contact_id = $1 AND campaign_id = $2`,
          [contactId, campaignId]
        );
      }

      return { success: false, error: data };
    }

    const messageId = data.messages?.[0]?.id;

    if (!messageId) {
      console.warn("No message ID returned from API");
    }

    if (messageId && campaignId && contactId) {
      await db.query(
        `UPDATE campaign_contacts
         SET status = 'sent', message_id = $1, sent_at = CURRENT_TIMESTAMP
         WHERE contact_id = $2 AND campaign_id = $3`,
        [messageId, contactId, campaignId]
      );
    }

    return { success: true, data };
  } catch (error) {
    console.error("Network Error:", error);
    return { success: false, error: { message: error.message } };
  }
}

module.exports = sendMessage;
