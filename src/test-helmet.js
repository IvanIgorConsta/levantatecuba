// 📝 Script de prueba para verificar Helmet en la consola
// Pega este código en la consola del navegador cuando estés en una noticia

console.log('🔍 Verificando metadatos de Helmet...');

// Verificar título
const title = document.title;
console.log('📰 Título:', title);

// Verificar meta description
const description = document.querySelector('meta[name="description"]')?.content;
console.log('📝 Descripción:', description);

// Verificar Open Graph
const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
const ogImage = document.querySelector('meta[property="og:image"]')?.content;
const ogUrl = document.querySelector('meta[property="og:url"]')?.content;

console.log('🌐 Open Graph:');
console.log('  - Título:', ogTitle);
console.log('  - Imagen:', ogImage);
console.log('  - URL:', ogUrl);

// Verificar Twitter Cards
const twitterCard = document.querySelector('meta[name="twitter:card"]')?.content;
const twitterTitle = document.querySelector('meta[name="twitter:title"]')?.content;

console.log('🐦 Twitter Cards:');
console.log('  - Tipo:', twitterCard);
console.log('  - Título:', twitterTitle);

// Verificar que Helmet está funcionando
if (title && description && ogTitle) {
    console.log('✅ ¡Helmet funciona correctamente!');
} else {
    console.log('❌ Helmet no está funcionando - revisa la implementación');
}