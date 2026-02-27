const admin = require("firebase-admin");

if (!admin.apps.length) {
  let serviceAcc;

  if (process.env.FIREBASE_PROJECT_ID) {
    // 1. Production Mode: Use individual env variables
    serviceAcc = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // handle linebreaks
    };
  } else {
    // 2. Development Mode: Fall back to local file
    try {
      serviceAcc = require("./serviceAccount.json");
    } catch (error) {
      console.error("Firebase credentials not found!");
    }
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAcc),
  });
}

const db = admin.firestore();

module.exports = { admin, db };
