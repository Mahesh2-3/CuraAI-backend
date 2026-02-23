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
    console.error("📛 Full error:", err);

    res.status(500).json({ error: "Delete all failed" });
  }
});

module.exports = router;
