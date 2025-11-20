import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Configurar almacenamiento en memoria
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

// Validar y configurar Cloudinary
const requiredEnvVars = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY', 
  'CLOUDINARY_API_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Variables de entorno faltantes:', missingVars);
} else {
  console.log('✅ Todas las variables de Cloudinary están configuradas');
  
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// --- Obtener imágenes ---
app.get("/imagenes", async (req, res) => {
  try {
    console.log("📥 Solicitando imágenes:", req.query);
    
    const { tipo, anio, grado } = req.query;
    
    // Verificar variables de Cloudinary
    if (missingVars.length > 0) {
      return res.status(500).json({ 
        error: "Configuración incompleta",
        message: "Faltan variables de entorno de Cloudinary",
        missing: missingVars
      });
    }
    
    if (!tipo || !anio || !grado) {
      return res.status(400).json({ 
        error: "Faltan parámetros requeridos",
        required: ["tipo", "anio", "grado"],
        received: { tipo, anio, grado }
      });
    }

    const prefix = `${tipo}/${anio}/${grado}`;
    console.log("🔍 Buscando en prefix:", prefix);

    // Usar resources_by_tag en vez de resources para mejor compatibilidad
    const tag = `${tipo}_${anio}_${grado}`;
    
    const result = await cloudinary.api.resources_by_tag(tag, {
      type: "upload",
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
    
    // Error específico de autenticación
    if (error.message?.includes('api_secret mismatch') || error.http_code === 401) {
      return res.status(500).json({ 
        error: "Error de autenticación con Cloudinary",
        message: "Verifica las variables de entorno CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET",
        code: "AUTH_ERROR"
      });
    }
    
    res.status(500).json({ 
      error: "Error al listar imágenes",
      message: error.message
    });
  }
});

// Ruta de diagnóstico mejorada
app.get("/", (req, res) => {
  const configStatus = missingVars.length > 0 ? "INCOMPLETA" : "CORRECTA";
  
  res.json({ 
    message: "Servidor OBS Backend funcionando",
    timestamp: new Date().toISOString(),
    config_status: configStatus,
    missing_variables: missingVars,
    environment: {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? "✅" : "❌",
      api_key: process.env.CLOUDINARY_API_KEY ? "✅" : "❌", 
      api_secret: process.env.CLOUDINARY_API_SECRET ? "✅" : "❌"
    }
  });
});

// Ruta para probar conexión con Cloudinary
app.get("/test-cloudinary", async (req, res) => {
  try {
    if (missingVars.length > 0) {
      return res.status(500).json({
        success: false,
        error: "Variables faltantes",
        missing: missingVars
      });
    }

    // Intentar una operación simple de Cloudinary
    const result = await cloudinary.api.ping();
    
    res.json({
      success: true,
      message: "Conexión con Cloudinary exitosa",
      cloudinary_response: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Error conectando con Cloudinary",
      message: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
export default app;
