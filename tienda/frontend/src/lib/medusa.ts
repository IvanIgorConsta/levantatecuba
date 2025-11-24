import Medusa from "@medusajs/medusa-js"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

export const medusaClient = new Medusa({
  baseUrl: BACKEND_URL,
  maxRetries: 3,
})

// Funciones de utilidad para productos
export async function getProducts() {
  try {
    const { products } = await medusaClient.products.list({
      limit: 100,
    })
    return products
  } catch (error) {
    console.error("Error fetching products:", error)
    return []
  }
}

export async function getProductByHandle(handle: string) {
  try {
    const { products } = await medusaClient.products.list({
      handle,
      limit: 1,
    })
    return products[0] || null
  } catch (error) {
    console.error("Error fetching product:", error)
    return null
  }
}

// Funciones de utilidad para el carrito
export async function createCart() {
  try {
    const { cart } = await medusaClient.carts.create()
    return cart
  } catch (error) {
    console.error("Error creating cart:", error)
    return null
  }
}

export async function addToCart(cartId: string, variantId: string, quantity: number = 1) {
  try {
    const { cart } = await medusaClient.carts.lineItems.create(cartId, {
      variant_id: variantId,
      quantity,
    })
    return cart
  } catch (error) {
    console.error("Error adding to cart:", error)
    return null
  }
}

export async function updateLineItem(cartId: string, lineItemId: string, quantity: number) {
  try {
    const { cart } = await medusaClient.carts.lineItems.update(cartId, lineItemId, {
      quantity,
    })
    return cart
  } catch (error) {
    console.error("Error updating line item:", error)
    return null
  }
}

export async function removeFromCart(cartId: string, lineItemId: string) {
  try {
    const { cart } = await medusaClient.carts.lineItems.delete(cartId, lineItemId)
    return cart
  } catch (error) {
    console.error("Error removing from cart:", error)
    return null
  }
}

export async function getCart(cartId: string) {
  try {
    const { cart } = await medusaClient.carts.retrieve(cartId)
    return cart
  } catch (error) {
    console.error("Error retrieving cart:", error)
    return null
  }
}

// Funciones para checkout
export async function addShippingAddress(cartId: string, address: any) {
  try {
    const { cart } = await medusaClient.carts.update(cartId, {
      shipping_address: address,
      billing_address: address,
    })
    return cart
  } catch (error) {
    console.error("Error adding shipping address:", error)
    return null
  }
}

export async function addShippingMethod(cartId: string, optionId: string) {
  try {
    const { cart } = await medusaClient.carts.addShippingMethod(cartId, {
      option_id: optionId,
    })
    return cart
  } catch (error) {
    console.error("Error adding shipping method:", error)
    return null
  }
}

export async function completeCart(cartId: string) {
  try {
    const { order } = await medusaClient.carts.complete(cartId)
    return order
  } catch (error) {
    console.error("Error completing cart:", error)
    return null
  }
}

export async function createPaymentSessions(cartId: string) {
  try {
    const { cart } = await medusaClient.carts.createPaymentSessions(cartId)
    return cart
  } catch (error) {
    console.error("Error creating payment sessions:", error)
    return null
  }
}

export async function setPaymentSession(cartId: string, providerId: string) {
  try {
    const { cart } = await medusaClient.carts.setPaymentSession(cartId, {
      provider_id: providerId,
    })
    return cart
  } catch (error) {
    console.error("Error setting payment session:", error)
    return null
  }
}

// Funciones para regiones y opciones de envío
export async function getRegions() {
  try {
    const { regions } = await medusaClient.regions.list()
    return regions
  } catch (error) {
    console.error("Error fetching regions:", error)
    return []
  }
}

export async function getShippingOptions(cartId: string) {
  try {
    const { shipping_options } = await medusaClient.shippingOptions.listCartOptions(cartId)
    return shipping_options
  } catch (error) {
    console.error("Error fetching shipping options:", error)
    return []
  }
}
