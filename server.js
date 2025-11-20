import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configurar multer para manejar archivos en memoria
const upload = multer({ storage: multer.memoryStorage() });

// Middleware para ejecutar multer en serverless
const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
};

export default async function handler(req, res) {
  const { method } = req;

  if (method === "POST") {
    // Ruta: /api.js (upload)
    try {
      await runMiddleware(req, res, upload.single("file"));

      const { grado, anio, tipo } = req.body;

      if (!req.file) {
        return res.status(400).json({ error: "No se subió ningún archivo" });
      }

      // Guardar archivo temporalmente en /tmp (recomendado en Vercel)
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const tempPath = `/tmp/${Date.now()}_${req.file.originalname}`;
      fs.writeFileSync(tempPath, req.file.buffer);

      const folder = `${tipo}/${anio}/${grado}`;

      const result = await cloudinary.uploader.upload(tempPath, {
        folder,
        tags: [`${tipo}_${anio}_${grado}`],
        resource_type: "auto",
      });

      fs.unlinkSync(tempPath); // Eliminar archivo temporal

      res.status(200).json({ url: result.secure_url, public_id: result.public_id });
    } catch (error) {
      console.error("❌ Error al subir:", error);
      res.status(500).json({ error: "Error al subir archivo" });
    }
  } else if (method === "GET") {
    // Ruta: /api.js (imagenes)
    try {
      const { tipo, anio, grado } = req.query;

      if (!tipo || !anio || !grado) {
        return res.status(400).json({ error: "Faltan parámetros: tipo, anio, grado" });
      }

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

      res.status(200).json(images);
    } catch (error) {
      console.error("❌ Error listando imágenes:", error);
      res.status(500).json({ error: "Error al listar imágenes" });
    }
  } else {
    res.status(405).json({ error: "Método no permitido" });
  }
}

// Deshabilitar body parsing automático para manejar archivos
export const config = {
  api: {
    bodyParser: false,
  },
};
