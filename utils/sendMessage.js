async function sendMessage({
  to,
  templateName,
  messageText,
  languageCode = "en",
  components, // Now accepting components directly
}) {
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  const token = process.env.WA_ACCESS_TOKEN;

  let body;

  if (templateName) {
    console.log("=== TEMPLATE MESSAGE DEBUG ===");
    console.log("Template:", templateName);
    console.log("Language:", languageCode);
    console.log("To:", to);
    console.log("Components received:", JSON.stringify(components, null, 2));

    // Template message structure
    body = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    };

    // Add components if provided
    if (components && components.length > 0) {
      body.template.components = components;
      console.log("Components added to template");
    } else {
      console.warn("No components provided for template message");
    }

    console.log("Final payload being sent:", JSON.stringify(body, null, 2));
  } else if (messageText) {
    // Plain text message fallback
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

    if (!response.ok) {
      const errorData = await response.json();
      console.error("API Error Details:", errorData);
      return { success: false, error: errorData };
    }

    const data = await response.json();
    console.log("Success response:", data);
    return { success: true, data };
  } catch (error) {
    console.error("Network Error:", error);
    return { success: false, error: { message: error.message } };
  }
}

module.exports = sendMessage;
