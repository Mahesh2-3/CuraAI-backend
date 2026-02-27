const express = require("express");
const router = express.Router();
const { admin, db } = require("../firebase.js");

router.post("/", async (req, res) => {
  try {
    const { userId } = req.body;
    console.log("🟢 Creating default settings for:", userId);

    const settingsRef = db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences");
    const doc = await settingsRef.get();

    if (doc.exists) {
      console.log("⚠️ Settings already exist, skipping:", userId);
      return;
    }

    await settingsRef.set(
      {
        summary: {
          mode: "chat_and_diseases",
        },

        aiBehavior: {
          responseStyle: "detailed_and_explanatory",
          medicalStrictness: "conservative",
          followUpQuestions: "ask_more",
          language: "en",
        },

        notifications: {
          criticalHealthAlerts: true,
          medicationReminders: true,
          weeklyHealthSummary: true,
          healthTips: false,
        },

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    res.send({ success: true, status: 200 });
  } catch (error) {
    res.send({ success: false, status: 500 });
    console.error("❌ Failed to create default settings:", error);
  }
});

module.exports = router;
