const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const { db } = require("../firebase.js");

// Replace with your actual admin email
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

router.post("/", async (req, res) => {
  try {
    const { userId, userEmail, userName, issue, details } = req.body;

    if (!issue || !details) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1. Save report to Firestore
    const reportRef = db.collection("reports").doc();
    await reportRef.set({
      userId: userId || "anonymous",
      userEmail: userEmail || "anonymous",
      userName: userName || "anonymous",
      issue,
      details,
      createdAt: new Date().toISOString(),
      status: "open",
    });

    // 2. Email the Admin
    const adminMailOptions = {
      from: process.env.EMAIL_USER,
      to: ADMIN_EMAIL,
      subject: `New Problem Report: ${issue}`,
      html: `
        <h2>A new problem report has been submitted</h2>
        <p><strong>User ID:</strong> ${userId || "N/A"}</p>
        <p><strong>Name:</strong> ${userName || "N/A"}</p>
        <p><strong>Email:</strong> ${userEmail || "N/A"}</p>
        <p><strong>Issue Category:</strong> ${issue}</p>
        <p><strong>Details:</strong></p>
        <p>${details}</p>
      `,
    };

    // 3. Email the User (if email is known)
    let userMailOptions = null;
    if (userEmail) {
      userMailOptions = {
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: `We received your report - Cura Ai`,
        html: `
          <h2>Thank you for reporting this issue to us!</h2>
          <p>Hi ${userName || "there"},</p>
          <p>We've received your report regarding <strong>${issue}</strong>.</p>
          <p>This is what you submitted:</p>
          <blockquote style="border-left: 4px solid #ccc; padding-left: 10px; color: #555;">
            ${details}
          </blockquote>
          <p>Our team will look into it and get back to you as soon as possible.</p>
          <p>Best regards,<br>The Cura Ai Team</p>
        `,
      };
    }

    // Send emails
    const emailPromises = [transporter.sendMail(adminMailOptions)];
    if (userMailOptions) {
      emailPromises.push(transporter.sendMail(userMailOptions));
    }

    // We don't await the emails to avoid slow response time
    Promise.all(emailPromises).catch((err) => {
    });

    res
      .status(200)
      .json({ success: true, message: "Report submitted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
