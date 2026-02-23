const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const router = express.Router();

router.post("/med-ai", (req, res) => {
  const { text, attachment } = req.body;

  // If there's an attachment (image/pdf), the current NER model logic
  // in med.py only accepts text.
  // We can either:
  // 1. Process the text if provided.
  // 2. Mock a response for the file saying "File received: <url>"
  // 3. Or just pass the extracted text if we had OCR (which we don't yet).

  // For now, we'll process the 'text' field.

  let inputText = text || "";
  if (attachment) {
    inputText += ` [Attachment: ${attachment}]`;
  }

  if (!inputText.trim()) {
    return res.json({ message: "Please provide text or an attachment." });
  }

  const scriptPath = path.join(__dirname, "../scripts/run_med.py");

  // Spawn python process
  const pythonProcess = spawn("python", [scriptPath, inputText]);

  let dataString = "";
  let errorString = "";

  pythonProcess.stdout.on("data", (data) => {
    dataString += data.toString();
  });

  pythonProcess.stderr.on("data", (data) => {
    errorString += data.toString();
  });

  pythonProcess.on("close", (code) => {
    if (code !== 0) {
      console.error(`Python script exited with code ${code}: ${errorString}`);
      return res.status(500).json({ error: "Failed to process text" });
    }

    try {
      const result = JSON.parse(dataString);
      res.json(result);
    } catch (e) {
      console.error("Failed to parse Python output:", dataString);
      res
        .status(500)
        .json({ error: "Invalid response from AI model", raw: dataString });
    }
  });
});

module.exports = router;
