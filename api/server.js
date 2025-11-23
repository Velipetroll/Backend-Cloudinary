import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "/tmp" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

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

    res.json(images);
  } catch (error) {
    res.status(500).json({ error: "Error al listar imágenes" });
  }
});

export default app;
