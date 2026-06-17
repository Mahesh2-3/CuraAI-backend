/**
 * ai-response.js
 * 
 * AI Chat Query Dispatcher.
 * - Handles posting chat prompts to the Python server engine.
 * - Receives responses and records conversational updates back to user databases.
 */

const express = require("express");
const router = express.Router();
const axios = require("axios");

const { admin, db } = require("../firebase.js");
const { getDefaultData } = require("./getdeaultData");
const { ProcessAnalysis } = require("./analysis");

async function processAiResponse(userId, conversationId) {
  try {

    const res = await getDefaultData(userId);

    if (!res?.success) {
      return;
    }

    const basicInfo = res.data?.basicInfo;
    const settings = res.data?.settings;

    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();

    const conversationText = snapshot.docs
      .filter((doc) => doc.data().status !== "loading")
      .map((doc) => {
        const { role, content } = doc.data();
        return `${role}: ${content}`;
      })
      .join("\n");

    const loadingSnap = await db
      .collection("users")
      .doc(userId)
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .where("role", "==", "assistant")
      .where("status", "==", "loading")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();


    if (loadingSnap.empty) {
      return;
    }

    const loadingDocRef = loadingSnap.docs[0].ref;

    const aiResponse = await axios.post(
      `${process.env.PYTHON_URL}/chat`,
      {
        basicInfo,
        aiBehavior: settings.aiBehavior,
        message: conversationText,
      },
      { timeout: 120000 },
    );


    const aiReply = aiResponse.data?.reply;

    if (!aiReply) {
      return;
    }

    await loadingDocRef.update({
      content: aiReply,
      status: "done",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Trigger analysis asynchronously (now awaited for Serverless)
    await ProcessAnalysis(userId, conversationId);
  } catch (error) {
  }
}

router.post("/", async (req, res) => {
  try {
    const { userId, conversationId } = req.body;

    if (!userId || !conversationId) {
      return res.status(400).json({ error: "Missing data" });
    }

    // WAIT for the background processing to finish
    await processAiResponse(userId, conversationId);

    // Only send the response AFTER it finishes so Vercel does not kill the process
    res.json({ success: true, message: "AI response processed successfully" });
  } catch (error) {
    res.status(500).json({ error: "AI processing failed" });
  }
});

module.exports = router;
