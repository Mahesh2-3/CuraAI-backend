# Cura Web - Backend

This is the Node.js API backend for the Cura application, built with **Express**.

## Tech Stack

- **Framework:** Node.js + Express
- **Authentication/Database:** Firebase Admin SDK
- **File Management:** Cloudinary
- **Email Delivery:** Nodemailer
- **Other utilities:** Axios, CORS, Crypto, Dotenv

## Core Responsibilities

- Serves as the primary REST API intermediary for the frontend.
- **Authentication:** Handles OTP generation, dispatch via Nodemailer, and user verifications.
- **Disease & Conversational Data:** Manages saving, deleting, and fetching conversation histories and summaries.
- **Integrations:** Acts as a bridge, accepting requests from the frontend and securely routing specific AI analysis and summarization workloads to the `pythonServer`.
- **File Uploads:** Interacts with Cloudinary for handling and serving user avatars or media files safely.

## Endpoints Overview

- `/auth`: OTP generation and validation.
- `/ai-response`: General AI chatbot responses.
- `/analysis` & `/get-summary`: Proxies data for processing.
- `/disease-chat` & `/add-disease`: Features tailored for disease workflows.
- `/delete-conversation` & `/delete-all-conversations`: Chat history management.
- `/create-default-settings`: Scaffolds standard user data schemas.

## How to Run Locally

1. Ensure Node.js is installed.
2. Run `npm install` to install dependencies.
3. Configure your `.env` file containing (Firebase credentials, Cloudinary URLs, etc.). Ensure `serviceAccount.json` is present for Firebase Admin.
4. Run `npm run dev` to start the server using Nodemon (runs on `http://localhost:5000` by default).
