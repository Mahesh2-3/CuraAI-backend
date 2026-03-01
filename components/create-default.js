const express = require("express");
const router = express.Router();
const { admin, db } = require("../firebase.js");

router.post("/", async (req, res) => {
  try {
    const { userId } = req.body;
    console.log(`[Create-Default] Received POST request userId: ${userId}`);

    const settingsRef = db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences");

    console.log(`[Create-Default] Checking if settings exist...`);
    const doc = await settingsRef.get();

    if (doc.exists) {
      console.log(
        `[Create-Default] Settings already exist for user ${userId}, returning...`,
      );
      res.send({ success: true, status: 200, message: "Already exists" });
      return;
    }

    console.log(`[Create-Default] Initializing default settings...`);
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

    console.log(
      `[Create-Default] Successfully initialized default settings for user ${userId}`,
    );
    res.send({ success: true, status: 200 });
  } catch (error) {
    console.error(`[Create-Default] Error creating default settings:`, error);
    res.send({ success: false, status: 500 });
  }
});

module.exports = router;
