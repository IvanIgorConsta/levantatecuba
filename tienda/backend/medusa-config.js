const dotenv = require("dotenv");

let ENV_FILE_NAME = "";
switch (process.env.NODE_ENV) {
  case "production":
    ENV_FILE_NAME = ".env.production";
    break;
  case "staging":
    ENV_FILE_NAME = ".env.staging";
    break;
  case "test":
    ENV_FILE_NAME = ".env.test";
    break;
  case "development":
  default:
    ENV_FILE_NAME = ".env";
    break;
}

try {
  dotenv.config({ path: process.cwd() + "/" + ENV_FILE_NAME });
} catch (e) {}

// CORS configuración para frontend
const ADMIN_CORS = process.env.ADMIN_CORS || "http://localhost:7000,http://localhost:7001";
const STORE_CORS = process.env.STORE_CORS || "http://localhost:3000,http://localhost:5173";
const DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/medusa-store";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// Plugins base siempre activos
const plugins = [
  `medusa-fulfillment-manual`,
  `medusa-payment-manual`,
  {
    resolve: `@medusajs/file-local`,
    options: {
      upload_dir: "uploads",
    },
  },
  {
    resolve: "@medusajs/admin",
    /** @type {import('@medusajs/admin').PluginOptions} */
    options: {
      autoRebuild: true,
      develop: {
        open: process.env.OPEN_BROWSER !== "false",
      },
    },
  },
];

// Configuración condicional de Stripe
if (process.env.STRIPE_SECRET_KEY) {
  plugins.push({
    resolve: `medusa-payment-stripe`,
    options: {
      api_key: process.env.STRIPE_SECRET_KEY,
      webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
      // Configuración de pago
      capture: true, // Captura automática
      payment_description: "Compra en LevántateCuba Store",
    },
  });
  console.log("✅ Stripe payment plugin habilitado");
} else {
  console.log("ℹ️ Stripe deshabilitado - Configure STRIPE_SECRET_KEY para activar");
}

// Configuración condicional de PayPal
if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  plugins.push({
    resolve: `medusa-payment-paypal`,
    options: {
      client_id: process.env.PAYPAL_CLIENT_ID,
      client_secret: process.env.PAYPAL_CLIENT_SECRET,
      sandbox: process.env.PAYPAL_SANDBOX === "true",
      capture: true,
    },
  });
  console.log("✅ PayPal payment plugin habilitado");
} else {
  console.log("ℹ️ PayPal deshabilitado - Configure PAYPAL_CLIENT_ID y PAYPAL_CLIENT_SECRET para activar");
}

const modules = {
  eventBus: {
    resolve: "@medusajs/event-bus-local",
  },
  cacheService: {
    resolve: "@medusajs/cache-inmemory",
  },
};

/** @type {import('@medusajs/medusa').ConfigModule["projectConfig"]} */
const projectConfig = {
  jwtSecret: process.env.JWT_SECRET || "supersecret",
  cookieSecret: process.env.COOKIE_SECRET || "supersecret",
  store_cors: STORE_CORS,
  database_url: DATABASE_URL,
  admin_cors: ADMIN_CORS,
  redis_url: REDIS_URL,
};

/** @type {import('@medusajs/medusa').ConfigModule} */
module.exports = {
  projectConfig,
  plugins,
  modules,
  featureFlags: {
    product_categories: true,
  },
};
