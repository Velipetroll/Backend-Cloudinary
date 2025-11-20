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

    const folder = `${tipo}/${anio}/${grado}`;
    console.log("🔍 Buscando en folder:", folder);

    // Usar resources por folder (la forma correcta)
    const result = await cloudinary.api.resources({
      type: "upload",
      resource_type: "image", // Especificar tipo de recurso
      prefix: folder, // Buscar por prefijo de folder
      max_results: 50,
    });

    console.log(`📊 Resultado de búsqueda:`, {
      resources_count: result.resources?.length || 0,
      folders: result.folders || []
    });

    const images = result.resources ? result.resources.map((r) => ({
      url: r.secure_url,
      public_id: r.public_id,
      format: r.format,
      created_at: r.created_at,
      folder: r.folder
    })) : [];

    console.log(`✅ Encontradas ${images.length} imágenes`);
    
    res.json({
      success: true,
      count: images.length,
      folder: folder,
      images: images
    });
    
  } catch (error) {
    console.error("❌ Error listando imágenes:", error);
    
    // Si el folder no existe, Cloudinary devuelve error
    if (error.message?.includes('No such folder') || error.http_code === 404) {
      return res.json({
        success: true,
        count: 0,
        message: "El folder no existe o está vacío",
        images: []
      });
    }
    
    res.status(500).json({ 
      error: "Error al listar imágenes",
      message: error.message,
      code: error.http_code
    });
  }
});
