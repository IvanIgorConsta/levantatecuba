const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

// Configurar puppeteer con stealth
puppeteer.use(StealthPlugin());

const ELTOQUE_URL = process.env.ELTOQUE_URL || "https://eltoque.com/tasas-de-cambio-de-moneda-en-cuba-hoy";
const REQUEST_TIMEOUT = 20000; // 20 segundos
const PUPPETEER_TIMEOUT = 30000; // 30 segundos para puppeteer

/**
 * Normaliza el texto de columna para comparación
 */
function normalizeColumnName(text) {
  if (!text) return "";
  return text.toLowerCase()
    .replace(/[áàäâ]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöô]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Mapea headers de tabla a índices de columnas
 */
function mapTableHeaders(headerRow) {
  const mapping = {
    moneda: -1,
    cup: -1,
    mlc: -1,
    usd: -1
  };
  
  headerRow.forEach((cellText, index) => {
    const normalized = normalizeColumnName(cellText);
    
    // Detectar columna moneda/divisa
    if (normalized.includes('moneda') || normalized.includes('divisa') || 
        normalized.includes('currency') || index === 0) {
      if (mapping.moneda === -1) mapping.moneda = index;
    }
    
    // Detectar columna CUP
    if (normalized.includes('cup') || normalized.includes('peso') || 
        normalized.includes('cubano')) {
      mapping.cup = index;
    }
    
    // Detectar columna MLC
    if (normalized.includes('mlc') || normalized.includes('moneda libremente convertible')) {
      mapping.mlc = index;
    }
    
    // Detectar columna USD
    if (normalized.includes('usd') || normalized.includes('dolar') || 
        normalized.includes('dollar')) {
      mapping.usd = index;
    }
  });
  
  return mapping;
}

/**
 * Valida que una tabla tiene columna CUP válida
 */
function validateTableWithCUP(tableData, columnMapping) {
  if (columnMapping.cup === -1) {
    return { valid: false, reason: "No se encontró columna CUP en el header" };
  }
  
  if (columnMapping.moneda === -1) {
    return { valid: false, reason: "No se encontró columna de moneda en el header" };
  }
  
  let validRows = 0;
  let invalidRows = 0;
  
  for (const row of tableData) {
    if (row.length <= columnMapping.cup || row.length <= columnMapping.moneda) {
      continue; // Fila incompleta, ignorar
    }
    
    const moneda = row[columnMapping.moneda]?.trim();
    const cup = row[columnMapping.cup]?.trim();
    
    // Filtrar headers y filas vacías
    if (!moneda || 
        normalizeColumnName(moneda).includes('moneda') ||
        normalizeColumnName(moneda).includes('divisa') ||
        normalizeColumnName(moneda).includes('tasa')) {
      continue;
    }
    
    if (moneda && cup && cup !== "-" && cup !== "—" && cup !== "N/A") {
      validRows++;
    } else {
      invalidRows++;
    }
  }
  
  if (validRows < 3) {
    return { 
      valid: false, 
      reason: `Insuficientes filas válidas con CUP: ${validRows} (mínimo 3)` 
    };
  }
  
  return { 
    valid: true, 
    validRows, 
    invalidRows 
  };
}

/**
 * Extrae el código de moneda de la cadena de texto
 * Ej: "Euro (EUR)" -> "EUR", "Dólar estadounidense" -> "USD"
 */
function extractCurrencyCode(monedaText) {
  if (!monedaText) return "UNKNOWN";
  
  // Buscar código entre paréntesis
  const match = monedaText.match(/\(([A-Z]{3})\)/);
  if (match) {
    return match[1];
  }
  
  // Mapear nombres comunes
  const currencyMap = {
    "dólar": "USD",
    "dollar": "USD", 
    "euro": "EUR",
    "libra": "GBP",
    "peso mexicano": "MXN",
    "zelle": "USD"
  };
  
  const normalized = monedaText.toLowerCase();
  for (const [key, code] of Object.entries(currencyMap)) {
    if (normalized.includes(key)) {
      return code;
    }
  }
  
  return "UNKNOWN";
}

/**
 * Convierte un string de tasa a número
 * Ej: "400.00 CUP" -> 400.00, "N/A" -> null
 */
function parseRateToNumber(rateText) {
  if (!rateText || typeof rateText !== 'string') return null;
  
  const cleaned = rateText.replace(/[^\d.,]/g, '').replace(',', '.');
  const number = parseFloat(cleaned);
  
  return isNaN(number) ? null : number;
}

/**
 * Procesa las filas de una tabla usando mapeo de columnas
 */
function processTasasFromTable($, table, columnMapping) {
  const tasas = [];
  const norm = [];
  
  $(table).find('tr').each((index, row) => {
    const cells = $(row).find('td, th');
    
    if (cells.length > Math.max(columnMapping.moneda, columnMapping.cup)) {
      const moneda = columnMapping.moneda >= 0 ? $(cells[columnMapping.moneda]).text().trim() : "";
      const cup = columnMapping.cup >= 0 ? $(cells[columnMapping.cup]).text().trim() : "";
      const mlc = columnMapping.mlc >= 0 ? $(cells[columnMapping.mlc]).text().trim() : "";
      const usd = columnMapping.usd >= 0 ? $(cells[columnMapping.usd]).text().trim() : "";
      
      // Filtrar headers y filas vacías
      if (moneda && 
          !normalizeColumnName(moneda).includes('moneda') &&
          !normalizeColumnName(moneda).includes('divisa') &&
          !normalizeColumnName(moneda).includes('tasa') &&
          cup && cup !== "-" && cup !== "—" && cup !== "N/A") {
        
        tasas.push({
          moneda,
          cup,
          mlc: mlc || "-",
          usd: usd || "-"
        });
        
        // Crear entrada normalizada
        norm.push({
          code: extractCurrencyCode(moneda),
          cup: parseRateToNumber(cup),
          mlc: parseRateToNumber(mlc),
          usd: parseRateToNumber(usd)
        });
      }
    }
  });
  
  return { tasas, norm };
}

/**
 * Agrega fila Zelle si no existe
 */
function addZelleIfMissing(tasas, norm) {
  const hasZelle = tasas.some(tasa => 
    tasa.moneda.toLowerCase().includes('zelle')
  );
  
  if (!hasZelle) {
    const usdRow = tasas.find(tasa => 
      extractCurrencyCode(tasa.moneda) === 'USD'
    );
    
    if (usdRow) {
      // Insertar Zelle al inicio
      tasas.unshift({
        moneda: "Zelle (USD)",
        cup: usdRow.cup,
        mlc: usdRow.mlc,
        usd: usdRow.usd
      });
      
      norm.unshift({
        code: "USD",
        cup: parseRateToNumber(usdRow.cup),
        mlc: parseRateToNumber(usdRow.mlc),
        usd: parseRateToNumber(usdRow.usd)
      });
    } else {
      // Si no hay USD, insertar Zelle con guiones
      tasas.unshift({
        moneda: "Zelle (USD)",
        cup: "-",
        mlc: "-",
        usd: "-"
      });
      
      norm.unshift({
        code: "USD",
        cup: null,
        mlc: null,
        usd: null
      });
    }
  }
}

/**
 * FASE 1: Scraping con Cheerio (rápido) con validación de CUP
 */
async function scrapeWithCheerio(url, retries = 2) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🔍 FASE 1 - Intento ${attempt}/${retries} con Cheerio`);
      
      const response = await axios.get(url, {
        timeout: REQUEST_TIMEOUT,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      const $ = cheerio.load(response.data);
      
      // Buscar tabla con header que incluya CUP
      let targetTable = null;
      let columnMapping = null;
      
      $('table').each((index, table) => {
        const firstRow = $(table).find('tr').first();
        const headers = [];
        
        firstRow.find('td, th').each((i, cell) => {
          headers.push($(cell).text().trim());
        });
        
        if (headers.length >= 3) {
          const mapping = mapTableHeaders(headers);
          console.log(`📋 Tabla ${index + 1}: Columnas detectadas:`, {
            headers,
            mapping
          });
          
          if (mapping.cup >= 0 && mapping.moneda >= 0) {
            targetTable = table;
            columnMapping = mapping;
            console.log(`✅ Tabla válida encontrada con CUP en columna ${mapping.cup}`);
            return false; // Salir del each
          }
        }
      });
      
      if (!targetTable || !columnMapping) {
        throw new Error('No se encontró tabla con columna CUP válida');
      }

      // Extraer datos de todas las filas para validar
      const allTableData = [];
      $(targetTable).find('tr').each((index, row) => {
        const rowData = [];
        $(row).find('td, th').each((i, cell) => {
          rowData.push($(cell).text().trim());
        });
        if (rowData.length > 0) {
          allTableData.push(rowData);
        }
      });
      
      // Validar que la tabla tiene filas válidas con CUP
      const validation = validateTableWithCUP(allTableData, columnMapping);
      if (!validation.valid) {
        throw new Error(`Tabla no válida: ${validation.reason}`);
      }
      
      console.log(`✅ Validación exitosa: ${validation.validRows} filas válidas con CUP`);

      const { tasas, norm } = processTasasFromTable($, targetTable, columnMapping);
      
      if (tasas.length < 3) {
        throw new Error(`Insuficientes tasas válidas: ${tasas.length} (mínimo 3)`);
      }
      
      addZelleIfMissing(tasas, norm);
      
      console.log(`✅ FASE 1 exitosa: ${tasas.length} tasas extraídas con CUP válido`);
      return { tasas, norm };
      
    } catch (error) {
      console.error(`❌ FASE 1 - Intento ${attempt} falló:`, error.message);
      if (attempt === retries) {
        throw error;
      }
      // Esperar 2 segundos antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * FASE 2: Scraping con Puppeteer (fallback, headless) con validación de CUP
 */
async function scrapeWithPuppeteer(url) {
  let browser = null;
  
  try {
    console.log('🤖 FASE 2 - Iniciando scraping con Puppeteer');
    
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });
    
    const page = await browser.newPage();
    
    // Configurar página
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
    });
    
    // Bloquear recursos pesados
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });
    
    // Navegar y esperar contenido
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: PUPPETEER_TIMEOUT 
    });
    
    // Buscar tabla con validación de CUP
    const result = await page.evaluate(() => {
      // Función auxiliar para normalizar texto
      function normalizeText(text) {
        if (!text) return "";
        return text.toLowerCase()
          .replace(/[áàäâ]/g, 'a')
          .replace(/[éèëê]/g, 'e')
          .replace(/[íìïî]/g, 'i')
          .replace(/[óòöô]/g, 'o')
          .replace(/[úùüû]/g, 'u')
          .replace(/[ñ]/g, 'n')
          .replace(/[^\w\s]/g, '')
          .trim();
      }
      
      // Función para mapear headers
      function mapHeaders(headerRow) {
        const mapping = { moneda: -1, cup: -1, mlc: -1, usd: -1 };
        
        headerRow.forEach((cellText, index) => {
          const normalized = normalizeText(cellText);
          
          if (normalized.includes('moneda') || normalized.includes('divisa') || 
              normalized.includes('currency') || index === 0) {
            if (mapping.moneda === -1) mapping.moneda = index;
          }
          
          if (normalized.includes('cup') || normalized.includes('peso') || 
              normalized.includes('cubano')) {
            mapping.cup = index;
          }
          
          if (normalized.includes('mlc') || normalized.includes('moneda libremente convertible')) {
            mapping.mlc = index;
          }
          
          if (normalized.includes('usd') || normalized.includes('dolar') || 
              normalized.includes('dollar')) {
            mapping.usd = index;
          }
        });
        
        return mapping;
      }
      
      // Buscar sección con heading de tasas
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let targetSection = null;
      
      for (const heading of headings) {
        const text = heading.textContent.toLowerCase();
        if (text.includes('tasas de cambio del mercado informal') || 
            text.includes('otras tasas de cambio')) {
          targetSection = heading.parentElement;
          break;
        }
      }
      
      let table = null;
      let columnMapping = null;
      
      // Buscar tabla en la sección encontrada
      if (targetSection) {
        const tables = [
          targetSection.querySelector('table'),
          ...Array.from(targetSection.querySelectorAll('table'))
        ].filter(t => t);
        
        if (tables.length === 0) {
          // Buscar tabla después de la sección
          let next = targetSection.nextElementSibling;
          while (next && !table) {
            const found = next.querySelector('table') || (next.tagName === 'TABLE' ? next : null);
            if (found) tables.push(found);
            next = next.nextElementSibling;
          }
        }
        
        // Verificar cada tabla encontrada
        for (const t of tables) {
          const firstRow = t.querySelector('tr');
          if (firstRow) {
            const headers = Array.from(firstRow.querySelectorAll('td, th')).map(cell => cell.textContent.trim());
            const mapping = mapHeaders(headers);
            
            if (mapping.cup >= 0 && mapping.moneda >= 0) {
              table = t;
              columnMapping = mapping;
              break;
            }
          }
        }
      }
      
      // Si no encontramos por sección, buscar primera tabla con CUP
      if (!table) {
        const tables = document.querySelectorAll('table');
        for (const t of tables) {
          const firstRow = t.querySelector('tr');
          if (firstRow) {
            const headers = Array.from(firstRow.querySelectorAll('td, th')).map(cell => cell.textContent.trim());
            const mapping = mapHeaders(headers);
            
            if (mapping.cup >= 0 && mapping.moneda >= 0) {
              table = t;
              columnMapping = mapping;
              break;
            }
          }
        }
      }
      
      if (!table || !columnMapping) {
        throw new Error('No se encontró tabla con columna CUP válida');
      }
      
      // Extraer datos de la tabla
      const rows = table.querySelectorAll('tr');
      const data = [];
      let validRows = 0;
      
      rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td, th'));
        
        if (cells.length > Math.max(columnMapping.moneda, columnMapping.cup)) {
          const moneda = columnMapping.moneda >= 0 ? cells[columnMapping.moneda].textContent.trim() : "";
          const cup = columnMapping.cup >= 0 ? cells[columnMapping.cup].textContent.trim() : "";
          const mlc = columnMapping.mlc >= 0 ? cells[columnMapping.mlc].textContent.trim() : "";
          const usd = columnMapping.usd >= 0 ? cells[columnMapping.usd].textContent.trim() : "";
          
          // Filtrar headers y filas vacías
          if (moneda && 
              !normalizeText(moneda).includes('moneda') &&
              !normalizeText(moneda).includes('divisa') &&
              !normalizeText(moneda).includes('tasa') &&
              cup && cup !== "-" && cup !== "—" && cup !== "N/A") {
            
            data.push({ 
              moneda, 
              cup, 
              mlc: mlc || "-", 
              usd: usd || "-" 
            });
            validRows++;
          }
        }
      });
      
      return {
        data,
        validRows,
        columnMapping,
        headers: Array.from(table.querySelector('tr').querySelectorAll('td, th')).map(cell => cell.textContent.trim())
      };
    });
    
    console.log(`📋 FASE 2 - Columnas detectadas:`, {
      headers: result.headers,
      mapping: result.columnMapping
    });
    
    if (!result.data || result.data.length === 0) {
      throw new Error('No se encontraron tasas válidas con Puppeteer');
    }
    
    if (result.validRows < 3) {
      throw new Error(`Insuficientes filas válidas con CUP: ${result.validRows} (mínimo 3)`);
    }
    
    console.log(`✅ FASE 2 - Validación exitosa: ${result.validRows} filas válidas con CUP`);
    
    // Procesar datos extraídos
    const tasas = result.data;
    const norm = result.data.map(row => ({
      code: extractCurrencyCode(row.moneda),
      cup: parseRateToNumber(row.cup),
      mlc: parseRateToNumber(row.mlc),
      usd: parseRateToNumber(row.usd)
    }));
    
    addZelleIfMissing(tasas, norm);
    
    console.log(`✅ FASE 2 exitosa: ${tasas.length} tasas extraídas con CUP válido`);
    return { tasas, norm };
    
  } catch (error) {
    console.error('❌ FASE 2 - Error con Puppeteer:', error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Realiza el scraping de la página de ElToque (orquestador) con validación estricta de CUP
 */
async function scrapeElToque() {
  console.log(`📊 Iniciando scraping de tasas desde: ${ELTOQUE_URL}`);
  
  let result = null;
  let phase = null;
  
  try {
    // FASE 1: Intentar con Cheerio (rápido)
    console.log('⚡ Iniciando FASE 1: Scraping con Cheerio');
    const data = await scrapeWithCheerio(ELTOQUE_URL);
    result = data;
    phase = "Cheerio";
    console.log('✅ FASE 1 completada exitosamente');
  } catch (cheerioError) {
    console.log(`🔄 FASE 1 falló: ${cheerioError.message}`);
    console.log('⚡ Iniciando FASE 2: Fallback con Puppeteer');
    
    try {
      // FASE 2: Fallback con Puppeteer (robusto)
      const data = await scrapeWithPuppeteer(ELTOQUE_URL);
      result = data;
      phase = "Puppeteer";
      console.log('✅ FASE 2 completada exitosamente');
    } catch (puppeteerError) {
      console.error('❌ Ambas fases fallaron');
      console.error(`   FASE 1 (Cheerio): ${cheerioError.message}`);
      console.error(`   FASE 2 (Puppeteer): ${puppeteerError.message}`);
      throw new Error(`Scraping falló - Cheerio: ${cheerioError.message}, Puppeteer: ${puppeteerError.message}`);
    }
  }
  
  if (!result || !result.tasas || result.tasas.length < 3) {
    throw new Error('No se pudieron obtener datos válidos con columna CUP');
  }
  
  // Validación final: verificar que todas las filas tienen CUP
  const invalidRows = result.tasas.filter(tasa => 
    !tasa.cup || tasa.cup === "-" || tasa.cup === "—" || tasa.cup === "N/A"
  );
  
  if (invalidRows.length > 0) {
    console.warn(`⚠️ ${invalidRows.length} filas sin CUP válido detectadas`);
  }
  
  const finalResult = {
    fuente: "eltoque",
    url: ELTOQUE_URL,
    tasas: result.tasas,
    norm: result.norm,
    fetchedAt: new Date()
  };
  
  console.log(`✅ Scraping exitoso con ${phase}: ${result.tasas.length} tasas obtenidas, todas con CUP válido`);
  console.log(`📈 Primera fila: ${result.tasas[0]?.moneda} - CUP: ${result.tasas[0]?.cup}`);
  
  return finalResult;
}

module.exports = {
  scrapeElToque
};
