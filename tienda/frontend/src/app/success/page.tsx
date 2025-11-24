'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import confetti from 'canvas-confetti'

export default function SuccessPage() {
  useEffect(() => {
    // Lanzar confetti al cargar la página
    const duration = 3000
    const animationEnd = Date.now() + duration
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 }

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min
    }

    const interval: any = setInterval(function() {
      const timeLeft = animationEnd - Date.now()

      if (timeLeft <= 0) {
        return clearInterval(interval)
      }

      const particleCount = 50 * (timeLeft / duration)
      
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#ef4444', '#dc2626', '#b91c1c', '#ffffff']
      })
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#ef4444', '#dc2626', '#b91c1c', '#ffffff']
      })
    }, 250)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        {/* Success Icon */}
        <div className="mb-8 animate-bounce-slow">
          <CheckCircleIcon className="w-24 h-24 text-green-500 mx-auto" />
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          ¡Orden Confirmada!
        </h1>

        {/* Order Number */}
        <div className="bg-zinc-800 rounded-lg p-4 mb-6 inline-block">
          <p className="text-zinc-400 text-sm mb-1">Número de orden</p>
          <p className="text-white font-mono text-xl">
            #LC-{Math.random().toString(36).substr(2, 9).toUpperCase()}
          </p>
        </div>

        {/* Description */}
        <p className="text-zinc-300 text-lg mb-8 max-w-xl mx-auto">
          Gracias por tu compra. Te hemos enviado un email con los detalles de tu orden
          y las instrucciones de pago.
        </p>

        {/* Important Notice */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 mb-8">
          <h2 className="text-red-400 font-semibold mb-2">
            Instrucciones de Pago Manual
          </h2>
          <p className="text-zinc-300 text-sm">
            Revisa tu email para las instrucciones detalladas de cómo completar tu pago.
            Tu orden será procesada una vez confirmemos la recepción del pago.
          </p>
        </div>

        {/* Next Steps */}
        <div className="bg-zinc-800 rounded-lg p-6 mb-8 text-left">
          <h3 className="text-white font-semibold mb-4">Próximos pasos:</h3>
          <ol className="space-y-3 text-zinc-300">
            <li className="flex items-start gap-3">
              <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm">
                1
              </span>
              <span>Revisa tu email con las instrucciones de pago</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm">
                2
              </span>
              <span>Realiza el pago siguiendo las instrucciones</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm">
                3
              </span>
              <span>Recibirás confirmación cuando procesemos tu pago</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-sm">
                4
              </span>
              <span>Tu pedido será enviado en 24-48 horas</span>
            </li>
          </ol>
        </div>

        {/* Thank You Message */}
        <div className="mb-8">
          <p className="text-xl text-white font-semibold mb-2">
            ¡Gracias por apoyar la causa!
          </p>
          <p className="text-zinc-400">
            Tu compra contribuye directamente a la libertad y esperanza de Cuba 🇨🇺
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/" className="btn-primary">
            Continuar comprando
          </Link>
          <a
            href={process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'http://localhost:5173'}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary"
          >
            Volver al sitio principal
          </a>
        </div>

        {/* Contact Support */}
        <p className="text-zinc-500 text-sm mt-8">
          ¿Tienes preguntas? Contáctanos en{' '}
          <a href="mailto:tienda@levantatecuba.com" className="text-red-400 hover:text-red-300">
            tienda@levantatecuba.com
          </a>
        </p>
      </div>
    </div>
  )
}

// Agregar esto al package.json de frontend:
// "canvas-confetti": "^1.9.2"
