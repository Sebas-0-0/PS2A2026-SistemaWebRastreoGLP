"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const menuItems = [
  { name: 'Inicio', href: '/admin/dashboard', icon: '📊' },
  { name: 'Mapa en Vivo', href: '/admin/mapa', icon: '📍' },
  { name: 'Camiones', href: '/admin/camiones', icon: '🚛' },
  { name: 'Zonas y Geocercas', href: '/admin/zonas', icon: '⭕' },
  { name: 'Reportes y Alertas', href: '/admin/reportes', icon: '⚠️' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar Fijo */}
      <aside className="w-64 bg-blue-900 text-white flex flex-col shadow-xl">
        <div className="p-6 border-b border-blue-800">
          <h2 className="text-xl font-bold tracking-wider text-blue-200 uppercase">YPFB Admin</h2>
          <p className="text-xs text-blue-400 mt-1">Control de Distribución</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-blue-700 text-white shadow-inner font-semibold' 
                    : 'text-blue-100 hover:bg-blue-800'
                }`}
              >
                <span>{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-blue-800">
           <Link href="/" className="text-sm text-blue-300 hover:text-white transition-colors">
             ← Salir al Portal Público
           </Link>
        </div>
      </aside>

      {/* Área de Contenido Variable */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white h-16 border-b flex items-center justify-between px-8 shadow-sm">
          <h3 className="font-medium text-gray-700">Panel de Control Univalle - Gestión Logística</h3>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Sesión: Administrador</span>
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">A</div>
          </div>
        </header>
        
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}