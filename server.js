import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

// ✅ Configuración CORS
app.use(cors({
  origin: ["https://velipetroll.github.io"], // tu dominio de GitHub Pages
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));

app.use(express.json());
const upload = multer({ dest: "/tmp" });

// ✅ Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- Subida de archivos ---
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
    console.error("❌ Error al subir:", error);
    res.status(500).json({ error: "Error al subir archivo" });
  }
});

// --- Obtener imágenes ---
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
    }));

    // ✅ encabezado explícito de CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.json(images);
  } catch (error) {
    console.error("❌ Error listando imágenes:", error);
    res.status(500).json({ error: "Error al listar imágenes" });
  }
});

// --- Ruta raíz ---
app.get("/", (req, res) => {
  res.send("✅ Backend Cloudinary funcionando correctamente en Vercel");
});

export default app;
