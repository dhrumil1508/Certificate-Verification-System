import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import certificateRoutes from "./routes/certificateRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

const app = express();
const requestBodyLimit = process.env.REQUEST_BODY_LIMIT || "10mb";
const normalizedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGINS,
]
  .flatMap((value) => String(value || "").split(","))
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

const hasVercelFrontendOrigin = normalizedOrigins.some((origin) =>
  origin.endsWith(".vercel.app")
);

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  const normalizedOrigin = origin.replace(/\/$/, "");

  if (
    normalizedOrigin.startsWith("http://localhost:") ||
    normalizedOrigin.startsWith("http://127.0.0.1:")
  ) {
    return true;
  }

  if (
    normalizedOrigins.length === 0 ||
    normalizedOrigins.includes("*") ||
    normalizedOrigins.includes(normalizedOrigin)
  ) {
    return true;
  }

  if (hasVercelFrontendOrigin && normalizedOrigin.endsWith(".vercel.app")) {
    return true;
  }

  return false;
};

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
  })
);
app.use(express.json({ limit: requestBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: requestBodyLimit }));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "certiflow-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/admin", adminRoutes);

export default app;
