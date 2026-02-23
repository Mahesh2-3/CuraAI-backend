const express = require("express");
const router = express.Router();
const axios = require("axios");

const admin = require("firebase-admin");
const serviceAcc = require("../serviceAccount.json");
const { getDefaultData } = require("./getdeaultData");

console.log("🟡 AI ROUTER LOADED");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAcc),
  });
  console.log("🟢 Firebase Admin initialized");
}

const db = admin.firestore();

async function processAiResponse(userId, conversationId) {
  console.log("🟡 processAiResponse START", { userId, conversationId });

  try {
    console.log("🟡 Fetching default user data...");
    const res = await getDefaultData(userId);

    if (!res?.success) {
      console.error("🔴 Failed to fetch default data", res);
      return;
    }

    const basicInfo = res.data?.basicInfo;
    const settings = res.data?.settings;

    console.log("🟢 User data fetched", {
      hasBasicInfo: !!basicInfo,
      settingsKeys: Object.keys(settings || {}),
    });

    console.log("🟡 Fetching conversation messages...");
    const snapshot = await db
      .collection("users")
      .doc(userId)
      .collection("conversations")
      .doc(conversationId)
      .collection("messages")
      .orderBy("createdAt", "asc")
      .get();

    console.log(`🟢 Total messages fetched: ${snapshot.size}`);

    const conversationText = snapshot.docs
      .filter((doc) => doc.data().status !== "loading")
      .map((doc) => {
        const { role, content } = doc.data();
        return `${role}: ${content}`;
      })
      .join("\n");

    console.log("🟡 Conversation text length:", conversationText.length);

    console.log("🟡 Searching for loading assistant message...");
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
      console.warn("🟠 No loading assistant message found");
      return;
    }

    const loadingDocRef = loadingSnap.docs[0].ref;
    console.log("🟢 Loading message found:", loadingDocRef.id);

    console.log("🟡 Sending request to AI service...");
    const aiResponse = await axios.post(
      `${process.env.PYTHON_URL || "http://127.0.0.1:5001"}/chat`,
      {
        basicInfo,
        aiBehavior: settings.aiBehavior,
        message: conversationText,
      },
      { timeout: 120000 },
    );

    console.log("🟢 AI responded successfully");

    const aiReply = aiResponse.data?.reply;

    if (!aiReply) {
      console.error("🔴 AI reply is empty", aiResponse.data);
      return;
    }

    console.log("🟡 Updating Firestore message...");
    await loadingDocRef.update({
      content: aiReply,
      status: "done",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("🟢 Message updated successfully");
  } catch (error) {
    console.error("🔴 processAiResponse ERROR", {
      message: error.message,
      stack: error.stack,
    });
  }
}

router.post("/", async (req, res) => {
  console.log("🟡 /ai endpoint hit");

  try {
    const { userId, conversationId } = req.body;

    console.log("📦 Request body:", { userId, conversationId });

    if (!userId || !conversationId) {
      console.warn("🟠 Missing userId or conversationId");
      return res.status(400).json({ error: "Missing data" });
    }

    res.send({ started: true });
    console.log("🟢 Response sent to client");

    processAiResponse(userId, conversationId);
  } catch (error) {
    console.error("🔴 AI ROUTE ERROR", {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "AI processing failed" });
  }
});

module.exports = router;
