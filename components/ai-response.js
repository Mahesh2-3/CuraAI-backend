const express = require("express");
const router = express.Router();
const axios = require("axios");

const { admin, db } = require("../firebase.js");
const { getDefaultData } = require("./getdeaultData");
const { ProcessAnalysis } = require("./analysis");

async function processAiResponse(userId, conversationId) {
  try {
    console.log(
      `[AI-Response] Starting processAiResponse for userId: ${userId}, conversationId: ${conversationId}`,
    );

    const res = await getDefaultData(userId);
    console.log(
      `[AI-Response] getDefaultData completed, success=${res?.success}`,
    );

    if (!res?.success) {
      console.warn(
        `[AI-Response] Failed to get default data for userId: ${userId}`,
      );
      return;
    }

    const basicInfo = res.data?.basicInfo;
    const settings = res.data?.settings;

    console.log(
      `[AI-Response] Fetching previous messages from Firestore for user ${userId} and convo ${conversationId}`,
    );
    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();
    console.log(`[AI-Response] Fetched ${snapshot.size} previous messages`);

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

    console.log(`[AI-Response] Loading snap empty? ${loadingSnap.empty}`);

    if (loadingSnap.empty) {
      console.warn(
        `[AI-Response] No loading message found for conversationId: ${conversationId}`,
      );
      return;
    }

    const loadingDocRef = loadingSnap.docs[0].ref;

    console.log(
      `[AI-Response] Sending request to Python AI server at ${process.env.PYTHON_URL}/chat`,
    );
    const aiResponse = await axios.post(
      `${process.env.PYTHON_URL}/chat`,
      {
        basicInfo,
        aiBehavior: settings.aiBehavior,
        message: conversationText,
      },
      { timeout: 120000 },
    );

    console.log(
      `[AI-Response] Received AI reply for conversationId: ${conversationId}, status: ${aiResponse.status}`,
    );

    const aiReply = aiResponse.data?.reply;

    if (!aiReply) {
      console.warn(
        `[AI-Response] No AI reply found in the response for conversationId: ${conversationId}`,
      );
      return;
    }

    console.log(`[AI-Response] Updating Firestore loading doc with AI reply`);
    await loadingDocRef.update({
      content: aiReply,
      status: "done",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Trigger analysis asynchronously
    console.log(
      `[AI-Response] Triggering analysis asynchronously for conversationId: ${conversationId}`,
    );
    ProcessAnalysis(userId, conversationId);
    console.log(
      `[AI-Response] Successfully fully finished processAiResponse for ${conversationId}`,
    );
  } catch (error) {
    console.error(`[AI-Response] Error in processAiResponse:`, error);
  }
}

router.post("/", async (req, res) => {
  try {
    const { userId, conversationId } = req.body;
    console.log(
      `[AI-Response] Received POST request with userId: ${userId}, conversationId: ${conversationId}`,
    );

    if (!userId || !conversationId) {
      console.warn(`[AI-Response] Missing data in POST request`);
      return res.status(400).json({ error: "Missing data" });
    }

    res.send({ started: true });

    processAiResponse(userId, conversationId);
  } catch (error) {
    console.error(`[AI-Response] Error in POST endpoint:`, error);
    res.status(500).json({ error: "AI processing failed" });
  }
});

module.exports = router;
