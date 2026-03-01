const express = require("express");
const router = express.Router();
const axios = require("axios");

const { admin, db } = require("../../firebase.js");
const { getDefaultData } = require("../getdeaultData");

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

async function addDisease(userId, diseaseName, details) {
  try {
    console.log(
      `[AddDisease] Starting addDisease for userId: ${userId}, disease: ${diseaseName}`,
    );
    const res = await getDefaultData(userId);
    if (!res.success) {
      console.warn(
        `[AddDisease] Failed to get default data for user: ${userId}`,
      );
      return;
    }
    const basicInfo = res.data?.basicInfo;
    const settings = res.data?.settings;
    console.log(`[AddDisease] Requesting recommendations from Python AI...`);
    const diseaseRef = db
      .collection("users")
      .doc(userId)
      .collection("diseases");

    // 🔹 Call Flask AI service
    const aiRes = await axios.post(
      `${process.env.PYTHON_URL}/disease/recommendations`,
      {
        basicInfo,
        aiBehavior: settings.aiBehavior,
        diseaseName,
        details,
      },
      { timeout: 120000 },
    );

    const recommendations = aiRes.data.recommendations || [];
    console.log(
      `[AddDisease] Received recommendations from Python server, count: ${recommendations.length}`,
    );

    const now = admin.firestore.Timestamp.now();

    console.log(`[AddDisease] Saving new disease to Firestore...`);
    await diseaseRef.add({
      diseaseName,
      slug: slugify(diseaseName),
      details,
      history: [
        {
          date: new Date().toISOString().split("T")[0],
          threatPercentage: 100,
        },
      ],

      recommendations,
      analysis: [],

      createdAt: now,
    });

    console.log(
      `[AddDisease] Successfully added disease ${diseaseName} for user ${userId}`,
    );
    return {
      status: 200,
      message: "Successfully added",
    };
  } catch (error) {
    return {
      status: 500,
      message: "Internal server error",
    };
  }
}

router.post("/", async (req, res) => {
  try {
    const { userId, diseaseName, details } = req.body;
    console.log(
      `[AddDisease] Received POST request with userId: ${userId}, disease: ${diseaseName}`,
    );

    // ✅ Correct validation
    if (!userId || !diseaseName || !details) {
      console.warn(`[AddDisease] Missing Data in POST request`);
      return res.status(400).json({ error: "Missing Data" });
    }

    const result = await addDisease(userId, diseaseName, details);
    res.status(result.status).json({ message: result.message });
  } catch (error) {
    console.error(`[AddDisease] Error in POST endpoint:`, error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
