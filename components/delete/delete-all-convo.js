const express = require("express");
const router = express.Router();

const { admin, db } = require("../../firebase.js");

router.post("/", async (req, res) => {
  const { userId } = req.body;
  console.log(`[Delete-All-Convo] Received POST request userId: ${userId}`);

  if (!userId) {
    console.warn(`[Delete-All-Convo] Missing userId in request`);
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const firestore = admin.firestore();

    const ref = firestore
      .collection("users")
      .doc(userId)
      .collection("conversations");

    console.log(
      `[Delete-All-Convo] Triggering recursive delete for all conversations of user ${userId}...`,
    );
    await firestore.recursiveDelete(ref);

    console.log(
      `[Delete-All-Convo] Successfully deleted all conversations for user ${userId}`,
    );
    res.json({
      success: true,
      message: "All conversations deleted successfully",
    });
  } catch (err) {
    console.error(`[Delete-All-Convo] Error deleting all conversations:`, err);
    res.status(500).json({ error: "Delete all failed" });
  }
});

module.exports = router;
