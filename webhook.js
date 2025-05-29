// webhook.js
const express = require("express");
const router = express.Router();
const messages = require("./utils/messageStore");


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


router.post("/", (req, res) => {
  console.log("📩 Webhook Payload:", JSON.stringify(req.body, null, 2));

  // Optional: do something with the message here (log, save to DB, etc.)

  const entry = req.body.entry?.[0];
  const change = entry?.changes?.[0];
  const msg = change?.value?.messages?.[0];

  if (msg) {
    const from = msg.from;
    const body = msg.text?.body;
    const timestamp = msg.timestamp;

    messages.push({ from, body, timestamp });
  }

  return res.sendStatus(200);
});

module.exports = router;
