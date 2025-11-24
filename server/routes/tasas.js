const express = require("express");
const RateSnapshot = require("../models/RateSnapshot");
const { scrapeElToque } = require("../services/scrapeElToque");

const router = express.Router();

/**
 * GET /api/tasas
 * Obtiene las tasas del mercado informal
 * Query params:
 * - maxAge: tiempo máximo en minutos para considerar caché válido (default: 60)
 */
router.get("/", async (req, res) => {
  try {
    const maxAge = Math.max(1, parseInt(req.query.maxAge) || 60); // Mínimo 1 minuto
    const maxAgeMs = maxAge * 60 * 1000;
    const cutoffTime = new Date(Date.now() - maxAgeMs);
    
    console.log(`📊 Solicitando tasas con maxAge: ${maxAge} minutos`);
    
    // Buscar el snapshot más reciente
    const latestSnapshot = await RateSnapshot.findOne()
      .sort({ fetchedAt: -1 });
    
    let shouldRefresh = false;
    let responseData = null;
    
    if (!latestSnapshot) {
      console.log('🔄 No hay snapshots previos, necesario hacer scraping');
      shouldRefresh = true;
    } else if (latestSnapshot.fetchedAt < cutoffTime) {
      console.log(`🔄 Snapshot expirado (${latestSnapshot.fetchedAt}), necesario refrescar`);
      shouldRefresh = true;
    } else {
      console.log(`✅ Usando snapshot en caché (${latestSnapshot.fetchedAt})`);
      responseData = {
        fuente: latestSnapshot.fuente,
        url: latestSnapshot.url,
        fetchedAt: latestSnapshot.fetchedAt.toISOString(),
        createdAt: latestSnapshot.createdAt.toISOString(),
        cache: false,
        tasas: latestSnapshot.tasas,
        norm: latestSnapshot.norm
      };
    }
    
    if (shouldRefresh) {
      try {
        // Intentar hacer scraping
        const scrapedData = await scrapeElToque();
        
        // Validar que los datos tienen CUP válido antes de guardar
        if (!scrapedData.tasas || scrapedData.tasas.length < 3) {
          throw new Error('Datos insuficientes: menos de 3 tasas obtenidas');
        }
        
        // Verificar que todas las filas tienen moneda y CUP
        const invalidRows = scrapedData.tasas.filter(tasa => 
          !tasa.moneda || !tasa.cup || 
          tasa.cup === "-" || tasa.cup === "—" || tasa.cup === "N/A"
        );
        
        if (invalidRows.length > 0) {
          console.warn(`⚠️ ${invalidRows.length} filas sin CUP válido, pero procediendo con ${scrapedData.tasas.length - invalidRows.length} válidas`);
        }
        
        // Verificar que Zelle está presente
        const hasZelle = scrapedData.tasas.some(tasa => 
          tasa.moneda.toLowerCase().includes('zelle')
        );
        
        if (!hasZelle) {
          console.warn('⚠️ No se encontró fila Zelle en los datos');
        }
        
        // Guardar nuevo snapshot
        const newSnapshot = new RateSnapshot(scrapedData);
        await newSnapshot.save();
        
        console.log(`✅ Nuevo snapshot guardado: ${scrapedData.tasas.length} tasas con CUP válido`);
        
        responseData = {
          fuente: newSnapshot.fuente,
          url: newSnapshot.url,
          fetchedAt: newSnapshot.fetchedAt.toISOString(),
          createdAt: newSnapshot.createdAt.toISOString(),
          cache: false,
          tasas: newSnapshot.tasas,
          norm: newSnapshot.norm
        };
        
      } catch (scrapeError) {
        console.error('❌ Error en scraping:', scrapeError.message);
        
        // Si el scraping falla pero tenemos datos previos, usarlos
        if (latestSnapshot) {
          console.log('🔄 Usando snapshot previo como fallback');
          responseData = {
            fuente: latestSnapshot.fuente,
            url: latestSnapshot.url,
            fetchedAt: latestSnapshot.fetchedAt.toISOString(),
            createdAt: latestSnapshot.createdAt.toISOString(),
            cache: true, // Indicar que es caché por error
            tasas: latestSnapshot.tasas,
            norm: latestSnapshot.norm
          };
        } else {
          // No hay datos en absoluto
          return res.status(500).json({
            error: 'No se pudieron obtener las tasas',
            message: 'El servicio de scraping falló y no hay datos en caché',
            details: scrapeError.message
          });
        }
      }
    }
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Error en endpoint de tasas:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudieron obtener las tasas'
    });
  }
});

module.exports = router;
