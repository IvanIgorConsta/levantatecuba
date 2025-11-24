// server/redactor_ia/config/categories.js

/**
 * Taxonomía cerrada de categorías con sinónimos y descripciones
 * para clasificación ensemble híbrida (reglas + LLM + similitud)
 */

module.exports = {
  // Lista cerrada de categorías permitidas
  allowed: [
    'General',
    'Política',
    'Economía',
    'Internacional',
    'Socio político',
    'Tecnología',
    'Tendencia'
  ],

  // Sinónimos y keywords por categoría (case-insensitive)
  synonyms: {
    'Tecnología': [
      // IA y ML
      'IA', 'inteligencia artificial', 'AI', 'ChatGPT', 'GPT', 'OpenAI', 'Claude', 'Gemini', 'Bard',
      'machine learning', 'deep learning', 'redes neuronales', 'neural network', 'LLM', 'modelo de lenguaje',
      // Empresas tech
      'tecnológico', 'tech', 'startup', 'startups', 'Silicon Valley', 'silicon',
      'Apple', 'Google', 'Microsoft', 'Meta', 'Tesla', 'SpaceX', 'Amazon', 'Nvidia', 'AMD',
      // Desarrollo y software
      'software', 'hardware', 'algoritmo', 'código', 'programación', 'desarrollo',
      'aplicación', 'app', 'plataforma', 'cloud', 'nube', 'SaaS', 'API',
      // Blockchain y cripto
      'blockchain', 'cripto', 'criptomoneda', 'Bitcoin', 'BTC', 'Ethereum', 'ETH', 'Web3', 'NFT',
      'DeFi', 'Binance', 'Coinbase', 'Solana', 'Dogecoin',
      // Ciberseguridad
      'ciberseguridad', 'hack', 'hacker', 'breach', 'vulnerabilidad', 'ransomware', 'malware',
      'phishing', 'encryption', 'cifrado', 'privacidad', 'seguridad informática',
      // Dispositivos
      'iPhone', 'Android', 'Samsung', 'Pixel', 'iPad', 'MacBook', 'smartwatch', 'wearable',
      // General
      'innovación', 'digital', 'internet', 'computación', 'datos', 'data', 'analytics',
      'ciencia de datos', 'robotica', 'automatización', 'IoT', 'internet de las cosas',
      '5G', 'wifi', 'banda ancha', 'fibra óptica'
    ],
    'Política': [
      'gobierno', 'parlamento', 'elecciones', 'decreto', 'ministerio', 'partido',
      'sancciones', 'diplomacia', 'congreso', 'ley', 'legislación', 'poder ejecutivo',
      'presidente', 'ministro', 'político', 'reforma', 'constitución', 'votación',
      'campaña', 'candidato', 'oposición', 'coalición', 'senado', 'diputado',
      'asamblea', 'referendum', 'política pública', 'gestión pública', 'administración',
      'decreto-ley', 'normativa', 'regulación gubernamental'
    ],
    'Economía': [
      'inflación', 'PIB', 'mercado', 'finanzas', 'comercio', 'banca', 'precio',
      'impuesto', 'fiscal', 'monetario', 'inversión', 'bolsa', 'divisa', 'dólar',
      'euro', 'deuda', 'crédito', 'déficit', 'superávit', 'exportación', 'importación',
      'aranceles', 'crecimiento económico', 'recesión', 'desempleo', 'empleo',
      'salario', 'producción', 'industria', 'consumo', 'ahorro', 'tasas', 'interés',
      'banco central', 'financiero', 'empresarial', 'negocios', 'economista'
    ],
    'Internacional': [
      'ONU', 'EE.UU.', 'Estados Unidos', 'Unión Europea', 'relaciones exteriores',
      'embajada', 'tránsito internacional', 'conflicto internacional', 'tratado',
      'OTAN', 'acuerdo internacional', 'cumbre', 'G7', 'G20', 'relaciones bilaterales',
      'multilateral', 'geopolítica', 'política exterior', 'cancillería', 'diplomático',
      'extranjero', 'mundial', 'global', 'internacional', 'frontera', 'migración internacional',
      'alianza', 'pacto', 'cooperación internacional', 'tensiones', 'crisis global'
    ],
    'Socio político': [
      'protesta', 'derechos humanos', 'ONG', 'movilización', 'censura', 'represión',
      'migración', 'sociedad civil', 'manifestación', 'activismo', 'disidencia',
      'libertad de expresión', 'prisionero político', 'persecución', 'exilio',
      'refugiado', 'asilo', 'discriminación', 'desigualdad', 'justicia social',
      'movimiento social', 'reclamo', 'denuncia', 'organización comunitaria',
      'participación ciudadana', 'democracia', 'autoritarismo', 'opresión',
      'derecho civil', 'libertades', 'organización social'
    ],
    'Tendencia': [
      // Viralidad y trending
      'viral', 'trending', 'tendencia', 'trend', 'moda', 'fenómeno', 'fenómeno viral',
      'viraliza', 'se vuelve viral', 'rompe internet', 'explosión', 'boom', 'arrasó',
      'millones de vistas', 'récord', 'sensación', 'furor', 'éxito viral', 'impacto viral',
      // Redes sociales
      'redes sociales', 'TikTok', 'Instagram', 'Twitter', 'X', 'Facebook', 'YouTube',
      'Snapchat', 'Threads', 'Telegram', 'Discord', 'Reddit', 'Twitch', 'LinkedIn',
      'WhatsApp', 'stories', 'reels', 'shorts',
      // Creators y celebridades
      'influencer', 'youtuber', 'tiktoker', 'streamer', 'creator', 'content creator',
      'celebridad', 'famoso', 'celebrity', 'personalidad', 'figura pública',
      // Engagement y métricas
      'hashtag', 'trending topic', 'lo más visto', 'top trending', 'compartido',
      'engagement', 'likes', 'views', 'vistas', 'seguidores', 'followers',
      // Entretenimiento y cultura pop
      'entretenimiento', 'cultura pop', 'pop culture', 'meme', 'memes',
      'challenge', 'reto', 'challenge viral', 'dance challenge',
      'filtro', 'filter', 'efecto', 'sticker', 'GIF',
      // Streaming y contenido
      'streaming', 'stream', 'live', 'en vivo', 'transmisión',
      'Netflix', 'Disney+', 'HBO', 'Amazon Prime', 'Spotify', 'Twitch',
      'podcast', 'serie', 'película', 'documental', 'reality',
      // Gaming
      'gaming', 'gamer', 'videojuego', 'esports', 'gameplay', 'streamer',
      'PlayStation', 'Xbox', 'Nintendo', 'Steam', 'Epic Games',
      'trailer', 'lanzamiento', 'beta', 'leak', 'filtrado',
      // Incidentes virales
      'polémica', 'controversia', 'escándalo', 'buzz', 'noticia viral',
      'outage', 'caída', 'fallo masivo', 'error viral', 'glitch',
      // Digital y online
      'cultura digital', 'internet', 'online', 'digital', 'web',
      'contenido viral', 'video viral', 'imagen viral', 'post viral'
    ],
    'General': []
  },

  // Descripciones para similitud semántica
  descriptions: {
    'Tecnología': 'Innovación tecnológica de alto impacto: inteligencia artificial (ChatGPT, OpenAI, Claude), criptomonedas (Bitcoin, Ethereum, Web3), ciberseguridad (hacks, brechas de datos), dispositivos (iPhone, Android), empresas tech (Apple, Google, Tesla, Meta, Nvidia), software, hardware, startups disruptivas, blockchain, cloud computing y transformación digital.',
    'Política': 'Gobierno, leyes, partidos políticos, decisiones políticas, administración pública, elecciones, reformas legislativas y gestión gubernamental.',
    'Economía': 'Mercados financieros, finanzas, precios, empleo, impuestos, comercio, indicadores económicos, inflación, PIB, banca y negocios.',
    'Internacional': 'Relaciones exteriores, geopolítica, actores y eventos fuera del país, diplomacia, tratados internacionales, conflictos globales y cooperación multilateral.',
    'Socio político': 'Dinámica social con dimensión política: protestas, derechos humanos, sociedad civil, movilizaciones, represión, migración y activismo.',
    'Tendencia': 'Contenido viral de alto impacto en redes sociales: TikTok, Instagram, YouTube, Twitter/X. Incluye influencers, celebridades, memes virales, challenges, escándalos digitales, fenómenos de cultura pop, streaming (Netflix, Spotify), gaming (esports, lanzamientos), outages masivos, tendencias de entretenimiento, videos con millones de vistas, controversias virales y cualquier tema que rompe internet o domina trending topics.',
    'General': 'Miscelánea sin predominio temático claro, contenido diverso o que abarca múltiples categorías sin enfoque principal.'
  },

  // Pesos del ensemble (suman 1.0)
  weights: {
    rules: 0.35,     // Reglas y sinónimos
    llm: 0.40,       // LLM forzado
    similarity: 0.25 // Similitud semántica
  },

  // Umbrales de decisión
  thresholds: {
    highConfidence: 0.70,    // Asignar directamente si score >= 0.70
    avoidGeneral: 0.55,      // Evitar "General" si otra >= 0.55
    lowConfidence: 0.50      // Marcar lowConfidence si todo < 0.50
  }
};
