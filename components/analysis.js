const express = require("express");
const router = express.Router();
const axios = require("axios");

const { admin, db } = require("../firebase.js");
const { getDefaultData } = require("./getdeaultData");

async function ProcessAnalysis(userId, conversationId) {
  const res = await getDefaultData(userId);
  if (!res.success) {
    return;
  }
  const basicInfo = res.data?.basicInfo;
  const settings = res.data?.settings;
  const snapshot1 = await db
    .collection("users")
    .doc(userId)
    .collection("conversations")
    .doc(conversationId)
    .collection("messages")
    .orderBy("createdAt", "asc")
    .get();

  const conversation = snapshot1.docs.map((doc) => {
    const { role, content } = doc.data();
    return `${role} : ${content}`;
  });
  const snapshot2 = await db
    .collection("users")
    .doc(userId)
    .collection("conversations")
    .doc(conversationId)
    .get();

  const fields = snapshot2.data();

  const data = {
    basicInfo,
    aiBehavior: settings.aiBehavior,
    conversation: conversation,
    report: fields.report || "No report Until Now",
    reportUpdatedAt:
      fields.reportUpdatedAt || admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    const response = await axios.post(
      `${process.env.PYTHON_URL}/analysis`,
      data,
      {
        timeout: 120000,
      },
    );
    const aiAnalysis = response.data;
    await db
      .collection("users")
      .doc(userId)
      .collection("conversations")
      .doc(conversationId)
      .set(
        {
          report: aiAnalysis.report,
          reportUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (error) {}
}

router.post("/", async (req, res) => {
  try {
    const { userId, conversationId } = req.body;
    if (!userId || !conversationId) {
      return res.status(400).json({ error: "Missing data" });
    }
    ProcessAnalysis(userId, conversationId);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
module.exports.ProcessAnalysis = ProcessAnalysis;
