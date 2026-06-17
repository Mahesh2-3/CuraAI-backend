/**
 * delete-convo.js
 * 
 * Single Chat Record Purger.
 * - Removes specific conversation document and all associated messages logs.
 */

const express = require("express");
const router = express.Router();

const { admin, db } = require("../../firebase.js");

router.post("/", async (req, res) => {
  const { userId, conversationId } = req.body;

  try {
    const db = admin.firestore();

    const messagesRef = db
      .collection("users")
      .doc(userId)
      .collection("conversations")
      .doc(conversationId)
      .collection("messages");

    const snapshot = await messagesRef.get();

    const batch = db.batch();


    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    const conversationRef = db.doc(
      `users/${userId}/conversations/${conversationId}`,
    );

    batch.delete(conversationRef);

    await batch.commit();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;
