const express = require("express");
const router = express.Router();

const { admin, db } = require("../../firebase.js");

router.post("/", async (req, res) => {
  const { userId, conversationId } = req.body;
  console.log(
    `[Delete-Convo] Received POST request userId: ${userId}, conversationId: ${conversationId}`,
  );

  try {
    const db = admin.firestore();

    const messagesRef = db
      .collection("users")
      .doc(userId)
      .collection("conversations")
      .doc(conversationId)
      .collection("messages");

    console.log(`[Delete-Convo] Fetching messages for ${conversationId}...`);
    const snapshot = await messagesRef.get();

    const batch = db.batch();

    console.log(
      `[Delete-Convo] Batch deleting ${snapshot.docs.length} messages and conversation doc...`,
    );

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    const conversationRef = db.doc(
      `users/${userId}/conversations/${conversationId}`,
    );

    batch.delete(conversationRef);

    await batch.commit();

    console.log(
      `[Delete-Convo] Successfully deleted conversation ${conversationId}`,
    );
    res.json({ success: true });
  } catch (err) {
    console.error(`[Delete-Convo] Error deleting conversation:`, err);
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;
