"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  
  // --- ESTADOS DEL COMPONENTE ---
  // Define si mostramos el formulario de "login" o el de "recuperar contraseña"
  const [vista, setVista] = useState<'login' | 'recuperar'>('login');

  // Campos del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Estados para manejar la carga (botones deshabilitados) y mensajes de éxito/error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null); // Mensaje de éxito al recuperar contraseña

  // --- FUNCIÓN PRINCIPAL DE LOGIN ---
  // Esta función se ejecuta cuando el usuario envía el formulario de inicio de sesión
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Evita que la página se recargue al enviar el formulario
    setLoading(true);   // Activa el estado de carga (muestra "Ingresando...")
    setError(null);     // Limpia cualquier error anterior

    // Intenta iniciar sesión usando Supabase con el correo y la contraseña
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('Auth data:', authData) 
    console.log('Auth error:', authError)

    // Si ocurre un error (ej. contraseña incorrecta), lo mostramos y detenemos el proceso
    if (authError) {
      setError("Correo o contraseña incorrectos. Verifica tus datos.");
      setLoading(false);
      return; 
    }

    // Si la autenticación fue exitosa, procedemos a buscar el rol del usuario
    if (authData?.user) {
      // Consultamos la tabla 'profiles' para obtener el rol del usuario autenticado
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', authData.user.id)
        .single(); // Usamos single() porque esperamos un único perfil

      // Si hay un error al buscar el perfil, mostramos un mensaje y detenemos el proceso
      if (profileError || !profileData) {
        setError("Error al obtener el perfil del usuario.");
        setLoading(false);
        return;
      }

      // Guardamos el rol del usuario para redirigirlo a la pantalla correcta
      const rol = profileData.rol;

      if (rol === 'admin') {
        router.push('/admin/dashboard');
      } else if (rol === 'conductor') {
        alert("Atención: Los conductores deben iniciar sesión desde la Aplicación Móvil.");
        await supabase.auth.signOut();
      } else {
        router.push('/dashboard');
      }
    }
    
    setLoading(false);
  };

  // --- FUNCIÓN PARA RECUPERAR CONTRASEÑA ---
  // Esta función se ejecuta cuando el usuario solicita restablecer su contraseña
  const handleRecuperar = async (e: React.FormEvent) => {
    e.preventDefault(); // Evita que la página se recargue
    setLoading(true);   // Activa el estado de carga
    setError(null);     // Limpia errores anteriores
    setMensaje(null);   // Limpia mensajes anteriores

    // Supabase enviará un correo con un enlace que redirigirá al usuario para cambiar su contraseña
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/actualizar-password`, 
    });

    if (resetError) {
      setError(resetError.message);
    } else {
      setMensaje("Te hemos enviado un correo con las instrucciones para restablecer tu contraseña.");
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6 transition-all duration-300">
        
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">
            {vista === 'login' ? 'Acceso' : 'Recuperar Cuenta'}
          </h2>
          <p className="text-gray-500 mt-1">
            {vista === 'login' 
              ? 'Ingresa tus credenciales' 
              : 'Ingresa tu correo para recibir un enlace seguro'}
          </p>
        </div>

        {/* MENSAJES DE ALERTA */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {mensaje && (
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg text-sm">
            {mensaje}
          </div>
        )}

        {/* FORMULARIO DINÁMICO */}
        {vista === 'login' ? (
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
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-600">
                  Contraseña
                </label>
                {/* ENLACE PARA CAMBIAR A VISTA DE RECUPERACIÓN */}
                <button 
                  type="button"
                  onClick={() => { setVista('recuperar'); setError(null); setMensaje(null); }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
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
        ) : (
          <form onSubmit={handleRecuperar} className="space-y-4">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-medium py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
            </button>

            {/* BOTÓN PARA VOLVER AL LOGIN */}
            <button
              type="button"
              onClick={() => { setVista('login'); setError(null); setMensaje(null); }}
              className="w-full bg-white text-gray-700 border border-gray-300 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition"
            >
              Volver al inicio de sesión
            </button>
          </form>
        )}

        {/* ENLACES INFERIORES */}
        {vista === 'login' && (
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
        )}
      </div>
    </div>
  );
}