"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    camionesRuta: 0,
    alertasActivas: 0,
    zonasCubiertas: 0,
    reportesHoy: 0
  });

  useEffect(() => {
    async function fetchStats() {
      // 1. Contar camiones activos
      const { count: camiones } = await supabase
        .from('camiones')
        .select('*', { count: 'exact', head: true })
        .eq('activo', true);

      // 2. Contar alertas de hoy (Ejemplo: tipo 'accidente' o 'perdida_gas')
      const { count: alertas } = await supabase
        .from('reportes')
        .select('*', { count: 'exact', head: true })
        .in('tipo', ['accidente', 'perdida_gas']);

      // 3. Contar zonas registradas
      const { count: zonas } = await supabase
        .from('zonas')
        .select('*', { count: 'exact', head: true });

      setStats({
        camionesRuta: camiones || 0,
        alertasActivas: alertas || 0,
        zonasCubiertas: zonas || 0,
        reportesHoy: 5 // Dato simulado para historial
      });
    }

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Resumen Operativo</h1>
        <p className="text-gray-500">Estado actual de la flota en La Paz y El Alto</p>
      </div>

      {/* Grid de Tarjetas de Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Camiones en Ruta" value={stats.camionesRuta} color="blue" icon="🚚" />
        <StatCard title="Alertas Críticas" value={stats.alertasActivas} color="red" icon="🚨" />
        <StatCard title="Zonas Registradas" value={stats.zonasCubiertas} color="green" icon="📍" />
        <StatCard title="Reportes del Día" value={stats.reportesHoy} color="amber" icon="📝" />
      </div>

      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h2 className="text-lg font-bold mb-4">Actividad Reciente</h2>
        <p className="text-sm text-gray-500 italic">Próximamente: Gráficas de distribución y consumo...</p>
      </div>
    </div>
  );
}

function StatCard({ title, value, color, icon }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    green: 'bg-green-50 text-green-700 border-green-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
  };

  return (
    <div className={`p-6 rounded-xl border shadow-sm flex items-center justify-between ${colors[color]}`}>
      <div>
        <p className="text-sm font-medium uppercase opacity-70 tracking-wider">{title}</p>
        <p className="text-3xl font-bold mt-1">{value}</p>
      </div>
      <span className="text-4xl opacity-50">{icon}</span>
    </div>
  );
}