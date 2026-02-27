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

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]/g, "");

async function addDisease(userId, diseaseName, details) {
  try {
    const res = await getDefaultData(userId);
    if (!res.success) {
      return;
    }
    const basicInfo = res.data?.basicInfo;
    const settings = res.data?.settings;
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

    const now = admin.firestore.Timestamp.now();

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

    return {
      status: 200,
      message: "Successfully added",
    };
  } catch (error) {
    console.error(error);
    return {
      status: 500,
      message: "Internal server error",
    };
  }
}

router.post("/", async (req, res) => {
  try {
    const { userId, diseaseName, details } = req.body;

    // ✅ Correct validation
    if (!userId || !diseaseName || !details) {
      return res.status(400).json({ error: "Missing Data" });
    }

    const result = await addDisease(userId, diseaseName, details);
    res.status(result.status).json({ message: result.message });
  } catch (error) {
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
