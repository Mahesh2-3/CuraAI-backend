const express = require("express");
const router = express.Router();
const axios = require("axios");

const { admin, db } = require("../../firebase.js");
const { getDefaultData } = require("../getdeaultData");

async function processAiResponse(userId, diseaseId) {
  try {
    console.log(
      `[Disease-Chat] Starting processAiResponse for userId: ${userId}, diseaseId: ${diseaseId}`,
    );
    const res = await getDefaultData(userId);
    if (!res.success) {
      console.warn(
        `[Disease-Chat] Failed to get default data for user: ${userId}`,
      );
      return;
    }
    const basicInfo = res.data?.basicInfo;
    const settings = res.data?.settings;
    /* =========================
       FETCH DISEASE DOCUMENT
    ========================= */

    const diseaseRef = db
      .collection("users")
      .doc(userId)
      .collection("diseases")
      .doc(diseaseId);

    console.log(`[Disease-Chat] Fetching disease details for ${diseaseId}...`);
    const diseaseSnap = await diseaseRef.get();

    if (!diseaseSnap.exists) {
      console.warn(`[Disease-Chat] Disease doc not found for ${diseaseId}`);
      return;
    }

    const diseaseData = diseaseSnap.data();

    /* =========================
       FETCH CHAT
    ========================= */

    const chatSnap = await diseaseRef
      .collection("chat")
      .orderBy("createdAt", "asc")
      .get();

    const conversationText = chatSnap.docs
      .filter((doc) => doc.data().status !== "loading")
      .map((doc) => {
        const { role, content } = doc.data();
        return `${role}: ${content}`;
      })
      .join("\n");

    const loadingSnap = await diseaseRef
      .collection("chat")
      .where("role", "==", "assistant")
      .where("status", "==", "loading")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    console.log(`[Disease-Chat] Loading message found? ${!loadingSnap.empty}`);
    if (loadingSnap.empty) {
      console.warn(
        `[Disease-Chat] No loading message found for diseaseId: ${diseaseId}`,
      );
      return;
    }

    const loadingDocRef = loadingSnap.docs[0].ref;

    /* =========================
       CALL AI SERVICE
    ========================= */

    const payload = {
      basicInfo,
      aiBehavior: settings.aiBehavior,
      disease: {
        diseaseName: diseaseData.diseaseName,
        details: diseaseData.details,
        recommendations: diseaseData.recommendations || [],
        analysis: diseaseData.analysis || [],
        history: diseaseData.history || [],
      },
      conversation: conversationText,
    };

    console.log(`[Disease-Chat] Requesting AI response from Python server...`);
    const aiResponse = await axios.post(
      `${process.env.PYTHON_URL}/disease/disease_analysis`,
      payload,
      { timeout: 120000 },
    );

    console.log(
      `[Disease-Chat] Received AI response, status: ${aiResponse.status}`,
    );
    const { reply, analysis, threatUpdate } = aiResponse.data;

    /* =========================
       UPDATE CHAT MESSAGE
    ========================= */

    await loadingDocRef.update({
      content: reply || "No response generated.",
      status: "done",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    /* =========================
       UPDATE ANALYSIS
    ========================= */
    if (Array.isArray(analysis) && analysis.length > 0) {
      await diseaseRef.update({
        analysis: admin.firestore.FieldValue.arrayUnion(...analysis),
      });
    }

    /* =========================
       UPDATE THREAT HISTORY
    ========================= */
    if (threatUpdate?.percentage) {
      await diseaseRef.update({
        history: admin.firestore.FieldValue.arrayUnion({
          date: new Date().toISOString().split("T")[0],
          threatPercentage: threatUpdate.percentage,
        }),
      });
    }
    console.log(
      `[Disease-Chat] Successfully finished processAiResponse for ${diseaseId}`,
    );
  } catch (error) {
    console.error(`[Disease-Chat] Error in processAiResponse:`, error);
    if (error.response) {
      console.error(
        `[Disease-Chat] Error response from Python server:`,
        error.response.data,
      );
    }
  }
}

router.post("/", async (req, res) => {
  try {
    const { userId, diseaseId } = req.body;
    console.log(
      `[Disease-Chat] Received POST request with userId: ${userId}, diseaseId: ${diseaseId}`,
    );

    if (!userId || !diseaseId) {
      console.warn(`[Disease-Chat] Missing data in POST request`);
      return res.status(400).json({ error: "Missing data" });
    }

    res.json({ started: true });

    processAiResponse(userId, diseaseId);
  } catch (error) {
    console.error(`[Disease-Chat] Error in POST endpoint:`, error);
    res.status(500).json({ error: "AI processing failed" });
  }
});

module.exports = router;
