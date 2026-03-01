const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const aiResponse = require("./components/ai-response");
const analysis = require("./components/analysis");
const addDisease = require("./components/disease/addDisease");
const diseaseChat = require("./components/disease/chat");
const getSummary = require("./components/get-summary");
const deleteConvo = require("./components/delete/delete-convo");
const deleteAllConvo = require("./components/delete/delete-all-convo");
const createDefault = require("./components/create-default");
const authRoutes = require("./components/auth/otp");

const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // Allow non-browser clients

    const allowedOrigins = [
      process.env.FRONTEND_URL,
      process.env.FRONTEND_URL_ALT,
      process.env.PYTHON_SERVER_URL,
    ].filter(Boolean);

    if (
      origin.startsWith("http://localhost:") ||
      origin.startsWith("http://127.0.0.1:") ||
      allowedOrigins.includes(origin)
    ) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
};

app.use(cors(corsOptions));
app.use(express.json());

const rateLimit = require("express-rate-limit");
const reportRoute = require("./components/report");

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

app.use(limiter);
app.use("/ai-response", aiResponse);
app.use("/analysis", analysis);
app.use("/add-disease", addDisease);
app.use("/disease-chat", diseaseChat);
app.use("/get-summary", getSummary);
app.use("/delete-conversation", deleteConvo);
app.use("/delete-all-conversations", deleteAllConvo);
app.use("/create-default-settings", createDefault);
app.use("/auth", authRoutes);
app.use("/report", reportRoute);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {});
