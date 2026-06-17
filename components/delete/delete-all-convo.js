/**
 * delete-all-convo.js
 * 
 * Bulk conversation remover.
 * - Purges all chat records under the specified user's Firestore workspace.
 */

const express = require("express");
const router = express.Router();

const { admin, db } = require("../../firebase.js");

router.post("/", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const firestore = admin.firestore();

    const ref = firestore
      .collection("users")
      .doc(userId)
      .collection("conversations");

    await firestore.recursiveDelete(ref);

    res.json({
      success: true,
      message: "All conversations deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ error: "Delete all failed" });
  }
});

module.exports = router;
