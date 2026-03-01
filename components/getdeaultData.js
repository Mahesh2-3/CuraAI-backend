const { admin, db } = require("../firebase.js");

async function getDefaultData(userId) {
  try {
    console.log(`[GetDefaultData] Starting data fetch for userId: ${userId}`);
    if (!userId) {
      console.warn(`[GetDefaultData] Validation failed: userId is missing`);
      return {
        success: false,
        data: {},
        message: "userId not found",
      };
    }

    console.log(`[GetDefaultData] Fetching user document from Firestore...`);
    const userDoc = await db.collection("users").doc(userId).get();

    if (!userDoc.exists) {
      console.warn(
        `[GetDefaultData] User document does not exist in Firestore for ${userId}`,
      );
      throw new Error("User not found");
    }

    console.log(`[GetDefaultData] Successfully fetched user document`);
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
      emergency: userData.emergency || null,
    };

    console.log(
      `[GetDefaultData] Fetching user preferences/settings from Firestore...`,
    );
    const settingsSnap = await db
      .collection("users")
      .doc(userId)
      .collection("settings")
      .doc("preferences")
      .get();

    const settings = settingsSnap.exists ? settingsSnap.data() : {};

    console.log(
      `[GetDefaultData] Successfully fetched preferences (exists: ${settingsSnap.exists}). Returning basicInfo and settings.`,
    );
    return {
      success: true,
      data: { basicInfo, settings },
      message: "fetched data sucessfully",
    };
  } catch (error) {
    console.error(
      `[GetDefaultData] Error fetching data for userId ${userId}:`,
      error,
    );
    return {
      success: false,
      data: {},
      message: "Internal Server Error",
    };
  }
}

module.exports = { getDefaultData };
