require("dotenv").config();
const express = require("express");
const cors = require("cors");
const sendMessage = require("./utils/sendMessage");
const webhook = require("./webhook");
const messages = require("./utils/messageStore");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use("/webhook", webhook);

// Updated bulk send endpoint
app.post("/api/send-messages-bulk", async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing or invalid messages array" });
  }

  console.log(`Processing ${messages.length} messages...`);
  console.log("First message structure:", JSON.stringify(messages[0], null, 2));

  const results = await Promise.all(
    messages.map(async (msg, index) => {
      try {
        console.log(`\n--- Processing message ${index + 1} ---`);
        console.log("Message data:", JSON.stringify(msg, null, 2));

        // Pass all parameters to sendMessage
        const result = await sendMessage({
          to: msg.to,
          templateName: msg.templateName,
          messageText: msg.messageText,
          languageCode: msg.languageCode || "en",
          components: msg.components,
        });

        console.log(
          `Message ${index + 1} result:`,
          result.success ? "SUCCESS" : "FAILED"
        );
        if (!result.success) {
          console.log(`Message ${index + 1} error:`, result.error);
        }

        return result;
      } catch (error) {
        console.error(`Error sending to ${msg.to}:`, error);
        return { success: false, error: error.message };
      }
    })
  );

  const successCount = results.filter((r) => r.success).length;
  const errors = results.filter((r) => !r.success);

  res.json({
    success: true,
    sent: successCount,
    failed: errors.length,
    errors: errors.map((e) => e.error),
    total: messages.length,
  });
});

// Keep original endpoint for backward compatibility
app.post("/api/send-messages", async (req, res) => {
  const { templateName, messages } = req.body;

  if (!messages || !templateName) {
    return res.status(400).json({ error: "Missing messages or templateName" });
  }

  const results = await Promise.all(
    messages.map(({ to, params, components }) =>
      sendMessage({
        to,
        templateName,
        languageCode: "en",
        params,
        components,
      })
    )
  );

  const successCount = results.filter((r) => r.success).length;
  const errors = results.filter((r) => !r.success).map((r) => r.error);

  res.json({
    success: true,
    sent: successCount,
    failed: errors.length,
    errors,
  });
});

app.get("/api/messages", (req, res) => {
  res.json(messages);
});

app.post("/api/reply", async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Missing 'to' or 'message'" });
  }

  const result = await sendMessage({ to, messageText: message });

  if (result.success) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: result.error });
  }
});

app.get("/api/templates", async (req, res) => {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WA_WABA_ID}/message_templates`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Filter only approved templates
    const approvedTemplates =
      data.data?.filter((tpl) => tpl.status === "APPROVED") || [];

    console.log(`Found ${approvedTemplates.length} approved templates`);
    res.json(approvedTemplates);
  } catch (err) {
    console.error("Template fetch error:", err);
    res
      .status(500)
      .json({ error: "Failed to fetch templates", details: err.message });
  }
});

// Debug specific template structure
app.get("/api/template/:templateName", async (req, res) => {
  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WA_WABA_ID}/message_templates?name=${req.params.templateName}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`,
        },
      }
    );

    const data = await response.json();
    const template = data.data?.[0];

    if (template) {
      // Show template structure for debugging
      res.json({
        name: template.name,
        status: template.status,
        language: template.language,
        components: template.components,
        // Show what parameters each component expects
        expectedParams: template.components?.map((comp) => ({
          type: comp.type,
          format: comp.format,
          expectedParams: comp.text
            ? (comp.text.match(/\{\{\d+\}\}/g) || []).length
            : 0,
          text: comp.text,
        })),
      });
    } else {
      res.status(404).json({ error: "Template not found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      hasWabaId: !!process.env.WA_WABA_ID,
      hasAccessToken: !!process.env.WA_ACCESS_TOKEN,
      hasPhoneNumberId: !!process.env.WA_PHONE_NUMBER_ID,
      hasVerifyToken: !!process.env.VERIFY_TOKEN,
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📱 WhatsApp WABA ID: ${process.env.WA_WABA_ID || "NOT SET"}`);
  console.log(
    `📞 Phone Number ID: ${process.env.WA_PHONE_NUMBER_ID || "NOT SET"}`
  );
});
