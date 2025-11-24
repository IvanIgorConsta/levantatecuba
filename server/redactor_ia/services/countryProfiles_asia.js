// server/redactor_ia/services/countryProfiles_asia.js
module.exports = {
  'Japón': {
    code: 'JP', region: 'Asia Oriental',
    city_style: 'Metrópolis densas con neones, templos tradicionales',
    architecture: 'Tradicional de madera, ultra-moderna, neones',
    climate: 'Templado, monzónico',
    people_style: 'Población japonesa',
    environment: 'Urbano denso, templos, montañas (Fuji)',
    colors: 'Rojo torii, blanco shinto, neón rosa-azul',
    flags_allowed: ['bandera japonesa (círculo rojo en blanco)'],
    flags_forbidden: ['bandera china', 'bandera coreana'],
    skyline_forbidden: ['Seúl', 'Shanghai']
  },
  'China': {
    code: 'CN', region: 'Asia Oriental',
    city_style: 'Metrópolis masivas ultra-modernas',
    architecture: 'Rascacielos futuristas, imperial histórica',
    climate: 'Variado según región',
    people_style: 'Población china',
    environment: 'Urbano masivo, rascacielos, contaminación',
    colors: 'Rojo chino, dorado imperial, gris urbano',
    flags_allowed: ['bandera china (roja con estrellas amarillas)'],
    flags_forbidden: ['bandera taiwanesa', 'bandera hongkonesa', 'bandera japonesa'],
    skyline_forbidden: ['Tokio', 'Seúl']
  },
  'Corea del Sur': {
    code: 'KR', region: 'Asia Oriental',
    city_style: 'Ciudades ultra-modernas con tecnología',
    architecture: 'Futurista, vidrio, high-tech',
    climate: 'Templado monzónico',
    people_style: 'Población coreana',
    environment: 'Urbano tecnológico, montañas',
    colors: 'Azul tecnológico, blanco moderno, neón',
    flags_allowed: ['bandera surcoreana (yin-yang con trigramas)'],
    flags_forbidden: ['bandera norcoreana', 'bandera japonesa', 'bandera china'],
    skyline_forbidden: ['Pyongyang', 'Tokio']
  },
  'Corea del Norte': {
    code: 'KP', region: 'Asia Oriental',
    city_style: 'Ciudad autoritaria con arquitectura monumental soviética',
    architecture: 'Soviética monumental, juche, propaganda',
    climate: 'Continental',
    people_style: 'Población coreana, vestimenta uniforme',
    environment: 'Urbano controlado, monumentos gigantes',
    colors: 'Gris cemento, rojo propaganda',
    flags_allowed: ['bandera norcoreana (roja, azul con estrella)'],
    flags_forbidden: ['bandera surcoreana', 'bandera estadounidense'],
    skyline_forbidden: ['Seúl', 'Tokio']
  },
  'India': {
    code: 'IN', region: 'Asia del Sur',
    city_style: 'Ciudades densas y caóticas con templos y rascacielos',
    architecture: 'Mogol histórica, colonial británica, contemporánea caótica',
    climate: 'Tropical monzónico',
    people_style: 'Población india diversa, vestimenta tradicional y moderna',
    environment: 'Urbano denso, templos, ríos sagrados',
    colors: 'Azafrán, verde bandera, multicolor',
    flags_allowed: ['bandera india (azafrán, blanco, verde con rueda)'],
    flags_forbidden: ['bandera pakistaní', 'bandera bangladesh'],
    skyline_forbidden: ['Karachi', 'Dhaka']
  }
};
