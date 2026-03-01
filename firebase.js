const admin = require("firebase-admin");

if (!admin.apps.length) {
  let serviceAcc;

  console.log(`[Firebase] Initializing Firebase Admin SDK...`);
  if (process.env.FIREBASE_PROJECT_ID) {
    // 1. Production Mode: Use individual env variables
    console.log(`[Firebase] Using production environment variables for config`);
    serviceAcc = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"), // handle linebreaks
    };
  } else {
    // 2. Development Mode: Fall back to local file
    console.log(`[Firebase] Falling back to local serviceAccount.json config`);
    try {
      serviceAcc = require("./serviceAccount.json");
    } catch (error) {
      console.error(
        `[Firebase] Error loading local service account file!`,
        error,
      );
    }
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAcc),
    });
    console.log(`[Firebase] Admin SDK initialized successfully`);
  } catch (error) {
    console.error(`[Firebase] Error initializing Admin SDK:`, error);
  }
} else {
  console.log(`[Firebase] Admin SDK already initialized`);
}

const db = admin.firestore();

module.exports = { admin, db };
