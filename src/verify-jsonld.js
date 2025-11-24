// 🔍 Script para verificar JSON-LD en la consola del navegador
// Pega este código en la consola cuando estés en una noticia

console.log('🔍 Verificando JSON-LD Schema.org...');

// Buscar el script JSON-LD
const jsonLdScript = document.querySelector('script[type="application/ld+json"]');

if (jsonLdScript) {
    try {
        const jsonData = JSON.parse(jsonLdScript.textContent);
        console.log('✅ JSON-LD encontrado y válido:');
        console.log('📰 Tipo:', jsonData['@type']);
        console.log('📝 Headline:', jsonData.headline);
        console.log('🖼️ Imagen:', jsonData.image);
        console.log('👤 Autor:', jsonData.author?.name);
        console.log('🏢 Publisher:', jsonData.publisher?.name);
        console.log('📅 Fecha publicación:', jsonData.datePublished);
        console.log('🔗 URL:', jsonData.url);
        console.log('📄 Descripción:', jsonData.description?.substring(0, 50) + '...');
        
        // Verificar campos obligatorios
        const requiredFields = ['@context', '@type', 'headline', 'author', 'publisher', 'datePublished'];
        const missingFields = requiredFields.filter(field => !jsonData[field]);
        
        if (missingFields.length === 0) {
            console.log('🎉 ¡Todos los campos obligatorios están presentes!');
        } else {
            console.log('⚠️ Campos faltantes:', missingFields);
        }
        
    } catch (error) {
        console.log('❌ Error al parsear JSON-LD:', error);
    }
} else {
    console.log('❌ No se encontró JSON-LD en esta página');
    console.log('💡 Asegúrate de estar en una página de noticia específica');
}