import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// ===============================
//  CORS COMPLETO PARA GITHUB PAGES
// ===============================
app.use(
  cors({
    origin: ["https://velipetroll.github.io"],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

// Necesario para manejar el preflight OPTIONS en Vercel
app.options("*", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://velipetroll.github.io");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.status(200).end();
});

// Soporte para JSON grandes
app.use(express.json({ limit: "200mb" }));
app.use(express.urlencoded({ extended: true, limit: "200mb" }));

// ===============================
//  MULTER CONFIG (Vercel: usar /tmp)
// ===============================
const upload = multer({ dest: "/tmp" });

// ===============================
//  CLOUDINARY CONFIG
// ===============================
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ===============================
//  SUBIR ARCHIVO (RAW + PDF + VIDEO + TODO)
// ===============================
app.post("/upload", upload.single("file"), async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://velipetroll.github.io");

  try {
    const { grado, anio, tipo } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "No se recibió archivo" });
    }

    const filePath = req.file.path;
    const folder = `${tipo}/${anio}/${grado}`;

    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "auto", // permite PDF, ZIP, MP4, DOCX, etc.
    });

    fs.unlinkSync(filePath);

    return res.json({
      url: result.secure_url,
      public_id: result.public_id,
    });
  } catch (error) {
    console.error("❌ Error en subida:", error);
    return res.status(500).json({ error: "Error al subir archivo" });
  }
});

// ===============================
//  LISTAR ARCHIVOS
// ===============================
app.get("/imagenes", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://velipetroll.github.io");

  try {
    const { tipo, anio, grado } = req.query;
    const prefix = `${tipo}/${anio}/${grado}`;

    const result = await cloudinary.api.resources({
      type: "upload",
      prefix,
      max_results: 100,
    });

    const files = result.resources.map((r) => ({
      url: r.secure_url,
      public_id: r.public_id,
      format: r.format,
    }));

    return res.json(files);
  } catch (error) {
    console.error("❌ Error al listar:", error);
    return res.status(500).json({ error: "Error al listar archivos" });
  }
});

// ===============================
//  DESCARGAR ARCHIVO
// ===============================
app.get("/descargar", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://velipetroll.github.io");

  try {
    const { public_id } = req.query;

    if (!public_id) {
      return res.status(400).json({ error: "Falta public_id" });
    }

    const info = await cloudinary.api.resource(public_id);
    const url = info.secure_url;

    const filename = public_id.replace(/\//g, "_") + "." + info.format;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.redirect(url);
  } catch (error) {
    console.error("❌ Error descarga:", error);
    return res.status(500).json({ error: "Error al procesar descarga" });
  }
});

export default app;
