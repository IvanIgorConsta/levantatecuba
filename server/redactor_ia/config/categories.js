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
    'Tendencia',
    'Deporte'
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
      // Instituciones y gobierno
      'gobierno', 'parlamento', 'congreso', 'senado', 'asamblea', 'cámara',
      'poder ejecutivo', 'poder legislativo', 'poder judicial', 'corte suprema',
      'ministerio', 'secretaría', 'gobernación', 'alcaldía', 'ayuntamiento',
      // Elecciones y democracia
      'elecciones', 'votación', 'voto', 'sufragio', 'urnas', 'escrutinio',
      'campaña electoral', 'candidato', 'candidatura', 'partido político',
      'coalición', 'oposición', 'oficialismo', 'mayoría', 'minoría',
      // Cargos políticos
      'presidente', 'vicepresidente', 'primer ministro', 'ministro', 'secretario',
      'gobernador', 'alcalde', 'senador', 'diputado', 'congresista', 'legislador',
      // Leyes y regulación
      'ley', 'decreto', 'decreto-ley', 'legislación', 'constitución', 'reforma',
      'normativa', 'regulación', 'ordenanza', 'resolución', 'proyecto de ley',
      'veto', 'promulgación', 'sanción', 'aprobación',
      // Términos generales
      'político', 'política pública', 'gestión pública', 'administración pública',
      'referendum', 'plebiscito', 'consulta popular', 'estado', 'nación',
      'soberanía', 'democracia', 'república', 'dictadura', 'autoritarismo',
      'corrupción', 'nepotismo', 'burocracia', 'gabinete', 'juramento'
    ],
    'Economía': [
      // Indicadores macroeconómicos
      'inflación', 'PIB', 'producto interno bruto', 'crecimiento económico', 'recesión',
      'déficit', 'superávit', 'deuda pública', 'deuda externa', 'balanza comercial',
      'desempleo', 'empleo', 'tasa de desempleo', 'PBI', 'IPC',
      // Finanzas y banca
      'finanzas', 'banca', 'banco', 'banco central', 'FMI', 'Banco Mundial',
      'crédito', 'préstamo', 'hipoteca', 'interés', 'tasas de interés',
      'inversión', 'inversionista', 'capital', 'liquidez', 'solvencia',
      // Mercados y bolsa
      'mercado', 'bolsa', 'Wall Street', 'acciones', 'bonos', 'valores',
      'Nasdaq', 'S&P', 'Dow Jones', 'trader', 'broker', 'cotización',
      // Moneda y divisas
      'divisa', 'dólar', 'euro', 'peso', 'yen', 'yuan', 'moneda',
      'tipo de cambio', 'devaluación', 'revaluación', 'paridad',
      // Comercio
      'comercio', 'exportación', 'importación', 'aranceles', 'aduanas',
      'tratado comercial', 'libre comercio', 'TLC', 'embargo', 'sanciones económicas',
      // Impuestos y fiscal
      'impuesto', 'fiscal', 'tributario', 'IVA', 'ISR', 'hacienda',
      'presupuesto', 'gasto público', 'austeridad', 'subsidio',
      // Empresas y negocios
      'empresa', 'empresarial', 'corporación', 'negocio', 'PYME',
      'quiebra', 'bancarrota', 'fusión', 'adquisición', 'monopolio',
      // General
      'precio', 'costo', 'salario', 'sueldo', 'producción', 'industria',
      'consumo', 'ahorro', 'pobreza', 'riqueza', 'desigualdad económica',
      'economista', 'financiero', 'monetario', 'escasez', 'abundancia'
    ],
    'Internacional': [
      // Organizaciones y relaciones
      'ONU', 'EE.UU.', 'Estados Unidos', 'Unión Europea', 'relaciones exteriores',
      'embajada', 'tránsito internacional', 'conflicto internacional', 'tratado',
      'OTAN', 'acuerdo internacional', 'cumbre', 'G7', 'G20', 'relaciones bilaterales',
      'multilateral', 'geopolítica', 'política exterior', 'cancillería', 'diplomático',
      'extranjero', 'mundial', 'global', 'internacional', 'frontera', 'migración internacional',
      'alianza', 'pacto', 'cooperación internacional', 'tensiones', 'crisis global',
      // Países y ciudades importantes
      'Francia', 'París', 'Londres', 'Berlín', 'Roma', 'Madrid', 'Tokio', 'Pekín', 'Moscú',
      'Rusia', 'China', 'Japón', 'Alemania', 'Italia', 'Reino Unido', 'España', 'México',
      'Brasil', 'Argentina', 'Venezuela', 'Colombia', 'Chile', 'Perú', 'Ecuador',
      // Cultura y patrimonio internacional
      'UNESCO', 'patrimonio mundial', 'patrimonio cultural', 'patrimonio de la humanidad',
      'catedral', 'Notre-Dame', 'Notre Dame', 'Vaticano', 'Louvre', 'Torre Eiffel',
      'Big Ben', 'Coliseo', 'Taj Mahal', 'Gran Muralla', 'Machu Picchu',
      'restauración', 'arquitectura', 'monumento', 'histórico', 'turismo',
      'incendio', 'reconstrucción', 'reapertura', 'inauguración'
    ],
    'Socio político': [
      // Protestas y movilizaciones
      'protesta', 'manifestación', 'marcha', 'movilización', 'paro', 'huelga',
      'bloqueo', 'plantón', 'sit-in', 'disturbios', 'revuelta', 'levantamiento',
      // Derechos humanos
      'derechos humanos', 'derechos civiles', 'libertades civiles',
      'libertad de expresión', 'libertad de prensa', 'libertad de reunión',
      'tortura', 'desaparición forzada', 'ejecución extrajudicial',
      'prisionero político', 'preso de conciencia', 'detención arbitraria',
      // Represión y persecución
      'represión', 'censura', 'persecución', 'intimidación', 'hostigamiento',
      'vigilancia', 'espionaje', 'opresión', 'abuso de poder', 'brutalidad policial',
      // Migración y refugio
      'migración', 'migrante', 'emigración', 'inmigración', 'refugiado',
      'asilo', 'exilio', 'exiliado', 'deportación', 'frontera', 'caravana',
      // Sociedad civil
      'sociedad civil', 'ONG', 'activismo', 'activista', 'disidencia', 'disidente',
      'organización social', 'movimiento social', 'organización comunitaria',
      'participación ciudadana', 'empoderamiento', 'base popular',
      // Justicia social
      'justicia social', 'desigualdad', 'discriminación', 'racismo', 'xenofobia',
      'machismo', 'feminismo', 'LGBTQ', 'minorías', 'marginación', 'exclusión',
      // Cuba específico
      'Movimiento San Isidro', '11J', '27N', 'Patria y Vida', 'UNPACU',
      'Damas de Blanco', 'opositor cubano', 'preso político cubano'
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
    'General': [],
    'Deporte': [
      // Deportes generales
      'deporte', 'deportivo', 'deportista', 'atleta', 'competición', 'competencia',
      'campeonato', 'torneo', 'liga', 'copa', 'mundial', 'olimpiadas', 'juegos olímpicos',
      // Fútbol
      'fútbol', 'futbol', 'soccer', 'FIFA', 'UEFA', 'Champions League', 'La Liga',
      'Premier League', 'Serie A', 'Bundesliga', 'MLS', 'gol', 'partido', 'estadio',
      'Real Madrid', 'Barcelona', 'Bayern', 'Manchester', 'PSG', 'Inter Miami',
      'Messi', 'Cristiano Ronaldo', 'Mbappé', 'Haaland', 'Neymar', 'Vinicius',
      // Béisbol
      'béisbol', 'beisbol', 'baseball', 'MLB', 'home run', 'pitcher', 'bateador',
      'Serie Mundial', 'Yankees', 'Dodgers', 'Red Sox',
      // Baloncesto
      'baloncesto', 'basquetbol', 'basketball', 'NBA', 'WNBA', 'canasta', 'triple',
      'Lakers', 'Celtics', 'Warriors', 'Heat', 'LeBron', 'Curry', 'Durant',
      // Boxeo y MMA
      'boxeo', 'box', 'boxing', 'UFC', 'MMA', 'pelea', 'combate', 'round',
      'nocaut', 'knockout', 'cinturón', 'peso pesado', 'Tyson', 'Canelo',
      // Tenis
      'tenis', 'tennis', 'ATP', 'WTA', 'Grand Slam', 'Wimbledon', 'US Open',
      'Roland Garros', 'Australian Open', 'Djokovic', 'Nadal', 'Federer', 'Alcaraz',
      // Automovilismo
      'F1', 'Fórmula 1', 'Formula 1', 'NASCAR', 'IndyCar', 'carrera', 'piloto',
      'Ferrari', 'Red Bull', 'Mercedes', 'McLaren', 'Hamilton', 'Verstappen',
      // Otros deportes
      'golf', 'PGA', 'natación', 'atletismo', 'ciclismo', 'Tour de Francia',
      'rugby', 'hockey', 'NFL', 'Super Bowl', 'voleibol', 'gimnasia',
      'esquí', 'surf', 'skateboard', 'maratón', 'triatlón'
    ]
  },

  // Descripciones para similitud semántica
  descriptions: {
    'Tecnología': 'Innovación tecnológica de alto impacto: inteligencia artificial (ChatGPT, OpenAI, Claude), criptomonedas (Bitcoin, Ethereum, Web3), ciberseguridad (hacks, brechas de datos), dispositivos (iPhone, Android), empresas tech (Apple, Google, Tesla, Meta, Nvidia), software, hardware, startups disruptivas, blockchain, cloud computing y transformación digital.',
    'Política': 'Gobierno, leyes, partidos políticos, decisiones políticas, administración pública, elecciones, reformas legislativas y gestión gubernamental.',
    'Economía': 'Mercados financieros, finanzas, precios, empleo, impuestos, comercio, indicadores económicos, inflación, PIB, banca y negocios.',
    'Internacional': 'Eventos y noticias internacionales: relaciones exteriores, geopolítica, diplomacia, tratados. Incluye eventos culturales y patrimonio mundial (UNESCO, catedrales, monumentos históricos, restauraciones). Países: Francia, París, Reino Unido, Alemania, Italia, Rusia, China, Japón, México, Brasil, Venezuela. Turismo internacional y eventos de relevancia global.',
    'Socio político': 'Dinámica social con dimensión política: protestas, derechos humanos, sociedad civil, movilizaciones, represión, migración y activismo.',
    'Tendencia': 'Contenido viral de alto impacto en redes sociales: TikTok, Instagram, YouTube, Twitter/X. Incluye influencers, celebridades, memes virales, challenges, escándalos digitales, fenómenos de cultura pop, streaming (Netflix, Spotify), gaming (esports, lanzamientos), outages masivos, tendencias de entretenimiento, videos con millones de vistas, controversias virales y cualquier tema que rompe internet o domina trending topics.',
    'General': 'Miscelánea sin predominio temático claro, contenido diverso o que abarca múltiples categorías sin enfoque principal.',
    'Deporte': 'Deportes y competiciones: fútbol (FIFA, Champions League, La Liga, MLS, Messi, Cristiano), béisbol (MLB), baloncesto (NBA, LeBron), boxeo y MMA (UFC), tenis (Grand Slam, Djokovic, Nadal), Fórmula 1 (F1, Ferrari, Red Bull), olimpiadas, mundiales, copas, torneos, atletas, equipos deportivos y eventos deportivos de cualquier disciplina.'
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
