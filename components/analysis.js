const express = require("express");
const router = express.Router();
const axios = require("axios");

const { admin, db } = require("../firebase.js");
const { getDefaultData } = require("./getdeaultData");

async function ProcessAnalysis(userId, conversationId) {
  console.log(
    `[Analysis] Starting ProcessAnalysis for userId: ${userId}, conversationId: ${conversationId}`,
  );
  const res = await getDefaultData(userId);
  if (!res.success) {
    console.warn(`[Analysis] Failed to get default data for userId: ${userId}`);
    return;
  }
  const basicInfo = res.data?.basicInfo;
  const settings = res.data?.settings;
  console.log(
    `[Analysis] Fetching previous messages and reports for user ${userId}, convo ${conversationId}`,
  );
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
    console.log(
      `[Analysis] Requesting AI analysis from ${process.env.PYTHON_URL}/analysis...`,
    );
    const response = await axios.post(
      `${process.env.PYTHON_URL}/analysis`,
      data,
      {
        timeout: 120000,
      },
    );
    console.log(
      `[Analysis] Received response from AI server, status: ${response.status}`,
    );
    const aiAnalysis = response.data;
    console.log(`[Analysis] Updating firestore with analysis report`);
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
    console.log(
      `[Analysis] Successfully finished ProcessAnalysis for ${conversationId}`,
    );
  } catch (error) {
    console.error(`[Analysis] Error in ProcessAnalysis:`, error);
  }
}

router.post("/", async (req, res) => {
  try {
    const { userId, conversationId } = req.body;
    console.log(
      `[Analysis] Received POST request with userId: ${userId}, conversationId: ${conversationId}`,
    );
    if (!userId || !conversationId) {
      console.warn(`[Analysis] Missing data in POST request`);
      return res.status(400).json({ error: "Missing data" });
    }
    // Wait for analysis to finish so Vercel doesn't kill the function
    await ProcessAnalysis(userId, conversationId);

    res.json({ success: true, message: "Analysis completed" });
  } catch (error) {
    console.error(`[Analysis] Error in POST endpoint:`, error);
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
module.exports.ProcessAnalysis = ProcessAnalysis;
