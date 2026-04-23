"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function RegistroPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // --- 1. VALIDACIONES LOCALES ---
    
    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Por favor, ingresa un correo electrónico válido.");
      setLoading(false);
      return;
    }

    // Validar contraseña fuerte
    // (?=.*[a-z]) -> Al menos una minúscula
    // (?=.*[A-Z]) -> Al menos una mayúscula
    // (?=.*\d)    -> Al menos un número
    // (?=.*[@$!%*?&#^_-]) -> Al menos un carácter especial
    // {8,}        -> Mínimo 8 caracteres
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^_-])[A-Za-z\d@$!%*?&#^_-]{8,}$/;
    
    if (!passwordRegex.test(password)) {
      setError("La contraseña debe tener mínimo 8 caracteres, incluir una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&...).");
      setLoading(false);
      return;
    }
    // -------------------------------

    // 2. Registramos al usuario en Supabase Auth
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre: nombre,
          rol: 'usuario'
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      router.push('/login');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Crear Cuenta</h2>
          <p className="text-gray-500 mt-2">Únete al sistema de monitoreo de YPFB</p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-md text-sm font-medium">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-md text-sm font-medium">
            ¡Registro exitoso! Redirigiendo al inicio de sesión...
          </div>
        )}

        <form onSubmit={handleRegistro} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
            <input 
              type="text" 
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-4 py-2 border-2 border-black text-yellow-600 font-bold bg-white rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none placeholder-gray-500 transition-colors"
              placeholder="Ej: Juan Pérez"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border-2 border-black text-yellow-600 font-bold bg-white rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none placeholder-gray-500 transition-colors"
              placeholder="usuario@correo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input 
              type="password" 
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border-2 border-black text-yellow-600 font-bold bg-white rounded-lg focus:ring-2 focus:ring-black focus:border-black outline-none placeholder-gray-500 transition-colors"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading || success}
            className="w-full bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400"
          >
            {loading ? 'Registrando...' : 'Crear Cuenta'}
          </button>
        </form>

        <div className="text-center mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
          <p className="text-sm text-gray-600">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-bold">
              Inicia sesión aquí
            </Link>
          </p>
          <p className="text-sm text-gray-600 mt-2">
            <Link href="/" className="text-gray-500 hover:text-blue-600 hover:underline font-medium">
              ← Volver al mapa público
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}