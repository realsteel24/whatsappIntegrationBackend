const express = require("express");
const router = express.Router();
const db = require("../db");

function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

router.post("/bulk", async (req, res) => {
  const contacts = req.body;

  if (!Array.isArray(contacts)) {
    return res.status(400).json({ error: "Invalid payload" });
  }

  try {
    const chunks = chunkArray(contacts, 200);

    for (const chunk of chunks) {
      const insertValues = chunk
        .map((c, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
        .join(", ");

      const queryParams = chunk.flatMap((c) => [c.name || null, c.phone]);

      const query = `
        INSERT INTO contacts (name, phone)
        VALUES ${insertValues}
        ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name
      `;

      await db.query(query, queryParams);
    }

    res.json({ success: true, inserted: contacts.length });
  } catch (err) {
    console.error("Error inserting contacts:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;