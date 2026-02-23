const express = require("express");
const cors = require("cors");

const aiResponse = require("./components/ai-response");
const analysis = require("./components/analysis");
const addDisease = require("./components/disease/addDisease");
const diseaseChat = require("./components/disease/chat");
const getSummary = require("./components/get-summary");
const deleteConvo = require("./components/delete/delete-convo");
const deleteAllConvo = require("./components/delete/delete-all-convo");
const createDefault = require("./components/create-default");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

app.use("/ai-response", aiResponse);
app.use("/analysis", analysis);
app.use("/add-disease", addDisease);
app.use("/disease-chat", diseaseChat);
app.use("/get-summary", getSummary);
app.use("/delete-conversation", deleteConvo);
app.use("/delete-all-conversations", deleteAllConvo);
app.use("/create-default-settings", createDefault);
app.use("/med-ai", require("./components/med-ai"));

app.listen(port, () => {
  console.log("Backend running on the port 5000");
});
