// server/routes/store.js
const express = require('express');
const router = express.Router();

// Mock de productos iniciales
const mockProducts = [
  {
    id: 'prod_1',
    title: 'Camiseta Levántate Cuba',
    price: 25.00,
    image: '/img/productos/camiseta-levantatecuba.jpg',
    description: 'Camiseta de algodón premium con el logo de Levántate Cuba',
    variants: [
      { id: 'var_1', size: 'S', stock: 10 },
      { id: 'var_2', size: 'M', stock: 15 },
      { id: 'var_3', size: 'L', stock: 12 },
      { id: 'var_4', size: 'XL', stock: 8 }
    ],
    category: 'ropa',
    featured: true
  },
  {
    id: 'prod_2',
    title: 'Taza Resistencia',
    price: 15.00,
    image: '/img/productos/taza-resistencia.jpg',
    description: 'Taza de cerámica con mensaje de resistencia',
    variants: [
      { id: 'var_5', color: 'Negro', stock: 20 },
      { id: 'var_6', color: 'Blanco', stock: 25 }
    ],
    category: 'accesorios',
    featured: true
  },
  {
    id: 'prod_3',
    title: 'Pack de Stickers',
    price: 8.00,
    image: '/img/productos/stickers-pack.jpg',
    description: 'Pack de 10 stickers con diseños exclusivos',
    variants: [
      { id: 'var_7', type: 'Standard', stock: 50 }
    ],
    category: 'accesorios',
    featured: false
  },
  {
    id: 'prod_4',
    title: 'Gorra Libertad',
    price: 20.00,
    image: '/img/productos/gorra-libertad.jpg',
    description: 'Gorra ajustable con bordado de calidad',
    variants: [
      { id: 'var_8', color: 'Negro', stock: 15 },
      { id: 'var_9', color: 'Rojo', stock: 10 }
    ],
    category: 'accesorios',
    featured: true
  },
  {
    id: 'prod_5',
    title: 'Póster Cuba Libre',
    price: 12.00,
    image: '/img/productos/poster-cubalibre.jpg',
    description: 'Póster de alta calidad 40x60cm',
    variants: [
      { id: 'var_10', size: '40x60cm', stock: 30 }
    ],
    category: 'decoracion',
    featured: false
  },
  {
    id: 'prod_6',
    title: 'Sudadera Revolución',
    price: 45.00,
    image: '/img/productos/sudadera-revolucion.jpg',
    description: 'Sudadera con capucha, algodón premium',
    variants: [
      { id: 'var_11', size: 'M', stock: 8 },
      { id: 'var_12', size: 'L', stock: 10 },
      { id: 'var_13', size: 'XL', stock: 6 }
    ],
    category: 'ropa',
    featured: true
  }
];

// Almacenamiento temporal de órdenes (en producción usar DB)
let orders = [];

// GET /api/tienda/products - Obtener todos los productos
router.get('/products', async (req, res) => {
  try {
    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Filtros opcionales desde query params
    const { category, featured } = req.query;
    
    let filteredProducts = [...mockProducts];
    
    if (category) {
      filteredProducts = filteredProducts.filter(p => p.category === category);
    }
    
    if (featured === 'true') {
      filteredProducts = filteredProducts.filter(p => p.featured);
    }
    
    res.json({
      success: true,
      products: filteredProducts,
      total: filteredProducts.length
    });
    
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos'
    });
  }
});

// GET /api/tienda/products/:id - Obtener un producto específico
router.get('/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = mockProducts.find(p => p.id === id);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }
    
    res.json({
      success: true,
      product
    });
    
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener el producto'
    });
  }
});

// POST /api/tienda/checkout - Procesar pedido (pago manual)
router.post('/checkout', async (req, res) => {
  try {
    const { items, customer, paymentMethod = 'manual' } = req.body;
    
    // Validaciones básicas
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'El carrito está vacío'
      });
    }
    
    if (!customer || !customer.email || !customer.name) {
      return res.status(400).json({
        success: false,
        message: 'Información del cliente incompleta'
      });
    }
    
    // Calcular total
    let total = 0;
    const orderItems = [];
    
    for (const item of items) {
      const product = mockProducts.find(p => p.id === item.productId);
      if (!product) continue;
      
      const subtotal = product.price * item.quantity;
      total += subtotal;
      
      orderItems.push({
        productId: product.id,
        title: product.title,
        price: product.price,
        quantity: item.quantity,
        subtotal,
        variant: item.variant
      });
    }
    
    // Crear orden
    const order = {
      orderId: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      paymentMethod,
      customer,
      items: orderItems,
      total,
      createdAt: new Date().toISOString(),
      instructions: 'Recibirás un email con instrucciones de pago'
    };
    
    // Guardar orden (en producción usar DB)
    orders.push(order);
    
    // Simular delay de procesamiento
    await new Promise(resolve => setTimeout(resolve, 500));
    
    res.json({
      success: true,
      order,
      message: 'Pedido recibido. Te contactaremos pronto para confirmar el pago.'
    });
    
  } catch (error) {
    console.error('Error processing checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar el pedido'
    });
  }
});

// GET /api/tienda/categories - Obtener categorías
router.get('/categories', (req, res) => {
  const categories = [
    { id: 'ropa', name: 'Ropa', count: 2 },
    { id: 'accesorios', name: 'Accesorios', count: 3 },
    { id: 'decoracion', name: 'Decoración', count: 1 }
  ];
  
  res.json({
    success: true,
    categories
  });
});

// GET /api/tienda/orders/:orderId - Verificar estado de orden
router.get('/orders/:orderId', (req, res) => {
  try {
    const { orderId } = req.params;
    const order = orders.find(o => o.orderId === orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Orden no encontrada'
      });
    }
    
    res.json({
      success: true,
      order
    });
    
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la orden'
    });
  }
});

module.exports = router;

