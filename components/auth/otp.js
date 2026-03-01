const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const { admin, db } = require("../../firebase.js");

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in Firestore with a 10 minute expiration
    await db
      .collection("otps")
      .doc(email)
      .set({
        otp: otp,
        expiresAt: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 10 * 60 * 1000),
        ),
      });

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Your CuraAi Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px; border-radius: 10px;">
            <h2 style="color: #3b82f6; text-align: center;">CuraAi Registration</h2>
            <p style="font-size: 16px; color: #333;">Hello,</p>
            <p style="font-size: 16px; color: #333;">Your verification code is:</p>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #e0e0e0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e293b;">${otp}</span>
            </div>
            <p style="font-size: 14px; color: #666;">This code is valid for 10 minutes.</p>
            <p style="font-size: 14px; color: #666; margin-top: 30px;">If you didn't request this, you can safely ignore this email.</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin-top: 20px;" />
            <p style="font-size: 12px; color: #999; text-align: center;">CuraAi Healthcare Assistant</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
    } else {
    }

    return res
      .status(200)
      .json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to send OTP", details: error.message });
  }
});

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const docRef = db.collection("otps").doc(email);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res
        .status(400)
        .json({ error: "No OTP request found for this email" });
    }

    const data = docSnap.data();

    // Check expiration
    if (data.expiresAt.toDate() < new Date()) {
      await docRef.delete(); // Cleanup expired
      return res
        .status(400)
        .json({ error: "OTP has expired. Please request a new one." });
    }

    // Verify OTP
    if (data.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Success! Delete the OTP doc so it can't be reused
    await docRef.delete();

    return res
      .status(200)
      .json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Failed to verify OTP" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ error: "Email, OTP, and new password are required" });
    }

    const docRef = db.collection("otps").doc(email);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return res
        .status(400)
        .json({ error: "No OTP request found for this email" });
    }

    const data = docSnap.data();

    // Check expiration
    if (data.expiresAt.toDate() < new Date()) {
      await docRef.delete(); // Cleanup expired
      return res
        .status(400)
        .json({ error: "OTP has expired. Please request a new one." });
    }

    // Verify OTP
    if (data.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Attempt to get user by email
    const userRecord = await admin.auth().getUserByEmail(email);

    // Update password
    await admin.auth().updateUser(userRecord.uid, {
      password: newPassword,
    });

    // Success! Delete the OTP doc so it can't be reused
    await docRef.delete();

    return res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to reset password", details: error.message });
  }
});

router.post("/delete-account", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const userRecord = await admin.auth().getUserByEmail(email);

    // 1. Delete user's Firestore data based on uid
    const uid = userRecord.uid;
    await db.collection("users").doc(uid).delete();

    // We should ideally delete subcollections recursively, but for now we just delete the root doc
    // Note: To be fully clean, we'd delete conversations, diseases, settings etc.

    // 2. Delete the user from Firebase Auth
    await admin.auth().deleteUser(uid);

    return res
      .status(200)
      .json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to delete account", details: error.message });
  }
});

module.exports = router;
