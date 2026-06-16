"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function AdminCamionesPage() {
  const [camiones, setCamiones] = useState<any[]>([]);
  const [conductores, setConductores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');

  // Estados del Modal y Formulario
  const [mostrarModal, setMostrarModal] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [placa, setPlaca] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [año, setAño] = useState('');
  const [conductorId, setConductorId] = useState('');
  const [estado, setEstado] = useState('Activo');
  
  // ESTADOS DE PROCESAMIENTO Y ERROR
  const [procesando, setProcesando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  // --- EFECTO AUTOMÁTICO PARA EL ESTADO ---
  // Si se queda sin conductor, forzamos visualmente el estado a "Fuera de Servicio"
  useEffect(() => {
    if (conductorId === '') {
      setEstado('Fuera de Servicio');
    }
  }, [conductorId]);

  const cargarDatos = async () => {
    setLoading(true);
    
    const { data: dataCamiones } = await supabase
      .from('camiones')
      .select('*, profiles(nombre)');
    
    const { data: dataConductores } = await supabase
      .from('profiles')
      .select('id, nombre')
      .eq('rol', 'conductor')
      .eq('activo', true);

    if (dataCamiones) setCamiones(dataCamiones);
    if (dataConductores) setConductores(dataConductores);
    setLoading(false);
  };

  const conductoresDisponibles = conductores.filter(conductor => {
    const estaAsignado = camiones.some(c => c.conductor_id === conductor.id);
    if (!estaAsignado) return true;
    if (editandoId) {
      const camionActual = camiones.find(c => c.id === editandoId);
      if (camionActual && camionActual.conductor_id === conductor.id) {
        return true;
      }
    }
    return false;
  });

  const abrirModalCrear = () => {
    setEditandoId(null);
    setPlaca('');
    setMarca('');
    setModelo('');
    setAño('');
    setConductorId('');
    setEstado('Fuera de Servicio'); // Inicia por defecto sin conductor, así que es Fuera de Servicio
    setErrorForm(null);
    setMostrarModal(true);
  };

  const abrirModalEditar = (camion: any) => {
    setEditandoId(camion.id);
    setPlaca(camion.placa);
    setMarca(camion.marca || '');
    setModelo(camion.modelo || '');
    setAño(camion.año?.toString() || '');
    setConductorId(camion.conductor_id || '');
    setEstado(camion.estado || 'Activo');
    setErrorForm(null);
    setMostrarModal(true);
  };

  const handlePlacaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const esParcialmenteValido = /^(?:\d{0,4}|\d{3}[A-Z]{1,3}|\d{4}[A-Z]{1,3})$/.test(input);

    if (esParcialmenteValido) {
      setPlaca(input);
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcesando(true);
    setErrorForm(null);

    // 1. Validación de formato completo
    const placaRegex = /^\d{3,4}[A-Z]{3}$/;
    
    if (!placaRegex.test(placa)) {
      setErrorForm("La placa está incompleta. Debe tener 3 o 4 números seguidos de 3 letras.");
      setProcesando(false);
      return;
    }

    // 2. Validación de duplicidad
    const placaDuplicada = camiones.some(
      (c) => c.placa === placa && c.id !== editandoId
    );

    if (placaDuplicada) {
      setErrorForm(`¡Error! La placa ${placa} ya se encuentra registrada en otro vehículo del sistema.`);
      setProcesando(false);
      return;
    }

    // --- 3. VALIDACIÓN DE ESTADO---
    // Aseguramos nivel base de datos que si conductor_id es null, estado sea "Fuera de Servicio"
    const estadoFinal = conductorId ? estado : 'Fuera de Servicio';

    const payload = {
      placa: placa,
      marca: marca.trim(),
      modelo: modelo.trim(),
      año: año ? parseInt(año) : null,
      conductor_id: conductorId || null,
      estado: estadoFinal
    };

    let error;
    if (editandoId) {
      const { error: updateError } = await supabase.from('camiones').update(payload).eq('id', editandoId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('camiones').insert([payload]);
      error = insertError;
    }

    if (error) {
      setErrorForm("Error al guardar: " + error.message);
      setProcesando(false);
    } else {
      setMostrarModal(false);
      setProcesando(false);
      cargarDatos();
    }
  };

  const handleEliminar = async (id: string, placa: string) => {
    if (confirm(`¿Eliminar el camión ${placa}?`)) {
      await supabase.from('camiones').delete().eq('id', id);
      cargarDatos();
    }
  };

  const camionesFiltrados = camiones.filter(c => {
    const termino = filtro.toLowerCase();
    const placaValida = (c.placa || '').toLowerCase().includes(termino);
    const marcaValida = (c.marca || '').toLowerCase().includes(termino);
    const conductorValido = (c.profiles?.nombre || '').toLowerCase().includes(termino);
    
    return placaValida || marcaValida || conductorValido;
  });

  return (
    <div className="flex flex-col h-full gap-6 max-w-7xl mx-auto w-full">
      {/* CABECERA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">Gestión de Camiones</h1>
          <p className="text-gray-500 font-bold mt-1">Control de vehículos y conductores asignados.</p>
        </div>
        <button onClick={abrirModalCrear} className="bg-yellow-400 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black font-black py-3 px-6 rounded-xl hover:bg-yellow-300 active:translate-y-1 active:shadow-none transition-all">
          + Agregar Camión
        </button>
      </div>

      {/* BUSCADOR */}
      <div className="bg-white border-2 border-black rounded-xl p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3">
        <span className="text-xl ml-2">🔍</span>
        <input 
          type="text" 
          placeholder="Buscar por placa, marca o nombre del conductor..." 
          value={filtro} 
          onChange={(e) => setFiltro(e.target.value)} 
          className="w-full outline-none font-bold text-gray-700 bg-transparent placeholder-gray-400" 
        />
        {filtro && (
          <button onClick={() => setFiltro('')} className="font-black text-gray-400 hover:text-red-500 mr-2">X</button>
        )}
      </div>

      {/* LISTADO DE CARDS */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-blue-600 font-black animate-bounce mt-10">CARGANDO...</div>
      ) : camionesFiltrados.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl flex-1 flex flex-col items-center justify-center text-gray-500 py-20 mt-4">
          <p className="font-bold text-lg">No se encontraron vehículos</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
          {camionesFiltrados.map(camion => (
            <div key={camion.id} className="bg-white border-2 border-black rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4 relative">
              <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[10px] font-black border-2 border-black shadow-sm ${
                camion.estado === 'Activo' ? 'bg-green-300 text-black' : 
                camion.estado === 'Mantenimiento' ? 'bg-orange-300 text-black' : 'bg-red-300 text-black'
              }`}>
                {camion.estado?.toUpperCase() || 'ACTIVO'}
              </div>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 border-2 border-black rounded-xl flex items-center justify-center text-2xl shadow-sm">🚚</div>
                <div className="min-w-0">
                  <h3 className="font-black text-2xl text-gray-900 leading-none truncate">{camion.placa || 'SIN PLACA'}</h3>
                  <p className="text-xs text-gray-500 font-bold mt-1 uppercase truncate">
                    {camion.marca} {camion.modelo} {camion.año ? `(${camion.año})` : ''}
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 border-2 border-black rounded-xl p-3">
                <p className="text-xs text-gray-500 font-bold mb-1">CONDUCTOR RESPONSABLE</p>
                <p className="font-black text-gray-800 flex items-center gap-2">
                  <span className={camion.profiles?.nombre ? "text-blue-700" : "text-red-500"}>
                    {camion.profiles?.nombre || '⚠️ SIN ASIGNAR'}
                  </span>
                </p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => abrirModalEditar(camion)} className="flex-1 bg-blue-600 border-2 border-black font-black py-2 rounded-lg hover:bg-blue-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all text-white">EDITAR</button>
                <button onClick={() => handleEliminar(camion.id, camion.placa)} className="bg-red-100 text-red-800 border-2 border-black font-black px-4 py-2 rounded-lg hover:bg-red-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black rounded-2xl w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <div className="bg-blue-900 p-4 border-b-4 border-black flex justify-between items-center text-white">
              <h2 className="text-xl font-black">{editandoId ? 'Editar Vehículo' : 'Nuevo Vehículo'}</h2>
              <button onClick={() => setMostrarModal(false)} className="bg-red-500 border-2 border-black px-2 rounded font-black hover:bg-red-400">X</button>
            </div>

            <form onSubmit={handleGuardar} className="p-6 space-y-4">
              
              {/* CAJA DE ERROR */}
              {errorForm && (
                <div className="bg-red-50 border-2 border-red-500 p-3 rounded-xl text-xs font-bold text-red-700 shadow-sm animate-pulse">
                  ⚠️ {errorForm}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs text-black font-black uppercase mb-1">Número de Placa</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={7}
                    value={placa} 
                    onChange={handlePlacaChange} 
                    className="w-full p-3 border-2 border-black rounded-xl font-black outline-none text-blue-800 focus:bg-blue-50" 
                    placeholder="Ej: 1234ABC" 
                  />
                  <p className="text-[10px] text-gray-500 font-bold mt-1">Formato: 3/4 números y 3 letras juntas.</p>
                </div>
                <div>
                  <label className="block text-xs text-black font-black uppercase mb-1">Marca</label>
                  <input type="text" required value={marca} onChange={(e) => setMarca(e.target.value)} className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-blue-800 focus:bg-blue-50" 
                  placeholder="Ej: Volvo" />
                </div>
                <div>
                  <label className="block text-xs text-black font-black uppercase mb-1">Modelo</label>
                  <input type="text" required value={modelo} onChange={(e) => setModelo(e.target.value)} className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-blue-800 focus:bg-blue-50" 
                  placeholder="Ej: FH" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-black font-black uppercase mb-1">Año de Fabricación</label>
                  <input type="number" required value={año} onChange={(e) => setAño(e.target.value)} className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-blue-800 focus:bg-blue-50" min="1990" 
                  placeholder="Ej: 2022"/>
                </div>
              </div>

              <div>
                <label className="block text-xs text-black font-black uppercase mb-1">Asignar Conductor</label>
                <select 
                  value={conductorId} 
                  onChange={(e) => setConductorId(e.target.value)}
                  className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none bg-white text-gray-700 focus:bg-blue-50 cursor-pointer"
                >
                  <option value="">-- Sin conductor asignado --</option>
                  {conductoresDisponibles.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* SELECTOR DE ESTADO CON BLOQUEO INTELIGENTE */}
              <div>
                <label className="block text-xs text-black font-black uppercase mb-1">Estado</label>
                <select 
                  value={!conductorId ? 'Fuera de Servicio' : estado} 
                  onChange={(e) => setEstado(e.target.value)} 
                  disabled={!conductorId}
                  className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none bg-white text-gray-700 focus:bg-blue-50 cursor-pointer disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <option value="Activo">Activo (En servicio)</option>
                  <option value="Mantenimiento">Mantenimiento</option>
                  <option value="Fuera de Servicio">Fuera de Servicio</option>
                </select>
                {!conductorId && (
                  <p className="text-[10px] text-red-500 font-black mt-1 leading-tight uppercase">
                    Este Camion esta fuera de servicio mientras no tenga asignado un conductor.
                  </p>
                )}
              </div>

              <button type="submit" disabled={procesando} className="w-full bg-yellow-400 border-2 border-black py-4 font-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all mt-4 disabled:bg-gray-300 text-black">
                {procesando ? 'GUARDANDO...' : 'CONFIRMAR DATOS'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}