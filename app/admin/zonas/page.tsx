"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/lib/supabase';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

// 1. Creador de Geometría Visual (Individual)
// Mapbox no dibuja círculos perfectos usando radios nativamente.
// Esta función convierte un punto (centro) y un radio en un polígono de 64 lados
// que simula ser un círculo, para mostrar el área de cobertura mientras se crea/edita.
const crearCirculoGeoJSON = (centro: {lat: number, lng: number}, radioMetros: number) => {
  if (!centro) return null;
  const km = radioMetros / 1000; // Pasamos a kilómetros
  
  // Fórmulas para calcular la deformación del mapa según la latitud (la Tierra no es plana)
  const distanceX = km / (111.320 * Math.cos(centro.lat * Math.PI / 180));
  const distanceY = km / 110.574;
  
  const puntos = [];
  // Dibujamos los 64 puntos del perímetro
  for (let i = 0; i < 64; i++) {
    const theta = (i / 64) * (2 * Math.PI);
    const x = distanceX * Math.cos(theta);
    const y = distanceY * Math.sin(theta);
    puntos.push([centro.lng + x, centro.lat + y]);
  }
  puntos.push(puntos[0]); // Cerramos la figura conectando el último punto al primero

  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [puntos] }
    }]
  };
};

// 2. FÓRMULA DE HAVERSINE
// Calcula la distancia exacta en línea recta (en metros) entre dos coordenadas GPS.
// Se usa para evitar que al crear una nueva zona, su radio se solape/choque con el de otra zona existente.
const calcularDistancia = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // Radio de la Tierra en metros
  const rad = Math.PI / 180; // Factor de conversión a radianes
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  
  // Matemática esférica para medir distancias curvas
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c; 
};

export default function AdminZonasPage() {
  const [zonas, setZonas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  
  const [mostrarTodasGeocercas, setMostrarTodasGeocercas] = useState(false);
  
  const [nombre, setNombre] = useState('');
  const [radio, setRadio] = useState(1000);
  const [puntoSeleccionado, setPuntoSeleccionado] = useState<{lat: number, lng: number} | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const [viewState, setViewState] = useState({
    longitude: -68.1300,
    latitude: -16.5000,
    zoom: 12
  });

  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const radioGeoJSON: any = useMemo(() => {
    return puntoSeleccionado ? crearCirculoGeoJSON(puntoSeleccionado, radio) : null;
  }, [puntoSeleccionado, radio]);

  const todasGeocercasGeoJSON: any = useMemo(() => {
    if (!mostrarTodasGeocercas || zonas.length === 0) return null;
    
    const features = zonas.map(z => {
      const km = z.radio_metros / 1000;
      const distanceX = km / (111.320 * Math.cos(z.centro_lat * Math.PI / 180));
      const distanceY = km / 110.574;
      const puntos = [];
      for (let i = 0; i < 64; i++) {
        const theta = (i / 64) * (2 * Math.PI);
        puntos.push([z.centro_lng + distanceX * Math.cos(theta), z.centro_lat + distanceY * Math.sin(theta)]);
      }
      puntos.push(puntos[0]);
      
      return {
        type: 'Feature',
        properties: { id: z.id, nombre: z.nombre },
        geometry: { type: 'Polygon', coordinates: [puntos] }
      };
    });

    return { type: 'FeatureCollection', features };
  }, [mostrarTodasGeocercas, zonas]);

  useEffect(() => {
    cargarZonas();
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.resize();
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setErrorForm(null);
  }, [nombre, radio, puntoSeleccionado]);

  const cargarZonas = async () => {
    setLoading(true);
    const { data } = await supabase.from('zonas').select('*');
    if (data) setZonas(data);
    setLoading(false);
  };

  const handleMapClick = (evt: any) => {
    setPuntoSeleccionado({ lat: evt.lngLat.lat, lng: evt.lngLat.lng });
  };

  // NUEVA FUNCIÓN: Anima el mapa hacia las coordenadas de la zona
  const enfocarZona = (lng: number, lat: number) => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 15,
        duration: 1500, // Duración de la animación en milisegundos
        essential: true // Asegura que la animación ocurra
      });
    }
  };

  // --- GUARDAR O ACTUALIZAR ZONA (GEOCERCA) ---
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Validaciones básicas
    if (!puntoSeleccionado) return setErrorForm("Primero debes hacer clic en el mapa para fijar el centro.");
    if (!nombre.trim()) return setErrorForm("El nombre es obligatorio.");

    // 2. Validación de Nombre Único: Asegurarnos de que no haya otra zona que se llame igual
    const nombreExiste = zonas.some(
      z => z.nombre.toLowerCase().trim() === nombre.toLowerCase().trim() && z.id !== editandoId
    );
    if (nombreExiste) return setErrorForm(`Ya existe una zona llamada "${nombre}".`);

    // 3. Validación Anti-Colisión: Comprobamos si nos estamos solapando con otra zona
    const zonaInvadida = zonas.find(z => {
      // Si estamos editando, ignoramos comprobarnos contra nosotros mismos
      if (z.id === editandoId) return false;
      
      // Calculamos a qué distancia estamos del centro de la otra zona
      const distanciaMetros = calcularDistancia(puntoSeleccionado.lat, puntoSeleccionado.lng, z.centro_lat, z.centro_lng);
      
      // Si la distancia entre los dos centros es MENOR que la suma de sus radios, significa que las áreas se están chocando
      return distanciaMetros < (radio + z.radio_metros);
    });

    // Si hubo choque/colisión, detenemos el guardado
    if (zonaInvadida) {
      return setErrorForm(`¡Colisión! Invades la zona "${zonaInvadida.nombre}".`);
    }

    // 4. Preparamos la información limpia para mandarla a la base de datos
    const payload = {
      nombre: nombre.trim(),
      centro_lat: puntoSeleccionado.lat,
      centro_lng: puntoSeleccionado.lng,
      radio_metros: radio
    };

    // 5. Actualizamos o Creamos según corresponda
    if (editandoId) {
      await supabase.from('zonas').update(payload).eq('id', editandoId);
    } else {
      await supabase.from('zonas').insert([payload]);
    }

    // Borramos el formulario y recargamos la lista actualizada
    limpiarFormulario();
    cargarZonas();
  };

  const handleEliminar = async (id: string) => {
    if (confirm("¿Estás seguro de eliminar esta zona?")) {
      await supabase.from('zonas').delete().eq('id', id);
      cargarZonas();
    }
  };

  const cargarParaEditar = (zona: any) => {
    setEditandoId(zona.id);
    setNombre(zona.nombre);
    setRadio(zona.radio_metros);
    setPuntoSeleccionado({ lat: zona.centro_lat, lng: zona.centro_lng });
    
    // Al editar también animamos suavemente hacia esa zona
    enfocarZona(zona.centro_lng, zona.centro_lat);
    setErrorForm(null);
  };

  const limpiarFormulario = () => {
    setEditandoId(null);
    setNombre('');
    setRadio(1000);
    setPuntoSeleccionado(null);
    setErrorForm(null);
  };

  const zonasFiltradas = zonas.filter(z => 
    z.nombre.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4 min-w-0 w-full">
      
      {/* MAPA CENTRAL */}
      <div ref={mapContainerRef} className="flex-1 relative bg-white rounded-2xl shadow-sm border-2 border-black overflow-hidden min-w-0 h-full">
        <Map
          ref={mapRef}
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          onClick={handleMapClick}
          mapStyle="mapbox://styles/mapbox/streets-v12"
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          cursor={puntoSeleccionado ? 'pointer' : 'crosshair'}
        >
          <NavigationControl position="top-left" />
          
          {todasGeocercasGeoJSON && (
            <Source id="todas-geocercas-source" type="geojson" data={todasGeocercasGeoJSON}>
              <Layer id="todas-geocercas-fill" type="fill" paint={{ 'fill-color': '#9ca3af', 'fill-opacity': 0.3 }} />
              <Layer id="todas-geocercas-outline" type="line" paint={{ 'line-color': '#4b5563', 'line-width': 1.5, 'line-dasharray': [2, 2] }} />
            </Source>
          )}

          {radioGeoJSON && (
            <Source id="radio-source" type="geojson" data={radioGeoJSON}>
              <Layer id="radio-fill" type="fill" paint={{ 'fill-color': errorForm ? '#ef4444' : '#3b82f6', 'fill-opacity': 0.2 }} />
              <Layer id="radio-outline" type="line" paint={{ 'line-color': errorForm ? '#b91c1c' : '#1d4ed8', 'line-width': 2, 'line-dasharray': [2, 2] }} />
            </Source>
          )}

          {puntoSeleccionado && (
            <Marker longitude={puntoSeleccionado.lng} latitude={puntoSeleccionado.lat} anchor="bottom">
              <div className={`${errorForm ? 'text-red-600' : 'text-blue-600'} animate-bounce drop-shadow-lg`}>
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-4.198 0-8 3.403-8 7.602 0 4.198 3.469 9.21 8 16.398 4.531-7.188 8-12.2 8-16.398 0-4.199-3.801-7.602-8-7.602zm0 11c-1.657 0-3-1.343-3-3s1.343-3 3-3 3 1.343 3 3-1.343 3-3 3z"/></svg>
              </div>
            </Marker>
          )}

          {zonas.map(z => (
            <Marker key={z.id} longitude={z.centro_lng} latitude={z.centro_lat}>
              <div className="flex flex-col items-center">
                <div className="bg-white/90 border-2 border-black px-2 py-0.5 rounded text-[10px] font-bold shadow-sm mb-1 text-black">
                  {z.nombre}
                </div>
                <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-black"></div>
              </div>
            </Marker>
          ))}
        </Map>
      </div>

      {/* SIDEBAR DERECHO */}
      <aside className="w-80 flex flex-col gap-4 shrink-0 h-full">
        
        {/* Formulario */}
        <div className="bg-white p-5 rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] shrink-0">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            {editandoId ? "📝 Editar Geocerca" : "➕ Crear Geocerca"}
          </h3>

          {errorForm && (
            <div className="mb-4 bg-red-50 border-2 border-red-500 p-3 rounded-lg text-xs font-bold text-red-700 shadow-sm animate-pulse">
              ⚠️ {errorForm}
            </div>
          )}

          <form onSubmit={handleGuardar} className="space-y-4">
            <input 
              type="text" 
              required
              placeholder="Nombre del Barrio/Zona"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 border-2 border-black rounded-lg text-yellow-600 font-bold outline-none"
            />
            
            <div className="flex flex-col gap-2 p-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 uppercase">Radio de Cobertura:</label>
                <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">{radio} m</span>
              </div>
              <input 
                type="range" 
                min="100" max="3000" step="50"
                value={radio}
                onChange={(e) => setRadio(Number(e.target.value))}
                className="w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="submit" 
                className="flex-1 bg-blue-600 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-white font-bold py-2 rounded-lg hover:bg-blue-700 active:translate-y-1 active:shadow-none transition-all"
              >
                {editandoId ? "Actualizar" : "Guardar"}
              </button>
              {editandoId && (
                <button 
                  type="button"
                  onClick={limpiarFormulario}
                  className="px-3 py-2 border-2 border-black text-black rounded-lg bg-red-400 hover:bg-red-500 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none"
                >
                  ✖
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Lista de Zonas con Buscador y BOTÓN DE VISTA GLOBAL */}
        <div className="bg-white rounded-2xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex-1 overflow-hidden flex flex-col min-h-0">
          
          <div className="p-4 border-b-2 border-black bg-gray-50 flex flex-col gap-3 shrink-0">
            <div className="flex justify-between items-center">
              <span className="font-bold text-black text-sm uppercase">Zonas Creadas</span>
              <button onClick={cargarZonas} className="text-xs text-black font-bold hover:underline bg-white border border-black px-2 py-1 rounded">Refrescar 🔄</button>
            </div>
            
            <button
              onClick={() => setMostrarTodasGeocercas(!mostrarTodasGeocercas)}
              className={`w-full text-xs font-bold py-2 border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all ${
                mostrarTodasGeocercas ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black hover:bg-gray-300'
              }`}
            >
              {mostrarTodasGeocercas ? '👁 Ocultar Geocercas Globales' : '🗺 Mostrar Todas las Geocercas'}
            </button>
          </div>
          
          {/* BUSCADOR */}
          <div className="p-3 border-b text-black border-gray-200 bg-white shrink-0">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-bold">🔍</span>
              <input 
                type="text" 
                placeholder="Filtrar por nombre..."
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border-2 border-black rounded-lg text-sm outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-xs text-blue-600 font-bold animate-pulse">Cargando...</p>
            ) : zonasFiltradas.length === 0 ? (
              <p className="p-4 text-xs text-gray-500 font-medium">No se encontraron zonas.</p>
            ) : (
              zonasFiltradas.map(zona => (
                // SECCIÓN MODIFICADA: Cursor pointer y evento onClick para el enfoque
                <div 
                  key={zona.id} 
                  className="p-4 border-b border-gray-200 last:border-0 hover:bg-blue-50 transition-colors group cursor-pointer"
                  onClick={() => enfocarZona(zona.centro_lng, zona.centro_lat)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">{zona.nombre}</p>
                      <p className="text-[10px] text-gray-500 font-bold mt-1 bg-gray-100 w-max px-2 py-0.5 rounded border border-gray-200">
                        Cobertura: {zona.radio_metros}m
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); // Evita que se dispare dos veces el click
                        cargarParaEditar(zona); 
                      }}
                      className="text-[10px] font-bold text-blue-700 bg-blue-100 border border-blue-300 px-3 py-1.5 rounded hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                    >
                      EDITAR
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation(); // Evita que al eliminar se anime la cámara
                        handleEliminar(zona.id);
                      }}
                      className="text-[10px] font-bold text-red-700 bg-red-100 border border-red-300 px-3 py-1.5 rounded hover:bg-red-600 hover:text-white transition-all shadow-sm"
                    >
                      ELIMINAR
                    </button>
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