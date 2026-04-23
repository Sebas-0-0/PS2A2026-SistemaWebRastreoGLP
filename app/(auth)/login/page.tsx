"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Se quitaron los console.log de error aquí
      setError("Correo o contraseña incorrectos. Verifica tus datos.");
      setLoading(false);
      return; 
    }

    if (authData?.user) {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', authData.user.id)
        .single(); 

      if (profileError || !profileData) {
        // Se quitaron los console.log de error aquí
        setError("Error al obtener el perfil del usuario.");
        setLoading(false);
        return;
      }

      const rol = profileData.rol;

      if (rol === 'admin') {
        router.push('/admin/dashboard');
      } else if (rol === 'conductor') {
        alert("Atención: Los conductores deben iniciar sesión desde la Aplicación Móvil.");
        await supabase.auth.signOut();
      } else {
        router.push('/');
      }
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
        
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Acceso</h2>
          <p className="text-gray-500 mt-1">Ingresa tus credenciales</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-2 bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <div className="text-center mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
          <p className="text-sm text-gray-600">
            ¿No tienes una cuenta?{' '}
            <Link href="/registro" className="text-blue-600 hover:underline font-bold">
              Regístrate aquí
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