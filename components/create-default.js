/**
 * create-default.js
 * 
 * User Profile Initializer.
 * - Populates fresh database structures/settings records for newly registered accounts.
 */

const express = require("express");
const router = express.Router();
const { admin, db } = require("../firebase.js");

router.post("/", async (req, res) => {
  try {
    const { userId } = req.body;

    const settingsRef = db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences");

    const doc = await settingsRef.get();

    if (doc.exists) {
      res.send({ success: true, status: 200, message: "Already exists" });
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
  }
});

module.exports = router;
