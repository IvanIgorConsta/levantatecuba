'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/utils/format'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import Image from 'next/image'
import toast from 'react-hot-toast'

interface CheckoutFormData {
  email: string
  firstName: string
  lastName: string
  address: string
  apartment?: string
  city: string
  country: string
  state: string
  postalCode: string
  phone?: string
  shippingMethod: string
  paymentMethod: string
}

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getSubtotal, clearCart } = useCartStore()
  const [isProcessing, setIsProcessing] = useState(false)
  const subtotal = getSubtotal()
  const shippingCost = 500 // $5.00 en centavos
  const total = subtotal + shippingCost

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CheckoutFormData>({
    defaultValues: {
      country: 'US',
      shippingMethod: 'standard',
      paymentMethod: 'manual',
    },
  })

  useEffect(() => {
    // Si no hay items en el carrito, redirigir a home
    if (items.length === 0) {
      router.push('/')
    }
  }, [items, router])

  const onSubmit = async (data: CheckoutFormData) => {
    setIsProcessing(true)
    
    try {
      // Simular procesamiento de orden
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Aquí normalmente harías la llamada a la API de Medusa
      console.log('Orden procesada:', {
        ...data,
        items,
        total,
      })
      
      // Limpiar carrito
      clearCart()
      
      // Redirigir a página de éxito
      toast.success('¡Orden procesada exitosamente!')
      router.push('/success')
    } catch (error) {
      toast.error('Error al procesar la orden')
      console.error(error)
    } finally {
      setIsProcessing(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Volver a la tienda
          </Link>
          <h1 className="text-3xl font-bold text-white">Checkout</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Formulario de Checkout */}
          <div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Información de Contacto */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">
                  Información de contacto
                </h2>
                <div>
                  <input
                    {...register('email', {
                      required: 'Email requerido',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Email inválido',
                      },
                    })}
                    type="email"
                    placeholder="Email"
                    className="input-field w-full"
                  />
                  {errors.email && (
                    <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
                  )}
                </div>
              </div>

              {/* Dirección de Envío */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">
                  Dirección de envío
                </h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        {...register('firstName', { required: 'Nombre requerido' })}
                        type="text"
                        placeholder="Nombre"
                        className="input-field w-full"
                      />
                      {errors.firstName && (
                        <p className="text-red-400 text-sm mt-1">{errors.firstName.message}</p>
                      )}
                    </div>
                    <div>
                      <input
                        {...register('lastName', { required: 'Apellido requerido' })}
                        type="text"
                        placeholder="Apellido"
                        className="input-field w-full"
                      />
                      {errors.lastName && (
                        <p className="text-red-400 text-sm mt-1">{errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <input
                    {...register('address', { required: 'Dirección requerida' })}
                    type="text"
                    placeholder="Dirección"
                    className="input-field w-full"
                  />
                  {errors.address && (
                    <p className="text-red-400 text-sm mt-1">{errors.address.message}</p>
                  )}

                  <input
                    {...register('apartment')}
                    type="text"
                    placeholder="Apartamento, suite, etc. (opcional)"
                    className="input-field w-full"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        {...register('city', { required: 'Ciudad requerida' })}
                        type="text"
                        placeholder="Ciudad"
                        className="input-field w-full"
                      />
                      {errors.city && (
                        <p className="text-red-400 text-sm mt-1">{errors.city.message}</p>
                      )}
                    </div>
                    <div>
                      <select
                        {...register('country', { required: 'País requerido' })}
                        className="input-field w-full"
                      >
                        <option value="US">Estados Unidos</option>
                        <option value="CA">Canadá</option>
                        <option value="MX">México</option>
                        <option value="ES">España</option>
                        <option value="FR">Francia</option>
                        <option value="DE">Alemania</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <input
                        {...register('state', { required: 'Estado/Provincia requerido' })}
                        type="text"
                        placeholder="Estado/Provincia"
                        className="input-field w-full"
                      />
                      {errors.state && (
                        <p className="text-red-400 text-sm mt-1">{errors.state.message}</p>
                      )}
                    </div>
                    <div>
                      <input
                        {...register('postalCode', { required: 'Código postal requerido' })}
                        type="text"
                        placeholder="Código postal"
                        className="input-field w-full"
                      />
                      {errors.postalCode && (
                        <p className="text-red-400 text-sm mt-1">{errors.postalCode.message}</p>
                      )}
                    </div>
                  </div>

                  <input
                    {...register('phone')}
                    type="tel"
                    placeholder="Teléfono (opcional)"
                    className="input-field w-full"
                  />
                </div>
              </div>

              {/* Método de Envío */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">
                  Método de envío
                </h2>
                <div className="space-y-2">
                  <label className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        {...register('shippingMethod')}
                        type="radio"
                        value="standard"
                        className="text-red-500 focus:ring-red-500"
                      />
                      <div>
                        <p className="text-white font-medium">Envío estándar</p>
                        <p className="text-zinc-400 text-sm">5-7 días hábiles</p>
                      </div>
                    </div>
                    <span className="text-white font-medium">{formatPrice(500, 'USD')}</span>
                  </label>

                  <label className="flex items-center justify-between p-4 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer opacity-50">
                    <div className="flex items-center gap-3">
                      <input
                        {...register('shippingMethod')}
                        type="radio"
                        value="express"
                        disabled
                        className="text-red-500 focus:ring-red-500"
                      />
                      <div>
                        <p className="text-white font-medium">Envío express</p>
                        <p className="text-zinc-400 text-sm">2-3 días hábiles (Próximamente)</p>
                      </div>
                    </div>
                    <span className="text-white font-medium">{formatPrice(1500, 'USD')}</span>
                  </label>
                </div>
              </div>

              {/* Método de Pago */}
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">
                  Método de pago
                </h2>
                <div className="space-y-2">
                  <label className="flex items-center p-4 bg-zinc-800 rounded-lg border border-zinc-700 hover:border-zinc-600 cursor-pointer">
                    <input
                      {...register('paymentMethod')}
                      type="radio"
                      value="manual"
                      className="text-red-500 focus:ring-red-500 mr-3"
                    />
                    <div>
                      <p className="text-white font-medium">Pago Manual</p>
                      <p className="text-zinc-400 text-sm">
                        Te enviaremos instrucciones de pago por email
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center p-4 bg-zinc-800 rounded-lg border border-zinc-700 opacity-50 cursor-not-allowed">
                    <input
                      {...register('paymentMethod')}
                      type="radio"
                      value="stripe"
                      disabled
                      className="text-red-500 focus:ring-red-500 mr-3"
                    />
                    <div>
                      <p className="text-white font-medium">Tarjeta de Crédito (Stripe)</p>
                      <p className="text-zinc-400 text-sm">Próximamente disponible</p>
                    </div>
                  </label>

                  <label className="flex items-center p-4 bg-zinc-800 rounded-lg border border-zinc-700 opacity-50 cursor-not-allowed">
                    <input
                      {...register('paymentMethod')}
                      type="radio"
                      value="paypal"
                      disabled
                      className="text-red-500 focus:ring-red-500 mr-3"
                    />
                    <div>
                      <p className="text-white font-medium">PayPal</p>
                      <p className="text-zinc-400 text-sm">Próximamente disponible</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Botón de Submit */}
              <button
                type="submit"
                disabled={isProcessing}
                className="btn-primary w-full flex items-center justify-center"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Procesando...
                  </>
                ) : (
                  `Completar orden • ${formatPrice(total, 'USD')}`
                )}
              </button>
            </form>
          </div>

          {/* Resumen de Orden */}
          <div className="lg:sticky lg:top-8 h-fit">
            <div className="bg-zinc-800 rounded-xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Resumen de orden
              </h2>

              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 bg-zinc-700 rounded-lg overflow-hidden">
                        {item.product.thumbnail ? (
                          <Image
                            src={item.product.thumbnail}
                            alt={item.product.title}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-500">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium line-clamp-1">
                        {item.product.title}
                      </p>
                      <p className="text-zinc-400 text-sm">
                        {item.variant.title}
                      </p>
                    </div>
                    <span className="text-white font-medium">
                      {formatPrice(item.price * item.quantity, 'USD')}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-zinc-700 pt-4 space-y-2">
                <div className="flex justify-between text-zinc-300">
                  <span>Subtotal</span>
                  <span>{formatPrice(subtotal, 'USD')}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Envío</span>
                  <span>{formatPrice(shippingCost, 'USD')}</span>
                </div>
                <div className="border-t border-zinc-700 pt-2 mt-2">
                  <div className="flex justify-between text-xl font-semibold text-white">
                    <span>Total</span>
                    <span>{formatPrice(total, 'USD')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
