


const express = require("express");
const router = express.Router();
const db = require("../db");

router.post("/", async (req, res) => {
  const { name, contacts } = req.body;

  if (!name || !Array.isArray(contacts)) {
    return res.status(400).json({ error: "Missing campaign name or contacts list" });
  }

  try {
    // Step 1: Create the campaign
    const campaignResult = await db.query(
      `INSERT INTO campaigns (campaign_name) VALUES ($1) RETURNING id`,
      [name]
    );
    const campaignId = campaignResult.rows[0].id;

    // Step 2: Upsert contacts and get their IDs
    const contactIdMap = new Map();
    for (const contact of contacts) {
      const result = await db.query(
        `INSERT INTO contacts (name, phone)
         VALUES ($1, $2)
         ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [contact.name || null, contact.phone]
      );
      contactIdMap.set(contact.phone, result.rows[0].id);
    }

    // Step 3: Link contacts to campaign
    const contactIds = Array.from(contactIdMap.values());
    const values = contactIds.map((_, i) => `($1, $${i + 2}, CURRENT_TIMESTAMP)`).join(", ");
    const params = [campaignId, ...contactIds];

    if (contactIds.length > 0) {
      await db.query(
        `INSERT INTO campaign_contacts (campaign_id, contact_id, created_at)
         VALUES ${values}`,
        params
      );
    }

    res.json({ success: true, campaignId, contacts: contactswithIds });
  } catch (error) {
    console.error("Error creating campaign:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;