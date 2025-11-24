# 🛍️ Tienda LevántateCuba - E-commerce con Medusa.js + Next.js

Tienda e-commerce completa para **LevántateCuba** construida con Medusa.js (backend) y Next.js 14 (frontend), con pago manual activo y opciones de Stripe/PayPal listas para activar.

![Version](https://img.shields.io/badge/version-1.0.0-red)
![Medusa](https://img.shields.io/badge/Medusa-1.20-purple)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Tailwind](https://img.shields.io/badge/Tailwind-3.3-blue)

## 🚀 Características

- ✅ **Backend Medusa.js** con catálogo de productos, inventario y órdenes
- ✅ **Frontend Next.js 14** con App Router y Tailwind CSS
- ✅ **Tema oscuro + rojo** acorde a LevántateCuba
- ✅ **Pago manual** habilitado por defecto
- ✅ **Stripe y PayPal** preconfigurados (listos para activar)
- ✅ **Carrito persistente** con localStorage
- ✅ **Checkout completo** con formulario de envío
- ✅ **Productos seed** incluidos (camiseta, taza, stickers)
- ✅ **Responsive** y optimizado para móviles

## 📁 Estructura del Proyecto

```
tienda/
├── backend/          # Servidor Medusa.js
│   ├── medusa-config.js
│   ├── package.json
│   ├── data/
│   │   └── seed.js
│   └── env.example
│
├── frontend/         # Storefront Next.js
│   ├── src/
│   │   ├── app/     # Páginas y rutas
│   │   ├── components/
│   │   ├── lib/     # Cliente Medusa
│   │   ├── store/   # Estado global (Zustand)
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── env.local.example
│
└── README.md
```

## 🔧 Instalación Local

### Prerrequisitos

- Node.js 18+ y npm/yarn
- Git
- PostgreSQL (opcional, puede usar SQLite para desarrollo)

### Paso 1: Clonar/Copiar el proyecto

```bash
# Si lo tienes en tu proyecto principal
cd C:\Dev\levantatecuba\tienda

# O clona desde un repositorio
git clone https://github.com/tu-usuario/tienda-levantatecuba.git
cd tienda-levantatecuba
```

### Paso 2: Configurar Backend (Medusa)

```bash
# Navegar al backend
cd backend

# Instalar dependencias
npm install

# Copiar archivo de configuración
cp env.example .env

# Editar .env con tus valores
# Por defecto usa SQLite, no requiere configuración adicional
```

**Configuración básica en `.env`:**
```env
NODE_ENV=development
PORT=9000
JWT_SECRET=tu-secreto-jwt-aqui-32-caracteres-minimo
COOKIE_SECRET=tu-secreto-cookie-aqui-32-caracteres
DATABASE_URL=sqlite://./medusa.db
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:7000
```

```bash
# Inicializar base de datos
npx medusa migrations run

# Cargar datos seed
npm run seed

# Iniciar servidor de desarrollo
npm run dev
```

✅ Backend corriendo en: http://localhost:9000

### Paso 3: Configurar Frontend (Next.js)

```bash
# En otra terminal, navegar al frontend
cd ../frontend

# Instalar dependencias
npm install

# Copiar archivo de configuración
cp env.local.example .env.local

# Iniciar servidor de desarrollo
npm run dev
```

✅ Frontend corriendo en: http://localhost:3000

### Paso 4: Crear usuario admin (opcional)

```bash
# En la carpeta backend
npx medusa user -e admin@levantatecuba.com -p supersecret
```

Admin panel disponible en: http://localhost:7000

## 💳 Configuración de Métodos de Pago

### Pago Manual (Activo por defecto)

No requiere configuración. Las órdenes quedan en estado "pending" y puedes enviar instrucciones de pago por email.

### Activar Stripe

1. Obtén tus claves desde [Stripe Dashboard](https://dashboard.stripe.com/apikeys)

2. En `backend/.env`, descomenta y agrega:
```env
STRIPE_SECRET_KEY=sk_test_tu_clave_aqui
STRIPE_WEBHOOK_SECRET=whsec_tu_webhook_secret
```

3. Reinicia el servidor backend

4. En el checkout, aparecerá la opción de pago con tarjeta

### Activar PayPal

1. Obtén credenciales desde [PayPal Developer](https://developer.paypal.com)

2. En `backend/.env`, descomenta y agrega:
```env
PAYPAL_CLIENT_ID=tu_client_id
PAYPAL_CLIENT_SECRET=tu_client_secret
PAYPAL_SANDBOX=true  # false para producción
```

3. Reinicia el servidor backend

## 🌐 Integración con LevántateCuba

En tu proyecto principal de LevántateCuba:

1. Agrega la variable de entorno:
```env
VITE_STORE_URL=http://localhost:3000  # Desarrollo
VITE_STORE_URL=https://tienda.tudominio.com  # Producción
```

2. En tu componente de navegación:
```jsx
<a href={import.meta.env.VITE_STORE_URL} target="_blank">
  Tienda
</a>
```

## 🚀 Despliegue a Producción

### Backend - Opción 1: Railway

1. Crea cuenta en [Railway](https://railway.app)

2. Nuevo proyecto desde GitHub

3. Agrega servicio PostgreSQL

4. Variables de entorno:
```env
NODE_ENV=production
DATABASE_URL=[Proporcionado por Railway]
JWT_SECRET=[Genera uno seguro]
COOKIE_SECRET=[Genera uno seguro]
STORE_CORS=https://tienda.tudominio.com
ADMIN_CORS=https://admin.tudominio.com
# Agregar Stripe/PayPal si están activos
```

5. Deploy automático al hacer push

### Backend - Opción 2: Render

1. Crea cuenta en [Render](https://render.com)

2. New Web Service → Connect GitHub

3. Configuración:
   - Build Command: `npm install && npx medusa migrations run`
   - Start Command: `npm start`
   - Environment: Node
   - Instance Type: Mínimo $7/mes

4. Agrega las mismas variables de entorno

### Frontend - Opción 1: Vercel

1. Instala Vercel CLI:
```bash
npm i -g vercel
```

2. Desde la carpeta frontend:
```bash
vercel
```

3. O conecta con GitHub desde [Vercel Dashboard](https://vercel.com)

4. Variables de entorno:
```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://tu-backend.railway.app
NEXT_PUBLIC_MAIN_SITE_URL=https://levantatecuba.com
```

### Frontend - Opción 2: Netlify

1. Build settings:
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `.next`

2. Mismas variables de entorno que Vercel

## 📊 Panel de Administración

Medusa incluye un panel de administración para gestionar:
- Productos y variantes
- Órdenes
- Clientes
- Descuentos
- Configuración

Acceso en desarrollo: http://localhost:7000
Acceso en producción: https://admin.tudominio.com

## 🔒 Seguridad

### Recomendaciones importantes:

1. **JWT Secrets**: Usa secretos de mínimo 32 caracteres aleatorios
2. **CORS**: Configura solo los dominios necesarios
3. **Rate Limiting**: Implementa límites en el checkout
4. **Validación**: El frontend valida inputs, pero siempre valida en backend
5. **HTTPS**: Usa siempre HTTPS en producción
6. **Backups**: Configura backups automáticos de la base de datos

### Headers de seguridad recomendados:

```javascript
// next.config.js
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        {
          key: 'X-Frame-Options',
          value: 'DENY',
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff',
        },
        {
          key: 'X-XSS-Protection',
          value: '1; mode=block',
        },
      ],
    },
  ]
}
```

## 🛠️ Personalización

### Cambiar colores del tema

En `frontend/tailwind.config.ts`:
```javascript
colors: {
  primary: {
    DEFAULT: '#ef4444', // Cambiar color principal
    dark: '#dc2626',
    light: '#f87171',
  },
}
```

### Agregar nuevos productos

1. Edita `backend/data/seed.js` con tus productos
2. Ejecuta `npm run seed`
3. O usa el panel de admin

### Modificar checkout

Los componentes están en:
- `frontend/src/app/checkout/page.tsx` - Página principal
- `frontend/src/components/CheckoutForm.tsx` - Formulario

### Agregar método de envío

En `backend/medusa-config.js`, agrega fulfillment providers:
```javascript
{
  resolve: "medusa-fulfillment-manual",
  options: {
    // configuración
  }
}
```

## 📝 Scripts Útiles

### Backend
```bash
npm run dev        # Desarrollo con hot-reload
npm run build      # Compilar para producción
npm run start      # Iniciar en producción
npm run seed       # Cargar datos de ejemplo
npm run migrate    # Ejecutar migraciones
```

### Frontend
```bash
npm run dev        # Desarrollo
npm run build      # Compilar
npm run start      # Producción
npm run lint       # Verificar código
npm run format     # Formatear con Prettier
```

## 🐛 Solución de Problemas

### Error: "Cannot connect to database"
- Verifica que PostgreSQL esté corriendo
- O usa SQLite cambiando DATABASE_URL a `sqlite://./medusa.db`

### Error: "CORS blocked"
- Verifica las variables STORE_CORS y ADMIN_CORS
- Asegúrate de incluir el protocolo (http:// o https://)

### El carrito se vacía al recargar
- Verifica que localStorage esté habilitado
- Revisa la consola del navegador por errores

### Stripe/PayPal no aparecen
- Confirma que las variables de entorno estén configuradas
- Reinicia el servidor backend después de cambios
- Verifica los logs del servidor

## 🤝 Soporte

- Email: tienda@levantatecuba.com
- Issues: [GitHub Issues](https://github.com/levantatecuba/tienda/issues)
- Documentación Medusa: [docs.medusajs.com](https://docs.medusajs.com)
- Documentación Next.js: [nextjs.org/docs](https://nextjs.org/docs)

## 📄 Licencia

MIT - Libre para usar y modificar

---

Hecho con ❤️ para la libertad de Cuba 🇨🇺
