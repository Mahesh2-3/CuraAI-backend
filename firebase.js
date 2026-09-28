/**
 * firebase.js
 *
 * Node Firebase Admin Initialization.
 * - Logs service account configurations to grant secure server-side Firestore access.
 */

const admin = require("firebase-admin");

if (!admin.apps.length) {
  let serviceAcc;

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    // 1. Production Mode: Use individual env variables
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n");

    // Validate private key format
    if (!privateKey.includes("BEGIN PRIVATE KEY")) {
      console.error("Invalid Firebase private key format");
      throw new Error(
        "Firebase private key format is invalid. Must contain 'BEGIN PRIVATE KEY'",
      );
    }

    serviceAcc = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    };

    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAcc),
      });
      console.log("Firebase Admin SDK initialized successfully");
    } catch (error) {
      console.error("Firebase initialization error:", error.message);
      console.error("Error code:", error.code);
      throw new Error(
        "Failed to initialize Firebase Admin SDK: " + error.message,
      );
    }
  } else {
    const missingVars = [];
    if (!process.env.FIREBASE_PROJECT_ID)
      missingVars.push("FIREBASE_PROJECT_ID");
    if (!process.env.FIREBASE_CLIENT_EMAIL)
      missingVars.push("FIREBASE_CLIENT_EMAIL");
    if (!process.env.FIREBASE_PRIVATE_KEY)
      missingVars.push("FIREBASE_PRIVATE_KEY");
    throw new Error(
      "Missing Firebase environment variables: " + missingVars.join(", "),
    );
  }
}

const db = admin.firestore();

module.exports = { admin, db };
