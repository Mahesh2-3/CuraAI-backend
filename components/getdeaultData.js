/**
 * getdeaultData.js
 * 
 * Default Config Fetcher.
 * - Queries and falls back to base profile metadata values if empty parameters are encountered.
 */

const { admin, db } = require("../firebase.js");

async function getDefaultData(userId) {
  try {
    if (!userId) {
      return {
        success: false,
        data: {},
        message: "userId not found",
      };
    }

    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      throw new Error("User not found");
    }

    const userData = userDoc.data();

    // ✅ Build basicInfo explicitly
    const basicInfo = {
      name: userData.name || "",
      gender: userData.gender || "",
      dob: userData.dob || "",
      bloodGroup: userData.bloodGroup || "",
      height: userData.height || "",
      weight: userData.weight || "",
      allergies: userData.allergies || [],
      phone: userData.phone || "",
      email: userData.email || "",
    };

    const settingsSnap = await db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences")
      .get();

    const settings = settingsSnap.exists ? settingsSnap.data() : {};

    return {
      success: true,
      data: { basicInfo, settings },
      message: "fetched data sucessfully",
    };
  } catch (error) {
    return {
      success: false,
      data: {},
      message: "Internal Server Error",
    };
  }
}

module.exports = { getDefaultData };
