import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "/tmp" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ============================
      SUBIR ARCHIVO (RAW)
============================ */
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { grado, anio, tipo } = req.body;
    const filePath = req.file.path;
    const folder = `${tipo}/${anio}/${grado}`;

    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      tags: [`${tipo}_${anio}_${grado}`],
      resource_type: "raw",     // <-- fuerza modo RAW para PDFs grandes
      use_filename: true,
      unique_filename: false,
      timeout: 600000           // 10 minutos
    });

    fs.unlinkSync(filePath);

    res.json({
      url: result.secure_url,
      public_id: result.public_id,
      bytes: result.bytes,
      original_filename: result.original_filename
    });
  } catch (error) {
    console.error("❌ Error Cloudinary:", error);
    res.status(500).json({ error: "Error al subir archivo a Cloudinary" });
  }
});

/* ============================
      LISTAR ARCHIVOS
============================ */
app.get("/imagenes", async (req, res) => {
  try {
    const { tipo, anio, grado } = req.query;
    const prefix = `${tipo}/${anio}/${grado}`;

    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: "raw",
      prefix,
      max_results: 50
    });

    const files = result.resources.map((f) => ({
      url: f.secure_url,
      public_id: f.public_id,
      format: f.format || "raw",
      bytes: f.bytes
    }));

    res.json(files);
  } catch (error) {
    console.error("❌ Error listando:", error);
    res.status(500).json({ error: "Error al listar archivos" });
  }
});

/* ============================
      DESCARGAR ARCHIVO
============================ */
app.get("/descargar", async (req, res) => {
  try {
    const { public_id } = req.query;

    if (!public_id) return res.status(400).json({ error: "Falta public_id" });

    const info = await cloudinary.api.resource(public_id, { resource_type: "raw" });

    const url = info.secure_url;
    const filename = public_id.replace(/\//g, "_");

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.redirect(url);
  } catch (error) {
    console.error("❌ Error al descargar:", error);
    res.status(500).json({ error: "Error al procesar descarga" });
  }
});

export default app;
