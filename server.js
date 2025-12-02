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

// --- Subir archivo ---
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { grado, anio, tipo } = req.body;
    const filePath = req.file.path;
    const folder = `${tipo}/${anio}/${grado}`;

    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      tags: [`${tipo}_${anio}_${grado}`],
      resource_type: "auto",
    });

    fs.unlinkSync(filePath);
    res.json({ url: result.secure_url, public_id: result.public_id });
  } catch (error) {
    res.status(500).json({ error: "Error al subir archivo" });
  }
});

// --- Listar archivos ---
app.get("/imagenes", async (req, res) => {
  try {
    const { tipo, anio, grado } = req.query;
    const prefix = `${tipo}/${anio}/${grado}`;

    const result = await cloudinary.api.resources({
      type: "upload",
      prefix,
      max_results: 50,
    });

    const images = result.resources.map((r) => ({
      url: r.secure_url,
      public_id: r.public_id,
      format: r.format,
    }));

    res.json(images);
  } catch (error) {
    res.status(500).json({ error: "Error al listar imágenes" });
  }
});

// --- Descargar archivo desde Cloudinary ---
app.get("/descargar", async (req, res) => {
  try {
    const { public_id } = req.query;

    if (!public_id) {
      return res.status(400).json({ error: "Falta public_id" });
    }

    // Obtener información del recurso
    const info = await cloudinary.api.resource(public_id);

    const url = info.secure_url;
    const filename = public_id.replace(/\//g, "_") + "." + info.format;

    // Forzar descarga
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.redirect(url);
  } catch (error) {
    console.error("Error al descargar:", error);
    res.status(500).json({ error: "Error al procesar descarga" });
  }
});

export default app;
