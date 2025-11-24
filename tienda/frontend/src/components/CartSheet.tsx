'use client'

import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon, TrashIcon, MinusIcon, PlusIcon } from '@heroicons/react/24/outline'
import { useCartStore } from '@/store/cart'
import { formatPrice } from '@/utils/format'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface CartSheetProps {
  open: boolean
  onClose: () => void
}

export function CartSheet({ open, onClose }: CartSheetProps) {
  const router = useRouter()
  const { items, removeItem, updateQuantity, getSubtotal, clearCart } = useCartStore()
  const subtotal = getSubtotal()

  const handleCheckout = () => {
    onClose()
    router.push('/checkout')
  }

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-500"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-500"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-500 sm:duration-700"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-500 sm:duration-700"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-md">
                  <div className="flex h-full flex-col overflow-y-scroll bg-zinc-900 shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                      <Dialog.Title className="text-lg font-medium text-white">
                        Carrito de compras
                      </Dialog.Title>
                      <button
                        type="button"
                        className="text-zinc-400 hover:text-white transition-colors"
                        onClick={onClose}
                      >
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto px-6 py-6">
                      {items.length === 0 ? (
                        <div className="text-center py-12">
                          <svg
                            className="mx-auto h-12 w-12 text-zinc-600"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1}
                              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                            />
                          </svg>
                          <h3 className="mt-2 text-sm font-medium text-zinc-300">
                            Tu carrito está vacío
                          </h3>
                          <p className="mt-1 text-sm text-zinc-500">
                            Agrega productos para comenzar
                          </p>
                          <button
                            onClick={onClose}
                            className="btn-primary mt-6"
                          >
                            Continuar comprando
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          {items.map((item) => (
                            <div key={item.id} className="flex gap-4">
                              {/* Product Image */}
                              <Link
                                href={`/product/${item.product.handle}`}
                                onClick={onClose}
                                className="flex-shrink-0"
                              >
                                <div className="w-20 h-20 bg-zinc-800 rounded-lg overflow-hidden">
                                  {item.product.thumbnail ? (
                                    <Image
                                      src={item.product.thumbnail}
                                      alt={item.product.title}
                                      width={80}
                                      height={80}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-zinc-600">
                                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              </Link>

                              {/* Product Details */}
                              <div className="flex-1">
                                <Link
                                  href={`/product/${item.product.handle}`}
                                  onClick={onClose}
                                  className="text-white hover:text-red-400 transition-colors font-medium"
                                >
                                  {item.product.title}
                                </Link>
                                <p className="text-sm text-zinc-400">
                                  {item.variant.title}
                                </p>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-white font-semibold">
                                    {formatPrice(item.price, 'USD')}
                                  </span>
                                  {/* Quantity Controls */}
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
                                      aria-label="Disminuir cantidad"
                                    >
                                      <MinusIcon className="w-3 h-3 text-zinc-400" />
                                    </button>
                                    <span className="text-white w-8 text-center">
                                      {item.quantity}
                                    </span>
                                    <button
                                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                      className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
                                      aria-label="Aumentar cantidad"
                                    >
                                      <PlusIcon className="w-3 h-3 text-zinc-400" />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Remove Button */}
                              <button
                                onClick={() => removeItem(item.id)}
                                className="text-zinc-500 hover:text-red-500 transition-colors"
                                aria-label="Eliminar del carrito"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </div>
                          ))}

                          {/* Clear Cart Button */}
                          <button
                            onClick={clearCart}
                            className="w-full text-center text-sm text-zinc-500 hover:text-red-500 transition-colors py-2"
                          >
                            Vaciar carrito
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Footer with Checkout */}
                    {items.length > 0 && (
                      <div className="border-t border-zinc-800 px-6 py-4">
                        <div className="flex justify-between text-base font-medium text-white mb-4">
                          <p>Subtotal</p>
                          <p>{formatPrice(subtotal, 'USD')}</p>
                        </div>
                        <p className="text-sm text-zinc-400 mb-4">
                          Envío e impuestos calculados al finalizar la compra
                        </p>
                        <button
                          onClick={handleCheckout}
                          className="btn-primary w-full"
                        >
                          Proceder al checkout
                        </button>
                        <button
                          onClick={onClose}
                          className="btn-secondary w-full mt-2"
                        >
                          Continuar comprando
                        </button>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
