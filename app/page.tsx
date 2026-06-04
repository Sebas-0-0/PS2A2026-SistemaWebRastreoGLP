"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Map, { Marker, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '../lib/supabase';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export default function LandingPage() {
  const [busqueda, setBusqueda] = useState('');
  const [zonas, setZonas] = useState<any[]>([]);
  const [zonaSeleccionada, setZonaSeleccionada] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  // NUEVO ESTADO: Guarda la ruta exacta a la que debe ir este usuario
  const [rutaPanel, setRutaPanel] = useState<string | null>(null);

  const [viewState, setViewState] = useState({
    longitude: -68.1300,
    latitude: -16.5000,
    zoom: 12
  });

  useEffect(() => {
    // 1. Revisar qué rol tiene el usuario activo
    const revisarSesionYRol = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Consultamos el rol en la tabla profiles
        const { data: profile } = await supabase
          .from('profiles')
          .select('rol')
          .eq('id', session.user.id)
          .single();

        // Asignamos la ruta según el rol
        if (profile?.rol === 'admin') {
          setRutaPanel('/admin/dashboard');
        } else {
          setRutaPanel('/dashboard'); // Por defecto va al panel de vecino
        }
      } else {
        setRutaPanel(null); // No hay nadie logeado
      }
    };

    revisarSesionYRol();

    // 2. Cargar las zonas reales
    const obtenerZonasReal = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('zonas').select('*');
      if (!error) setZonas(data || []);
      setLoading(false);
    };

    obtenerZonasReal();
  }, []);

  const zonasFiltradas = zonas.filter(zona => 
    zona.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  const handleSeleccionarZona = (zona: any) => {
    setZonaSeleccionada(zona);
    setBusqueda('');
    setViewState({
      longitude: zona.centro_lng,
      latitude: zona.centro_lat,
      zoom: 15
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-blue-900 text-white p-4 shadow-md flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-tight">YPFB | Monitoreo GLP</h1>
        
        {/* Aquí usamos la ruta dinámica que descubrimos */}
        {rutaPanel ? (
          <Link 
            href={rutaPanel} 
            className="text-sm font-bold bg-green-600 hover:bg-green-500 px-5 py-2 rounded-lg transition-colors flex items-center gap-2"
          >
            Volver a mi Panel →
          </Link>
        ) : (
          <Link 
            href="/login" 
            className="text-sm font-medium bg-blue-800 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
          >
            Acceso Personal
          </Link>
        )}
      </header>

      <main className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 gap-6">
        <div className="w-full md:w-1/3 space-y-6 flex flex-col">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 z-20">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Encuentra tu garrafa</h2>
            
            <div className="relative">
              <input 
                type="text" 
                placeholder={loading ? "Cargando zonas..." : "Buscar zona o barrio..."}
                disabled={loading}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-black placeholder-gray-400 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
              
              {busqueda && (
                <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {zonasFiltradas.length > 0 ? (
                    zonasFiltradas.map(zona => (
                      <li 
                        key={zona.id}
                        onClick={() => handleSeleccionarZona(zona)}
                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer text-gray-700 border-b border-gray-100 last:border-0"
                      >
                        {zona.nombre}
                      </li>
                    ))
                  ) : (
                    <li className="px-4 py-3 text-gray-500 text-sm">No se encontraron resultados</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {zonaSeleccionada ? (
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 flex-1 flex flex-col justify-center items-center text-center shadow-inner">
              <h3 className="text-lg font-semibold text-blue-900">{zonaSeleccionada.nombre}</h3>
              <p className="text-gray-600 mt-2">Estado de distribución:</p>
              <div className="text-6xl font-bold text-blue-600 mt-4 tracking-tighter">-- min</div>
              <p className="text-sm text-gray-500 mt-4 italic">Conectando con señal GPS...</p>
            </div>
          ) : (
            <div className="bg-gray-100 p-6 rounded-xl border-2 border-dashed border-gray-300 flex-1 flex flex-col items-center justify-center text-center text-gray-500">
              <p>Busca tu zona para iniciar el monitoreo real.</p>
            </div>
          )}
        </div>

        <div className="w-full md:w-2/3 bg-gray-200 rounded-xl overflow-hidden shadow-inner border border-gray-200 min-h-[500px] relative z-0">
          <Map
            {...viewState}
            onMove={evt => setViewState(evt.viewState)}
            mapStyle="mapbox://styles/mapbox/streets-v12"
            mapboxAccessToken={MAPBOX_TOKEN}
            style={{ width: '100%', height: '100%' }}
          >
            <NavigationControl position="top-right" />
            {zonaSeleccionada && (
              <Marker longitude={zonaSeleccionada.centro_lng} latitude={zonaSeleccionada.centro_lat} anchor="bottom">
                <div className="text-red-600">
                   <svg className="w-8 h-8 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-4.198 0-8 3.403-8 7.602 0 4.198 3.469 9.21 8 16.398 4.531-7.188 8-12.2 8-16.398 0-4.199-3.801-7.602-8-7.602zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z"/></svg>
                </div>
              </Marker>
            )}
          </Map>
        </div>
      </main>
    </div>
  );
}