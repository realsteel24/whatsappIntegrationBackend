// webhook.js
const express = require("express");
const router = express.Router();
const messages = require("./utils/messageStore");
const db = require("./db");

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
console.log("VERIFY_TOKEN is:", VERIFY_TOKEN);

// Step 1: Verification endpoint
router.get("/", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verified!");
    return res.status(200).send(challenge); // Send back challenge as plain text
  } else {
    return res.sendStatus(403); // Invalid token
  }
});

router.post("/", async (req, res) => {
  try {
    console.log("📩 Webhook Payload:", JSON.stringify(req.body, null, 2));

    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    const msg = change?.value?.messages?.[0];

    if (msg) {
      const from = msg.from;
      const body = msg.text?.body;
      const timestamp = msg.timestamp;

      const contactRes = await db.query(
        `SELECT id FROM contacts WHERE phone = $1`,
        [from]
      );
      const contactId = contactRes.rows?.[0]?.id;

      if (contactId && body && timestamp) {
        await db.query(
          `INSERT INTO messages (contact_id, direction, content, received_at)
           VALUES ($1, 'incoming', $2, to_timestamp($3))`,
          [contactId, body, timestamp]
        );
        console.log("✅ Incoming message saved to DB");
      } else {
        console.warn("❗ Incoming message skipped: missing contact or data");
      }
    }

    const statusUpdate = change?.value?.statuses?.[0];

    if (statusUpdate) {
      const messageId = statusUpdate.id;
      const status = statusUpdate.status;
      const errorTitle = statusUpdate.errors?.[0]?.title;

      let refinedStatus = status;

      if (status === "failed" && errorTitle) {
        switch (errorTitle) {
          case "Message undeliverable":
            refinedStatus = "not_whatsapp_user";
            break;
          case "Meta chose not to deliver":
            refinedStatus = "meta_blocked";
            break;
          case "Rate limit hit":
            refinedStatus = "rate_limited";
            break;
          default:
            refinedStatus = `failed:${errorTitle.toLowerCase().replace(/\s+/g, "_")}`;
        }
      }

      const result = await db.query(
        `UPDATE campaign_contacts
         SET status = $1
         WHERE message_id = $2`,
        [refinedStatus, messageId]
      );

      if (result.rowCount > 0) {
        console.log(`🔄 Status '${refinedStatus}' updated for message ${messageId}`);
      } else {
        console.warn(`❗ No campaign contact found for message_id: ${messageId}`);
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    return res.sendStatus(500);
  }
});

module.exports = router;
