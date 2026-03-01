const express = require("express");
const router = express.Router();
const axios = require("axios");

const { admin, db } = require("../firebase.js");
const { getDefaultData } = require("./getdeaultData");

/* =========================
   HELPERS
========================= */

function getTimestampByRange(param) {
  if (param === "overall") return null;

  const days = param === "7d" ? 7 : 30;
  const date = new Date();
  date.setDate(date.getDate() - days);

  return admin.firestore.Timestamp.fromDate(date);
}

async function getConversationReports(userId, param) {
  const since = getTimestampByRange(param);

  let query = db.collection("users").doc(userId).collection("conversations");
  if (since) query = query.where("createdAt", ">=", since);

  const snapshot = await query.get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        conversationId: doc.id,
        report: data.report || null,
        createdAt: data.createdAt || null,
      };
    })
    .filter((r) => r.report);
}

async function getDiseasesData(userId, param) {
  const since = getTimestampByRange(param);

  let query = db.collection("users").doc(userId).collection("diseases");
  if (since) query = query.where("createdAt", ">=", since);

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    diseaseId: doc.id,
    ...doc.data(),
  }));
}

/* =========================
   MAIN PROCESS
========================= */

async function processSummary(userId, param) {
  console.log(
    `[Get-Summary] Starting processSummary for userId: ${userId}, param: ${param}`,
  );
  const res = await getDefaultData(userId);
  if (!res.success) {
    console.warn(
      `[Get-Summary] Failed to get default data for user: ${userId}`,
    );
    return;
  }
  const basicInfo = res.data?.basicInfo;
  const settings = res.data?.settings;
  const mode = settings?.summary?.mode || "chat_and_diseases";

  const shouldFetchReports = mode === "chat" || mode === "chat_and_diseases";
  const shouldFetchDiseases =
    mode === "diseases" || mode === "chat_and_diseases";

  console.log(
    `[Get-Summary] Fetching conversation reports & diseases from Firestore... mode: ${mode}`,
  );
  const [reports, diseases] = await Promise.all([
    shouldFetchReports ? getConversationReports(userId, param) : [],
    shouldFetchDiseases ? getDiseasesData(userId, param) : [],
  ]);
  console.log(
    `[Get-Summary] Fetched ${reports?.length || 0} reports and ${diseases?.length || 0} diseases`,
  );

  const payload = {
    basicInfo,
    aiBehavior: settings.aiBehavior || {},
    range: param,
    reports: reports || [],
    diseases: diseases || [],
  };

  console.dir(payload, { depth: null });

  console.log(`[Get-Summary] Requesting summary from Python server...`);
  const response = await axios.post(
    `${process.env.PYTHON_URL}/get-summary`,
    payload,
    { timeout: 120000 },
  );

  console.log(
    `[Get-Summary] Received AI summary response, updating Firestore...`,
  );

  await db
    .collection("users")
    .doc(userId)
    .collection("summaries")
    .doc(param)
    .set(
      {
        markdown: response.data,
        range: param,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        reportsCount: payload.reports.length,
        diseasesCount: payload.diseases.length,
      },
      { merge: true },
    );
  console.log(
    `[Get-Summary] Successfully finished processSummary for ${userId}`,
  );
}

/* =========================
   ROUTE
========================= */

router.post("/", async (req, res) => {
  try {
    const { userId, param } = req.body;
    console.log(
      `[Get-Summary] Received POST request with userId: ${userId}, param: ${param}`,
    );
    if (!userId || !param) {
      console.warn(`[Get-Summary] Missing userId or param in POST request`);
      return res.status(400).json({ error: "Missing userId or param" });
    }

    await processSummary(userId, param);

    console.log(`[Get-Summary] Generated summary successfully`);
    return res.json({
      success: true,
      message: "Summary generated successfully",
    });
  } catch (err) {
    console.error(`[Get-Summary] Error in POST endpoint:`, err);
    return res.status(500).json({
      success: false,
      error: "Failed to generate summary",
    });
  }
});

module.exports = router;
