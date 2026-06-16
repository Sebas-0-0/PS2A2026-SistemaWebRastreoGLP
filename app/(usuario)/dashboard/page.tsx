"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function UsuarioDashboard() {
  const router = useRouter();
  // --- ESTADOS DEL COMPONENTE ---
  // Guardamos los datos básicos del perfil (nombre y email)
  const [perfil, setPerfil] = useState<{ nombre: string, email: string } | null>(null);
  
  // Estado para mostrar una pantalla de "Cargando..." mientras buscamos la información
  const [loading, setLoading] = useState(true);

  // --- EFECTO DE CARGA INICIAL ---
  // Este bloque se ejecuta automáticamente al abrir la página
  useEffect(() => {
    // Función interna para obtener los datos del usuario
    async function cargarPerfil() {
      // 1. Verificamos quién está logeado pidiendo los datos a Supabase
      const { data: authData } = await supabase.auth.getUser();
      
      // Si no hay un usuario activo, lo regresamos a la pantalla de login inmediatamente
      if (!authData.user) {
        router.replace('/login'); // Usamos replace para no dejar huella en el historial de navegación
        return;
      }

      // 2. Buscamos el nombre del usuario en nuestra tabla 'profiles' usando su ID
      const { data: profileData } = await supabase
        .from('profiles')
        .select('nombre')
        .eq('id', authData.user.id)
        .single(); // Solo necesitamos un único perfil

      // Actualizamos el estado con la información encontrada
      setPerfil({
        nombre: profileData?.nombre || 'Vecino', // Si no tiene nombre registrado, le decimos 'Vecino'
        email: authData.user.email || ''
      });
      
      // Termina el proceso, así que quitamos la pantalla de carga
      setLoading(false);
    }

    // Ejecutamos la función
    cargarPerfil();

    // 3. VIGILANTE EN TIEMPO REAL: Si la sesión muere (por cerrar sesión o expirar), te expulsa al instante.
    // Esto se mantiene "escuchando" en segundo plano
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      // Si el evento dice "SIGNED_OUT" (sesión cerrada) o la sesión no existe, vamos al login
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/login');
      }
    });

    // Esta parte "limpia" el vigilante si el usuario se va de este componente para evitar errores
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  // --- FUNCIÓN PARA CERRAR SESIÓN ---
  // Elimina la sesión actual en Supabase y te devuelve al inicio
  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.replace('/'); // Te envía al inicio borrando el dashboard del historial

  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-blue-600 font-bold">Cargando tu panel...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <nav className="bg-blue-900 text-white p-4 shadow-md flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="font-bold text-lg tracking-wide">YPFB Vecino</span>
        </div>
        <button 
          onClick={cerrarSesion}
          className="text-sm bg-red-600 hover:bg-red-500 font-bold px-4 py-2 rounded-lg transition-colors shadow-sm"
        >
          Cerrar Sesión
        </button>
      </nav>

      <main className="max-w-4xl mx-auto p-6 space-y-8 mt-4">
        <header className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold border-2 border-blue-200 shrink-0">
            {perfil?.nombre.charAt(0).toUpperCase()}
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="text-2xl font-extrabold text-gray-900">¡Hola, {perfil?.nombre}!</h1>
            <p className="text-gray-500">Bienvenido a tu panel de control vecinal.</p>
          </div>
          
          {/* Este botón ahora simplemente navega a "/", tu sesión seguirá viva en la sombra */}
          <Link 
            href="/"
            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold py-3 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 whitespace-nowrap"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Ir al Mapa en Vivo
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-blue-300 transition-colors cursor-pointer group">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Mi Zona Favorita</h3>
            <p className="text-gray-500 text-sm mb-4">Guárdala para recibir notificaciones cuando el camión se acerque a tu hogar.</p>
            <button className="text-blue-600 font-bold text-sm hover:underline">Configurar ahora →</button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:border-red-300 transition-colors cursor-pointer group">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Generar un Reporte</h3>
            <p className="text-gray-500 text-sm mb-4">¿El camión no pasó o hubo sobreprecio? Envía un reporte directo a YPFB.</p>
            <button className="text-red-600 font-bold text-sm hover:underline">Nuevo reporte →</button>
          </div>
        </div>
      </main>
    </div>
  );
}