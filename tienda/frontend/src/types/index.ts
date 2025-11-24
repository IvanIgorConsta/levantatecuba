export interface Product {
  id: string
  title: string
  handle: string
  description: string | null
  status: string
  thumbnail: string | null
  images: ProductImage[]
  options: ProductOption[]
  variants: ProductVariant[]
  collection?: ProductCollection
  type?: ProductType
  tags?: ProductTag[]
  created_at: string
  updated_at: string
}

export interface ProductImage {
  id?: string
  url: string
  alt?: string
}

export interface ProductOption {
  id: string
  title: string
  values: ProductOptionValue[]
}

export interface ProductOptionValue {
  id?: string
  value: string
  option_id?: string
}

export interface ProductVariant {
  id: string
  title: string
  product_id: string
  prices: Price[]
  options: ProductVariantOption[]
  inventory_quantity?: number
  manage_inventory?: boolean
  sku?: string
  barcode?: string
  weight?: number
  length?: number
  height?: number
  width?: number
  origin_country?: string
  material?: string
}

export interface ProductVariantOption {
  id?: string
  value: string
  option_id?: string
  variant_id?: string
}

export interface Price {
  id?: string
  currency_code: string
  amount: number
  variant_id?: string
}

export interface ProductCollection {
  id: string
  title: string
  handle: string
}

export interface ProductType {
  id?: string
  value: string
}

export interface ProductTag {
  id: string
  value: string
}

export interface Cart {
  id: string
  items: LineItem[]
  region?: Region
  shipping_address?: Address
  billing_address?: Address
  shipping_methods?: ShippingMethod[]
  payment_sessions?: PaymentSession[]
  payment?: Payment
  subtotal?: number
  tax_total?: number
  shipping_total?: number
  discount_total?: number
  total?: number
}

export interface LineItem {
  id: string
  cart_id: string
  title: string
  description?: string
  thumbnail?: string
  quantity: number
  unit_price: number
  total: number
  variant: ProductVariant
}

export interface Region {
  id: string
  name: string
  currency_code: string
  tax_rate: number
  countries: Country[]
  payment_providers: PaymentProvider[]
  fulfillment_providers: FulfillmentProvider[]
}

export interface Country {
  id: string
  iso_2: string
  iso_3: string
  num_code: number
  name: string
  display_name: string
}

export interface Address {
  first_name: string
  last_name: string
  address_1: string
  address_2?: string
  city: string
  province?: string
  postal_code: string
  country_code: string
  phone?: string
  company?: string
}

export interface ShippingMethod {
  id: string
  shipping_option_id: string
  price: number
}

export interface ShippingOption {
  id: string
  name: string
  region_id: string
  profile_id: string
  provider_id: string
  price_type: string
  amount: number
  is_return: boolean
  data: any
}

export interface PaymentSession {
  id: string
  cart_id: string
  provider_id: string
  is_selected: boolean
  status: string
  data: any
}

export interface PaymentProvider {
  id: string
  is_installed: boolean
}

export interface FulfillmentProvider {
  id: string
  is_installed: boolean
}

export interface Payment {
  id: string
  amount: number
  currency_code: string
  provider_id: string
}

export interface Order {
  id: string
  status: string
  display_id: number
  cart_id: string
  customer?: Customer
  email: string
  billing_address?: Address
  shipping_address?: Address
  region?: Region
  currency_code: string
  tax_rate?: number
  items: LineItem[]
  shipping_methods?: ShippingMethod[]
  payments?: Payment[]
  subtotal?: number
  tax_total?: number
  shipping_total?: number
  discount_total?: number
  total?: number
  created_at: string
}

export interface Customer {
  id: string
  email: string
  first_name?: string
  last_name?: string
  phone?: string
}
