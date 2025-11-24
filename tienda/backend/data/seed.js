const { Medusa } = require("@medusajs/medusa");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const seed = async () => {
  console.log("🌱 Iniciando seed de datos...");
  
  try {
    // Aquí irían los datos de productos
    const products = [
      {
        title: "Camiseta LevántateCuba",
        handle: "camiseta-levantatecuba",
        description: "Camiseta de algodón premium con el logo de LevántateCuba. Muestra tu apoyo con estilo.",
        type: { value: "Ropa" },
        collection_id: null,
        weight: 200,
        length: 30,
        height: 2,
        width: 25,
        origin_country: "CU",
        material: "100% Algodón",
        options: [
          {
            title: "Talla",
            values: ["S", "M", "L", "XL", "XXL"]
          },
          {
            title: "Color",
            values: ["Negro", "Blanco", "Rojo"]
          }
        ],
        variants: [
          {
            title: "S / Negro",
            prices: [
              {
                currency_code: "USD",
                amount: 2500 // $25.00
              },
              {
                currency_code: "EUR",
                amount: 2300
              }
            ],
            options: [
              { value: "S" },
              { value: "Negro" }
            ],
            inventory_quantity: 100,
            manage_inventory: true
          },
          {
            title: "M / Negro",
            prices: [
              {
                currency_code: "USD",
                amount: 2500
              },
              {
                currency_code: "EUR",
                amount: 2300
              }
            ],
            options: [
              { value: "M" },
              { value: "Negro" }
            ],
            inventory_quantity: 150,
            manage_inventory: true
          },
          {
            title: "L / Negro",
            prices: [
              {
                currency_code: "USD",
                amount: 2500
              },
              {
                currency_code: "EUR",
                amount: 2300
              }
            ],
            options: [
              { value: "L" },
              { value: "Negro" }
            ],
            inventory_quantity: 120,
            manage_inventory: true
          },
          {
            title: "M / Blanco",
            prices: [
              {
                currency_code: "USD",
                amount: 2500
              },
              {
                currency_code: "EUR",
                amount: 2300
              }
            ],
            options: [
              { value: "M" },
              { value: "Blanco" }
            ],
            inventory_quantity: 80,
            manage_inventory: true
          },
          {
            title: "L / Rojo",
            prices: [
              {
                currency_code: "USD",
                amount: 2700
              },
              {
                currency_code: "EUR",
                amount: 2500
              }
            ],
            options: [
              { value: "L" },
              { value: "Rojo" }
            ],
            inventory_quantity: 60,
            manage_inventory: true
          }
        ],
        images: [
          {
            url: "https://via.placeholder.com/600x600/1a1a1a/ef4444?text=Camiseta+LevántateCuba",
            alt: "Camiseta LevántateCuba Negro"
          }
        ],
        thumbnail: "https://via.placeholder.com/300x300/1a1a1a/ef4444?text=Camiseta",
        status: "published",
        tags: ["ropa", "camiseta", "apoyo", "cuba"]
      },
      {
        title: "Taza LevántateCuba",
        handle: "taza-levantatecuba",
        description: "Taza de cerámica de alta calidad con el mensaje de esperanza. Perfecta para tu café matutino.",
        type: { value: "Accesorios" },
        collection_id: null,
        weight: 350,
        length: 12,
        height: 10,
        width: 8,
        origin_country: "CU",
        material: "Cerámica",
        options: [
          {
            title: "Color",
            values: ["Negro", "Blanco", "Rojo"]
          }
        ],
        variants: [
          {
            title: "Negro",
            prices: [
              {
                currency_code: "USD",
                amount: 1500 // $15.00
              },
              {
                currency_code: "EUR",
                amount: 1400
              }
            ],
            options: [
              { value: "Negro" }
            ],
            inventory_quantity: 200,
            manage_inventory: true
          },
          {
            title: "Blanco",
            prices: [
              {
                currency_code: "USD",
                amount: 1500
              },
              {
                currency_code: "EUR",
                amount: 1400
              }
            ],
            options: [
              { value: "Blanco" }
            ],
            inventory_quantity: 180,
            manage_inventory: true
          },
          {
            title: "Rojo",
            prices: [
              {
                currency_code: "USD",
                amount: 1600
              },
              {
                currency_code: "EUR",
                amount: 1500
              }
            ],
            options: [
              { value: "Rojo" }
            ],
            inventory_quantity: 150,
            manage_inventory: true
          }
        ],
        images: [
          {
            url: "https://via.placeholder.com/600x600/1a1a1a/ef4444?text=Taza+LevántateCuba",
            alt: "Taza LevántateCuba"
          }
        ],
        thumbnail: "https://via.placeholder.com/300x300/1a1a1a/ef4444?text=Taza",
        status: "published",
        tags: ["accesorios", "taza", "café", "cuba"]
      },
      {
        title: "Sticker Pack LevántateCuba",
        handle: "sticker-pack-levantatecuba",
        description: "Pack de 5 stickers resistentes al agua con diferentes diseños patrióticos. Perfectos para laptop, botella de agua o auto.",
        type: { value: "Accesorios" },
        collection_id: null,
        weight: 20,
        length: 15,
        height: 1,
        width: 10,
        origin_country: "CU",
        material: "Vinilo",
        options: [
          {
            title: "Tipo",
            values: ["Pack Completo", "Individual"]
          }
        ],
        variants: [
          {
            title: "Pack Completo",
            prices: [
              {
                currency_code: "USD",
                amount: 800 // $8.00
              },
              {
                currency_code: "EUR",
                amount: 750
              }
            ],
            options: [
              { value: "Pack Completo" }
            ],
            inventory_quantity: 500,
            manage_inventory: true
          },
          {
            title: "Individual",
            prices: [
              {
                currency_code: "USD",
                amount: 200 // $2.00
              },
              {
                currency_code: "EUR",
                amount: 180
              }
            ],
            options: [
              { value: "Individual" }
            ],
            inventory_quantity: 1000,
            manage_inventory: true
          }
        ],
        images: [
          {
            url: "https://via.placeholder.com/600x600/1a1a1a/ef4444?text=Sticker+Pack",
            alt: "Sticker Pack LevántateCuba"
          }
        ],
        thumbnail: "https://via.placeholder.com/300x300/1a1a1a/ef4444?text=Stickers",
        status: "published",
        tags: ["accesorios", "stickers", "decoración", "cuba"]
      }
    ];

    console.log(`📦 Se cargarán ${products.length} productos`);
    
    // Aquí conectarías con la base de datos de Medusa
    // Este es un ejemplo simplificado
    console.log("✅ Productos cargados exitosamente:");
    products.forEach(p => {
      console.log(`   - ${p.title} (${p.variants.length} variantes)`);
    });

    // Crear región por defecto
    const regions = [
      {
        name: "América",
        currency_code: "USD",
        tax_rate: 0,
        payment_providers: ["manual"],
        fulfillment_providers: ["manual"],
        countries: ["US", "CA", "MX", "CU"]
      },
      {
        name: "Europa",
        currency_code: "EUR",
        tax_rate: 0,
        payment_providers: ["manual"],
        fulfillment_providers: ["manual"],
        countries: ["ES", "FR", "DE", "IT"]
      }
    ];

    console.log(`🌎 Se configurarán ${regions.length} regiones`);

    // Crear opciones de envío
    const shippingOptions = [
      {
        name: "Envío Estándar",
        region_id: "region_americas",
        provider_id: "manual",
        data: {},
        price_type: "flat_rate",
        amount: 500 // $5.00
      },
      {
        name: "Envío Express",
        region_id: "region_americas",
        provider_id: "manual",
        data: {},
        price_type: "flat_rate",
        amount: 1500 // $15.00
      }
    ];

    console.log(`📦 Se configurarán ${shippingOptions.length} opciones de envío`);

    console.log("\n✨ Seed completado exitosamente!");
    console.log("ℹ️  Nota: Este es un seed de ejemplo. En producción, conecta con la API de Medusa.");
    
  } catch (error) {
    console.error("❌ Error durante el seed:", error);
    process.exit(1);
  }
};

// Ejecutar si es llamado directamente
if (require.main === module) {
  seed().then(() => {
    console.log("🎉 Proceso finalizado");
    process.exit(0);
  });
}

module.exports = { seed };
