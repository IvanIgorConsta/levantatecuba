// src/components/store/CheckoutModal.jsx
import { useState } from 'react';
import { X, CheckCircle, Loader2, Mail, User, Phone, MapPin } from 'lucide-react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';

export default function CheckoutModal({ isOpen, onClose, cartItems, onConfirmOrder }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [orderId, setOrderId] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });

  const [errors, setErrors] = useState({});

  const subtotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Limpiar error del campo cuando el usuario empieza a escribir
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'El email es requerido';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'El teléfono es requerido';
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'La dirección es requerida';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Por favor completa todos los campos requeridos');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Preparar datos de la orden
      const orderData = {
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          variant: item.variant
        })),
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          notes: formData.notes
        },
        paymentMethod: 'manual'
      };
      
      // Enviar orden al backend
      const response = await fetch('/api/tienda/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });
      
      const result = await response.json();
      
      if (result.success) {
        setOrderId(result.order.orderId);
        setOrderComplete(true);
        onConfirmOrder(result.order);
        toast.success('¡Pedido enviado exitosamente!');
        
        // Limpiar carrito después de 2 segundos
        setTimeout(() => {
          onClose();
          // Reset form
          setFormData({
            name: '',
            email: '',
            phone: '',
            address: '',
            notes: ''
          });
          setOrderComplete(false);
          setOrderId('');
        }, 3000);
      } else {
        toast.error(result.message || 'Error al procesar el pedido');
      }
    } catch (error) {
      console.error('Error en checkout:', error);
      toast.error('Error al procesar el pedido. Por favor intenta nuevamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={!isProcessing ? onClose : undefined}
        aria-hidden="true"
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-800">
              <h2 className="text-xl font-semibold text-white">
                {orderComplete ? '¡Pedido Confirmado!' : 'Checkout'}
              </h2>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X size={24} />
              </button>
            </div>

            {/* Contenido */}
            {orderComplete ? (
              <div className="p-12 text-center">
                <CheckCircle className="mx-auto text-green-500 mb-6" size={64} />
                <h3 className="text-2xl font-bold text-white mb-3">
                  ¡Gracias por tu pedido!
                </h3>
                <p className="text-zinc-400 mb-4">
                  Tu pedido ha sido recibido y está pendiente de confirmación.
                </p>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
                  <p className="text-sm text-zinc-500 mb-1">Número de orden:</p>
                  <p className="text-lg font-mono text-red-500">{orderId}</p>
                </div>
                <p className="text-sm text-zinc-400">
                  Recibirás un email con las instrucciones de pago y detalles de tu pedido.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-6">
                  {/* Resumen del pedido */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <h3 className="text-white font-semibold mb-3">Resumen del pedido</h3>
                    <div className="space-y-2">
                      {cartItems.map(item => (
                        <div key={`${item.productId}-${item.variant?.id}`} className="flex justify-between text-sm">
                          <span className="text-zinc-400">
                            {item.title} x{item.quantity}
                            {item.variant && (
                              <span className="text-zinc-500"> ({item.variant.size || item.variant.color || item.variant.type})</span>
                            )}
                          </span>
                          <span className="text-white">${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="border-t border-zinc-800 pt-2 mt-2">
                        <div className="flex justify-between font-semibold">
                          <span className="text-white">Total</span>
                          <span className="text-red-500">${subtotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información del cliente */}
                  <div>
                    <h3 className="text-white font-semibold mb-4">Información de contacto</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Nombre */}
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">
                          Nombre completo *
                        </label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
                          <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className={`w-full bg-zinc-900 border ${errors.name ? 'border-red-500' : 'border-zinc-800'} rounded-lg px-10 py-2 text-white focus:outline-none focus:border-red-500`}
                            placeholder="Juan Pérez"
                            disabled={isProcessing}
                          />
                        </div>
                        {errors.name && (
                          <p className="text-red-500 text-xs mt-1">{errors.name}</p>
                        )}
                      </div>

                      {/* Email */}
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">
                          Email *
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            className={`w-full bg-zinc-900 border ${errors.email ? 'border-red-500' : 'border-zinc-800'} rounded-lg px-10 py-2 text-white focus:outline-none focus:border-red-500`}
                            placeholder="juan@ejemplo.com"
                            disabled={isProcessing}
                          />
                        </div>
                        {errors.email && (
                          <p className="text-red-500 text-xs mt-1">{errors.email}</p>
                        )}
                      </div>

                      {/* Teléfono */}
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">
                          Teléfono *
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleInputChange}
                            className={`w-full bg-zinc-900 border ${errors.phone ? 'border-red-500' : 'border-zinc-800'} rounded-lg px-10 py-2 text-white focus:outline-none focus:border-red-500`}
                            placeholder="+1 234 567 8900"
                            disabled={isProcessing}
                          />
                        </div>
                        {errors.phone && (
                          <p className="text-red-500 text-xs mt-1">{errors.phone}</p>
                        )}
                      </div>

                      {/* Dirección */}
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">
                          Dirección de envío *
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={18} />
                          <input
                            type="text"
                            name="address"
                            value={formData.address}
                            onChange={handleInputChange}
                            className={`w-full bg-zinc-900 border ${errors.address ? 'border-red-500' : 'border-zinc-800'} rounded-lg px-10 py-2 text-white focus:outline-none focus:border-red-500`}
                            placeholder="Calle 123, Ciudad, País"
                            disabled={isProcessing}
                          />
                        </div>
                        {errors.address && (
                          <p className="text-red-500 text-xs mt-1">{errors.address}</p>
                        )}
                      </div>
                    </div>

                    {/* Notas */}
                    <div className="mt-4">
                      <label className="block text-sm text-zinc-400 mb-1">
                        Notas adicionales (opcional)
                      </label>
                      <textarea
                        name="notes"
                        value={formData.notes}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500"
                        placeholder="Instrucciones especiales para tu pedido..."
                        disabled={isProcessing}
                      />
                    </div>
                  </div>

                  {/* Información de pago */}
                  <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-4">
                    <p className="text-amber-500 text-sm">
                      <strong>Pago Manual:</strong> Después de confirmar tu pedido, recibirás un email con las instrucciones para completar el pago.
                    </p>
                  </div>
                </div>

                {/* Footer con botones */}
                <div className="border-t border-zinc-800 p-6 flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isProcessing}
                    className="flex-1 py-3 px-4 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        <span>Procesando...</span>
                      </>
                    ) : (
                      <span>Confirmar Pedido</span>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

CheckoutModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  cartItems: PropTypes.array.isRequired,
  onConfirmOrder: PropTypes.func.isRequired
};

