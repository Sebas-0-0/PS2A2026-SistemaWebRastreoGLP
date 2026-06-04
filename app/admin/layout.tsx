"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const menuItems = [
  { name: 'Inicio', href: '/admin/dashboard', icon: '📊' },
  { name: 'Mapa en Vivo', href: '/admin/mapa', icon: '📍' },
  { name: 'Conductores', href: '/admin/conductores', icon: '👨🏽‍✈️' },
  { name: 'Camiones', href: '/admin/camiones', icon: '🚛' },
  { name: 'Zonas y Geocercas', href: '/admin/zonas', icon: '⭕' },
  { name: 'Reportes y Alertas', href: '/admin/reportes', icon: '⚠️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  
  // Estados de seguridad y UI
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  
  // NUEVO: Estado para controlar si el menú está abierto o colapsado
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    const verificarAdmin = async () => {
      const { data: authData } = await supabase.auth.getUser();
      
      if (!authData.user) {
        router.replace('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', authData.user.id)
        .single();

      if (profile?.rol !== 'admin') {
        router.replace('/login');
        return;
      }

      setAdminEmail(authData.user.email || 'Admin');
      setIsAuthorized(true);
    };

    verificarAdmin();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/login');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    router.replace('/'); 
  };

  if (!isAuthorized) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100">
        <div className="flex items-center gap-3 text-blue-900 font-bold text-lg animate-pulse">
           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
           </svg>
           Verificando credenciales de seguridad...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      
      {/* Sidebar Fijo y Deslizante */}
      <aside 
        className={`relative flex flex-col bg-blue-900 text-white shadow-xl transition-all duration-300 ease-in-out z-20 ${
          isSidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Botón flotante para expandir/colapsar */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-6 bg-yellow-500 text-blue-900 p-1.5 rounded-full border border-blue-900 shadow-md hover:bg-yellow-400 transition-colors z-50 focus:outline-none"
        >
          <svg 
            className={`w-4 h-4 transform transition-transform duration-300 ${isSidebarOpen ? 'rotate-180' : 'rotate-0'}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div className={`p-6 border-b border-blue-800 flex items-center transition-all duration-300 h-24 ${isSidebarOpen ? 'justify-start' : 'justify-center px-0'}`}>
          <svg className="w-8 h-8 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          
          {/* El texto desaparece si el menú está colapsado */}
          <div className={`ml-3 overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
            <h2 className="text-xl font-bold tracking-wider text-blue-200 uppercase whitespace-nowrap">YPFB Admin</h2>
            <p className="text-xs text-blue-400 mt-1 whitespace-nowrap">Control Logístico</p>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-x-hidden">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={!isSidebarOpen ? item.name : ""} // Muestra el nombre al pasar el mouse si está colapsado
                className={`flex items-center rounded-lg transition-all ${
                  isActive 
                    ? 'bg-blue-700 text-white shadow-inner font-semibold' 
                    : 'text-blue-100 hover:bg-blue-800'
                } ${isSidebarOpen ? 'px-4 py-3 gap-3' : 'px-0 py-3 justify-center'}`}
              >
                <span className="text-xl shrink-0">{item.icon}</span>
                <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-800">
           <button 
             onClick={cerrarSesion}
             title={!isSidebarOpen ? "Cerrar Sesión" : ""}
             className={`w-full flex items-center text-red-300 hover:text-white hover:bg-red-600 rounded-lg transition-colors font-medium group ${
               isSidebarOpen ? 'px-4 py-3 gap-3' : 'px-0 py-3 justify-center'
             }`}
           >
             <svg className="w-5 h-5 shrink-0 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
             </svg>
             <span className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'w-auto opacity-100' : 'w-0 opacity-0'}`}>
               Cerrar Sesión
             </span>
           </button>
        </div>
      </aside>

      {/* Área de Contenido Variable */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white h-16 border-b flex items-center justify-between px-8 shadow-sm shrink-0 z-10">
          <h3 className="font-medium text-blue-900 truncate">Centro de Monitoreo - Gestión Logística</h3>
          <div className="flex items-center gap-4 shrink-0">
            <div className=" flex-col text-right hidden sm:flex">
              <span className="text-sm font-bold text-gray-700">Administrador</span>
              <span className="text-xs text-gray-400">{adminEmail}</span>
            </div>
            <div className="w-10 h-10 bg-blue-100 border-2 border-blue-200 rounded-full flex items-center justify-center text-blue-700 font-bold">
              {adminEmail.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="p-8 flex-1 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}