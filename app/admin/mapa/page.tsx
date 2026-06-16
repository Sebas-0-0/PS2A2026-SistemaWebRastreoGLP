"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { Map, Marker, NavigationControl, Source, Layer } from "react-map-gl/mapbox";
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/lib/supabase';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

// --- FUNCIÓN PARA DIBUJAR CÍRCULOS EN EL MAPA ---
// Mapbox no tiene una forma nativa de dibujar círculos perfectos usando solo un radio en metros.
// Esta función toma el centro (lat/lng) y el radio, y calcula 64 puntos alrededor para formar
// un polígono (un círculo falso) que Mapbox sí puede dibujar y entender como una "zona".
const crearCirculoGeoJSON = (zonas: any[]) => {
  if (!zonas || zonas.length === 0) return null;
  
  const features = zonas.map(z => {
    // Convertimos el radio de metros a kilómetros
    const km = z.radio_metros / 1000;
    // Cálculos matemáticos para ajustar la distancia según la curvatura de la tierra
    const distanceX = km / (111.320 * Math.cos(z.centro_lat * Math.PI / 180));
    const distanceY = km / 110.574;
    
    const puntos = [];
    // Dibujamos 64 puntos alrededor del centro para ir formando el círculo
    for (let i = 0; i < 64; i++) {
      const theta = (i / 64) * (2 * Math.PI);
      puntos.push([z.centro_lng + distanceX * Math.cos(theta), z.centro_lat + distanceY * Math.sin(theta)]);
    }
    // Cerramos el círculo conectando el último punto con el primero
    puntos.push(puntos[0]);
    
    return {
      type: 'Feature',
      properties: { id: z.id, nombre: z.nombre },
      geometry: { type: 'Polygon', coordinates: [puntos] }
    };
  });

  return { type: 'FeatureCollection', features };
};

export default function MapaEnVivoPage() {
  const [zonas, setZonas] = useState<any[]>([]);
  const [camiones, setCamiones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [camionSeleccionado, setCamionSeleccionado] = useState<any | null>(null);
  
  const [filtroZona, setFiltroZona] = useState('');
  const [mostrarEtiquetas, setMostrarEtiquetas] = useState(true);

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const [viewState, setViewState] = useState({
    longitude: -68.1300, 
    latitude: -16.5000,
    zoom: 12.5,
    pitch: 45 
  });

  const zonasGeoJSON: any = useMemo(() => crearCirculoGeoJSON(zonas), [zonas]);

  // --- EFECTO DE INICIALIZACIÓN Y RASTREO EN VIVO ---
  // Se ejecuta una sola vez al abrir la página del mapa
  useEffect(() => {
    // 1. Carga las zonas y camiones iniciales
    cargarDatosIniciales();

    // 2. Nos suscribimos a los cambios en tiempo real de la tabla 'camiones' usando Supabase Realtime
    const suscripcionCamiones = supabase
      .channel('rastreo-en-vivo')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'camiones' },
        (payload) => {
          setCamiones((camionesActuales) => {
            // AQUÍ ESTÁ LA CLAVE:
            // Si el campo 'activo' cambió a false (terminó su turno) o
            // si el campo 'estado' ya no es 'Activo', el camión debe desaparecer de la vista.
            if (payload.new.activo === false || payload.new.estado !== 'Activo') {
              return camionesActuales.filter(c => c.id !== payload.new.id);
            }

            // De lo contrario, buscamos si el camión ya estaba mostrado en el mapa
            const camionExistente = camionesActuales.find(c => c.id === payload.new.id);
            
            if (camionExistente) {
              // Si ya existía, simplemente actualizamos sus coordenadas (lat y lng) para que se "mueva"
              return camionesActuales.map((camion) => 
                camion.id === payload.new.id 
                  ? { ...camion, lat: payload.new.lat, lng: payload.new.lng, activo: true, estado: payload.new.estado }
                  : camion
              );
            } else {
              // Si el camión se acaba de activar (inició turno) y no lo teníamos, volvemos a descargar la lista
              cargarDatosIniciales();
              return camionesActuales;
            }
          });
        }
      )
      .subscribe();

    // 3. Solucionamos un problema visual: si la ventana del navegador cambia de tamaño, el mapa se adapta
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    observer.observe(mapContainerRef.current);

    // Al desmontar (irse a otra página), apagamos el vigilante y la suscripción en tiempo real
    return () => {
      observer.disconnect();
      supabase.removeChannel(suscripcionCamiones);
    };
  }, []);

  // --- CARGA INICIAL DE DATOS ---
  const cargarDatosIniciales = async () => {
    setLoading(true);
    
    // Obtenemos todas las zonas registradas (para dibujar los círculos/geocercas)
    const { data: dataZonas } = await supabase.from('zonas').select('*');
    if (dataZonas) setZonas(dataZonas);

    // --- DOBLE FILTRO SQL PARA CAMIONES ---
    // Traemos a los camiones que tengan su turno iniciado (activo=true) Y que su estado físico sea "Activo"
    const { data: dataCamiones } = await supabase
      .from('camiones')
      .select('*, profiles(nombre, ci)')
      .eq('activo', true)
      .eq('estado', 'Activo'); 
      
    if (dataCamiones) setCamiones(dataCamiones);
    setLoading(false);
  };

  const enfocarCamion = (camion: any) => {
    setCamionSeleccionado(camion);
    if (mapRef.current && camion.lat && camion.lng) {
      mapRef.current.flyTo({
        center: [camion.lng, camion.lat],
        zoom: 16,
        pitch: 60,
        duration: 2000
      });
    } else {
      alert("Este camión está en turno pero aún no ha reportado su ubicación GPS.");
    }
  };

  const enfocarZona = (zona: any) => {
    setCamionSeleccionado(null);
    if (mapRef.current && zona.centro_lat && zona.centro_lng) {
      mapRef.current.flyTo({
        center: [zona.centro_lng, zona.centro_lat],
        zoom: 15,
        pitch: 0, 
        duration: 2000
      });
    }
  };

  const camionesConGPS = camiones.filter(c => c.lat !== null && c.lng !== null);
  
  const zonasFiltradas = zonas.filter(z => 
    z.nombre.toLowerCase().includes(filtroZona.toLowerCase())
  );

  return (
    <div className="flex h-full gap-4 min-w-0 w-full relative">
      
      {/* MAPA */}
      <div 
        ref={mapContainerRef} 
        className="flex-1 relative bg-white rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border-4 border-black overflow-hidden min-w-0 h-full"
      >
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/80 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-yellow-400 border-4 border-black px-6 py-3 font-black text-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-pulse">
              CONECTANDO AL SATÉLITE...
            </div>
          </div>
        )}

        {/* Switch flotante de Etiquetas sobre el mapa */}
        <div className="absolute top-4 left-4 z-10">
          <label className="bg-white border-4 border-black px-3 py-2 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors">
            <div className="relative flex items-center">
              <input 
                type="checkbox" 
                className="sr-only" 
                checked={mostrarEtiquetas}
                onChange={() => setMostrarEtiquetas(!mostrarEtiquetas)}
              />
              <div className={`block w-10 h-6 rounded-full border-2 border-black transition-colors ${mostrarEtiquetas ? 'bg-green-400' : 'bg-gray-300'}`}></div>
              <div className={`absolute left-1 bg-white border-2 border-black w-4 h-4 rounded-full transition-transform duration-300 ease-in-out ${mostrarEtiquetas ? 'transform translate-x-4' : ''}`}></div>
            </div>
            <span className="text-xs font-black uppercase text-black pt-0.5">Etiquetas</span>
          </label>
        </div>

        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/navigation-day-v1"
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
        >
          <NavigationControl position="bottom-right" />
          
          {zonasGeoJSON && (
            <Source id="zonas-source" type="geojson" data={zonasGeoJSON}>
              <Layer id="zonas-fill" type="fill" paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.15 }} />
              <Layer id="zonas-outline" type="line" paint={{ 'line-color': '#1d4ed8', 'line-width': 2, 'line-dasharray': [4, 4] }} />
            </Source>
          )}

          {/* Nombres de las Zonas */}
          {mostrarEtiquetas && zonas.map(z => (
            <Marker key={`zona-${z.id}`} longitude={z.centro_lng} latitude={z.centro_lat}>
              <div className="bg-white/80 backdrop-blur-sm border-2 border-black px-2 py-0.5 rounded text-[10px] font-black shadow-sm text-blue-900 pointer-events-none uppercase">
                {z.nombre}
              </div>
            </Marker>
          ))}

          {/* Vehículos con Turno Iniciado (activo=true), Estado "Activo" y con GPS */}
          {camionesConGPS.map(camion => (
            <Marker 
              key={camion.id} 
              longitude={camion.lng} 
              latitude={camion.lat} 
              anchor="bottom"
              style={{ transition: 'all 0.5s ease-out' }} 
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                enfocarCamion(camion);
              }}
            >
              <div className={`relative cursor-pointer group transition-transform ${camionSeleccionado?.id === camion.id ? 'scale-125 z-50' : 'hover:scale-110 z-10'}`}>
                <div className={`absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-white border-2 border-black px-2 py-0.5 rounded text-[10px] font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] whitespace-nowrap transition-opacity duration-300 ${mostrarEtiquetas ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                  {camion.placa}
                </div>
                <div className="w-10 h-10 bg-yellow-400 border-2 border-black rounded-full flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-lg">
                  🚛
                </div>
                <div className="absolute -inset-2 bg-yellow-400 rounded-full animate-ping opacity-20 -z-10"></div>
              </div>
            </Marker>
          ))}
        </Map>
      </div>

      {/* SIDEBAR DERECHO DIVIDIDO EN 2 */}
      <aside className="w-80 flex flex-col gap-4 shrink-0 h-full">
        
        {/* TARJETA 1: CAMIONES EN RUTA (TURNO INICIADO Y OPERATIVOS) */}
        <div className="bg-white rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="p-4 border-b-4 border-black bg-blue-900 text-white shrink-0">
            <h2 className="font-black text-lg tracking-tight uppercase flex items-center gap-2">
              <span className="w-3 h-3 bg-green-400 rounded-full animate-pulse border border-black"></span>
              Turnos Activos
            </h2>
            <p className="text-xs text-blue-200 font-bold mt-1">
              {camiones.length} {camiones.length === 1 ? 'vehículo reportando' : 'vehículos reportando'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {camiones.length === 0 && !loading ? (
              <div className="text-center p-4 border-2 border-dashed border-gray-300 rounded-xl">
                <p className="text-sm font-bold text-gray-500">No hay camiones con turno iniciado.</p>
              </div>
            ) : (
              camiones.map(camion => {
                const tieneGPS = camion.lat !== null && camion.lng !== null;
                
                return (
                  <div 
                    key={camion.id} 
                    onClick={() => enfocarCamion(camion)}
                    className={`border-2 border-black p-3 rounded-xl cursor-pointer transition-all ${
                      camionSeleccionado?.id === camion.id 
                        ? 'bg-yellow-100 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1' 
                        : !tieneGPS 
                          ? 'bg-gray-100 opacity-60 grayscale'
                          : 'bg-white hover:bg-gray-100 shadow-sm'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-lg text-gray-900 leading-none">{camion.placa}</h3>
                      {tieneGPS ? (
                        <span className="text-[9px] font-black bg-green-200 text-green-800 px-2 py-0.5 rounded border border-green-400 uppercase">GPS ON</span>
                      ) : (
                        <span className="text-[9px] font-black bg-orange-200 text-orange-800 px-2 py-0.5 rounded border border-orange-400 uppercase">INICIANDO...</span>
                      )}
                    </div>
                    
                    <div className="text-xs font-bold text-gray-600 space-y-1">
                      <p className="flex justify-between">
                        <span>👤 Conductor:</span>
                        <span className="text-gray-900">{camion.profiles?.nombre?.split(' ')[0] || 'N/A'}</span>
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* TARJETA 2: ZONAS Y GEOCERCAS */}
        <div className="bg-white rounded-2xl border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex-1 overflow-hidden flex flex-col min-h-0">
          
          <div className="p-4 border-b-4 border-black bg-gray-50 shrink-0 flex justify-between items-center">
            <h2 className="font-black text-lg tracking-tight uppercase flex items-center gap-2 text-black">
              🗺 Zonas
            </h2>
            <p className="text-xs text-gray-500 font-bold bg-gray-200 px-2 py-1 rounded border border-gray-300">
              {zonasFiltradas.length} Áreas
            </p>
          </div>

          <div className="p-3 border-b-4 text-black border-black bg-gray-100 shrink-0">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-bold">🔍</span>
              <input 
                type="text" 
                placeholder="Filtrar zona..."
                value={filtroZona}
                onChange={(e) => setFiltroZona(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border-2 border-black rounded-lg text-sm outline-none focus:ring-2 focus:ring-black bg-white font-medium"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {zonasFiltradas.length === 0 && !loading ? (
              <div className="text-center p-4">
                <p className="text-sm font-bold text-gray-500">No se encontraron zonas.</p>
              </div>
            ) : (
              zonasFiltradas.map(zona => (
                <div 
                  key={zona.id} 
                  onClick={() => enfocarZona(zona)}
                  className="border-2 border-black p-3 rounded-xl cursor-pointer transition-all bg-white hover:bg-blue-50 shadow-sm hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-1 group"
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-black text-sm text-gray-900 leading-none group-hover:text-blue-700">{zona.nombre}</h3>
                    <span className="text-[10px] font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded border border-gray-400">
                      {zona.radio_metros}m
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </aside>
    </div>
  );
}