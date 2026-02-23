const express = require("express");
const router = express.Router();

const admin = require("firebase-admin");
const serviceAcc = require("../../serviceAccount.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAcc),
  });
}

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
    console.error("❌ DELETE ERROR:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;
