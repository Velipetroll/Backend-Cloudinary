import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configurar almacenamiento temporal en memoria para Vercel
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite
  }
});

// Configurar Cloudinary con validación
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Validar que las variables de Cloudinary estén configuradas
if (!cloudinaryConfig.cloud_name || !cloudinaryConfig.api_key || !cloudinaryConfig.api_secret) {
  console.error("❌ Faltan variables de entorno de Cloudinary");
}

cloudinary.config(cloudinaryConfig);

// Middleware de logging para debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// --- Subida de archivos ---
app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    console.log("📤 Iniciando subida de archivo...");
    console.log("Body:", req.body);
    console.log("File:", req.file ? `Presente (${req.file.originalname}, ${req.file.size} bytes)` : "Ausente");

    const { grado, anio, tipo } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: "No se proporcionó ningún archivo" });
    }

    if (!grado || !anio || !tipo) {
      return res.status(400).json({ 
        error: "Faltan parámetros requeridos",
        required: ["grado", "anio", "tipo"],
        received: { grado, anio, tipo }
      });
    }

    // Convertir buffer a base64 para Cloudinary
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;

    const folder = `${tipo}/${anio}/${grado}`;
    console.log("📁 Subiendo a folder:", folder);

    const result = await cloudinary.uploader.upload(dataURI, {
      folder,
      tags: [`${tipo}_${anio}_${grado}`],
      resource_type: "auto",
    });

    console.log("✅ Archivo subido exitosamente:", result.public_id);
    
    res.json({ 
      success: true,
      url: result.secure_url, 
      public_id: result.public_id,
      folder: folder
    });
  } catch (error) {
    console.error("❌ Error al subir:", error);
    res.status(500).json({ 
      error: "Error al subir archivo",
      message: error.message,
      details: error.stack
    });
  }
});

// --- Obtener imágenes ---
app.get("/imagenes", async (req, res) => {
  try {
    console.log("📥 Solicitando imágenes:", req.query);
    
    const { tipo, anio, grado } = req.query;
    
    if (!tipo || !anio || !grado) {
      return res.status(400).json({ 
        error: "Faltan parámetros requeridos",
        required: ["tipo", "anio", "grado"],
        received: { tipo, anio, grado }
      });
    }

    const prefix = `${tipo}/${anio}/${grado}`;
    console.log("🔍 Buscando en prefix:", prefix);

    const result = await cloudinary.api.resources({
      type: "upload",
      prefix,
      max_results: 50,
    });

    const images = result.resources.map((r) => ({
      url: r.secure_url,
      public_id: r.public_id,
      format: r.format,
      created_at: r.created_at
    }));

    console.log(`✅ Encontradas ${images.length} imágenes`);
    
    res.json({
      success: true,
      count: images.length,
      images: images
    });
  } catch (error) {
    console.error("❌ Error listando imágenes:", error);
    res.status(500).json({ 
      error: "Error al listar imágenes",
      message: error.message,
      details: error.stack
    });
  }
});

// Ruta de salud para verificar que el servidor funciona
app.get("/", (req, res) => {
  res.json({ 
    message: "Servidor OBS Backend funcionando correctamente",
    timestamp: new Date().toISOString(),
    environment: {
      cloudinary_configured: !!process.env.CLOUDINARY_CLOUD_NAME,
      node_version: process.version
    }
  });
});

// Ruta para verificar configuración de Cloudinary (solo para desarrollo)
app.get("/config", (req, res) => {
  res.json({
    cloudinary: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? "✅ Configurado" : "❌ Faltante",
      api_key: process.env.CLOUDINARY_API_KEY ? "✅ Configurado" : "❌ Faltante",
      api_secret: process.env.CLOUDINARY_API_SECRET ? "✅ Configurado" : "❌ Faltante"
    }
  });
});

// Manejar rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

// Manejo global de errores
app.use((error, req, res, next) => {
  console.error("💥 Error global:", error);
  res.status(500).json({
    error: "Error interno del servidor",
    message: error.message
  });
});

const PORT = process.env.PORT || 3000;

// Exportar para Vercel
export default app;
