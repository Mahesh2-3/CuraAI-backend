const express = require("express");
const router = express.Router();
const axios = require("axios");

const admin = require("firebase-admin");
const serviceAcc = require("../../serviceAccount.json");
const { getDefaultData } = require("../getdeaultData");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAcc),
  });
}

const db = admin.firestore();

async function processAiResponse(userId, diseaseId) {
  console.log("🧠 AI PROCESS STARTED");
  console.log("➡ userId:", userId);
  console.log("➡ diseaseId:", diseaseId);

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
    console.log("📄 Fetching disease document...");

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
    console.log("✅ Disease fetched:", {
      diseaseName: diseaseData.diseaseName,
      hasAnalysis: !!diseaseData.analysis,
      hasHistory: !!diseaseData.history,
    });

    /* =========================
       FETCH CHAT
    ========================= */
    console.log("💬 Fetching chat messages...");

    const chatSnap = await diseaseRef
      .collection("chat")
      .orderBy("createdAt", "asc")
      .get();

    console.log(`💬 Chat messages found: ${chatSnap.size}`);

    const conversationText = chatSnap.docs
      .filter((doc) => doc.data().status !== "loading")
      .map((doc) => {
        const { role, content } = doc.data();
        return `${role}: ${content}`;
      })
      .join("\n");

    console.log(
      "📝 Conversation preview:",
      conversationText.slice(0, 300) || "EMPTY",
    );

    /* =========================
       FIND LOADING MESSAGE
    ========================= */
    console.log("⏳ Looking for loading assistant message...");

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
    console.log("✅ Loading message found:", loadingDocRef.id);

    /* =========================
       CALL AI SERVICE
    ========================= */
    console.log("🤖 Sending data to AI service...");

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

    console.log("📦 AI Payload (summary):", {
      diseaseName: payload.disease.diseaseName,
      conversationLength: payload.conversation.length,
      analysisCount: payload.disease.analysis.length,
    });

    const aiResponse = await axios.post(
      `${process.env.PYTHON_URL}/disease/disease_analysis`,
      payload,
      { timeout: 120000 },
    );

    console.log("🤖 AI response received");

    const { reply, analysis, threatUpdate } = aiResponse.data;

    console.log("🗣 AI Reply preview:", reply?.slice(0, 200));
    console.log("📊 Analysis points:", analysis?.length || 0);
    console.log("⚠ Threat update:", threatUpdate || "none");

    /* =========================
       UPDATE CHAT MESSAGE
    ========================= */
    console.log("✏ Updating assistant message...");

    await loadingDocRef.update({
      content: reply || "No response generated.",
      status: "done",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("✅ Chat message updated");

    /* =========================
       UPDATE ANALYSIS
    ========================= */
    if (Array.isArray(analysis) && analysis.length > 0) {
      console.log("📈 Appending analysis points...");
      await diseaseRef.update({
        analysis: admin.firestore.FieldValue.arrayUnion(...analysis),
      });
    }

    /* =========================
       UPDATE THREAT HISTORY
    ========================= */
    if (threatUpdate?.percentage) {
      console.log("🚨 Updating threat history:", threatUpdate.percentage);
      await diseaseRef.update({
        history: admin.firestore.FieldValue.arrayUnion({
          date: new Date().toISOString().split("T")[0],
          threatPercentage: threatUpdate.percentage,
        }),
      });
    }

    console.log("🎉 AI PROCESS COMPLETED SUCCESSFULLY");
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
