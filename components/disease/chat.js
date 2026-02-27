const express = require("express");
const router = express.Router();
const axios = require("axios");

const { admin, db } = require("../../firebase.js");
const { getDefaultData } = require("../getdeaultData");

async function processAiResponse(userId, diseaseId) {
  try {
    const res = await getDefaultData(userId);
    if (!res.success) {
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

    const diseaseSnap = await diseaseRef.get();

    if (!diseaseSnap.exists) {
      console.error("❌ Disease document NOT FOUND");
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

    if (loadingSnap.empty) {
      console.warn("⚠ No loading assistant message found");
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

    const aiResponse = await axios.post(
      `${process.env.PYTHON_URL}/disease/disease_analysis`,
      payload,
      { timeout: 120000 },
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
  } catch (error) {
    console.error("🔥 AI PROCESS FAILED");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);

    if (error.response) {
      console.error("AI RESPONSE STATUS:", error.response.status);
      console.error("AI RESPONSE DATA:", error.response.data);
    }
  }
}

router.post("/", async (req, res) => {
  try {
    const { userId, diseaseId } = req.body;

    if (!userId || !diseaseId) {
      return res.status(400).json({ error: "Missing data" });
    }

    res.json({ started: true });

    processAiResponse(userId, diseaseId);
  } catch (error) {
    console.error("AI ERROR:", error.message);
    res.status(500).json({ error: "AI processing failed" });
  }
});

module.exports = router;
