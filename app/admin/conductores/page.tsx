"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";

const supabaseTemp = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
);

// Función para convertir la fecha de la base de datos a un formato legible
const formatearFecha = (fechaISO: string | null) => {
  if (!fechaISO) return "Nunca";
  const fecha = new Date(fechaISO);
  return fecha.toLocaleString("es-BO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function AdminConductoresPage() {
  const [conductores, setConductores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro de vista y buscador
  const [verInactivos, setVerInactivos] = useState(false);
  const [filtroBusqueda, setFiltroBusqueda] = useState("");

  // Modales
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarModalAdmin, setMostrarModalAdmin] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [idParaActivar, setIdParaActivar] = useState<string | null>(null);

  // Formulario Conductor
  const [nombre, setNombre] = useState("");
  const [ci, setCi] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);

  // Verificación Admin (reactivación)
  const [passAdmin, setPassAdmin] = useState("");
  const [errorAdmin, setErrorAdmin] = useState<string | null>(null);

  useEffect(() => {
    cargarConductores();
  }, [verInactivos]);

  // --- CARGAR LISTA DE CONDUCTORES ---
  // Obtiene los conductores desde la base de datos dependiendo de si queremos ver a los activos o inactivos
  const cargarConductores = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("rol", "conductor") // Solo traemos usuarios con el rol "conductor"
      .eq("activo", !verInactivos); // Filtramos por el estado actual de la vista

    if (data) setConductores(data);
    setLoading(false);
  };

  const abrirModalCrear = () => {
    setEditandoId(null);
    setNombre("");
    setCi("");
    setEmail("");
    setPassword("");
    setErrorForm(null);
    setMostrarModal(true);
  };

  const abrirModalEditar = (conductor: any) => {
    setEditandoId(conductor.id);
    setNombre(conductor.nombre);
    setCi(conductor.ci || "");
    setErrorForm(null);
    setMostrarModal(true);
  };

  // --- LÓGICA DE VALIDACIÓN EN VIVO (C.I. BOLIVIANO ESTRICTO) ---
  // Esta función se activa cada vez que el usuario escribe en el campo de Carnet de Identidad (C.I.)
  // y se encarga de formatear el texto automáticamente.
  const handleCiChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Convierte todo a mayúsculas y quita símbolos raros
    let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    // Separa los números de las letras
    let numeros = val.replace(/[^0-9]/g, "");
    let letras = val.replace(/[^A-Z]/g, "");

    // 1. Límite numérico: máximo 8 números
    if (numeros.length > 8) {
      numeros = numeros.slice(0, 8);
    }

    // 2. Lógica de letras departamentales
    if (numeros.length < 6) {
      letras = ""; // Si no hay al menos 6 números, no permitimos escribir letras
    } else {
      // Solo iniciales válidas de departamentos bolivianos
      const inicialesValidas = ['L', 'S', 'C', 'O', 'P', 'T', 'B']; 
      // Combinaciones finales válidas
      const siglasValidas = ['LP', 'SC', 'CB', 'OR', 'PT', 'CH', 'TJ', 'BE', 'PA'];

      // Máximo 2 letras permitidas
      if (letras.length > 2) letras = letras.slice(0, 2);

      // Si la primera letra no es de un departamento, la borramos
      if (letras.length === 1 && !inicialesValidas.includes(letras)) {
        letras = ""; 
      // Si ya hay 2 letras pero no forman una sigla válida, borramos la segunda
      } else if (letras.length === 2 && !siglasValidas.includes(letras)) {
        letras = letras.slice(0, 1); 
      }
    }

    // Actualizamos el estado con el formato corregido
    setCi(numeros + letras);
  };

  // --- GUARDAR O ACTUALIZAR CONDUCTOR ---
  // Se ejecuta al enviar el formulario (tanto para crear uno nuevo como para editar)
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcesando(true);
    setErrorForm(null);

    // --- VALIDACIÓN FINAL (EXPRESIÓN REGULAR BOLIVIANA) ---
    // Obliga a tener de 6 a 8 números, seguido (opcionalmente) por una de las siglas exactas.
    const ciRegex = /^\d{6,8}(LP|SC|CB|OR|PT|CH|TJ|BE|PA)?$/;
    
    // Si el carnet no cumple con el formato, mostramos error y detenemos el proceso
    if (!ciRegex.test(ci)) {
      setErrorForm("C.I. Inválido. Escribe de 6 a 8 números y, opcionalmente, una extensión válida (LP, SC, CB, OR, PT, CH, TJ, BE, PA).");
      setProcesando(false);
      return;
    }

    if (editandoId) {
      // SI ESTAMOS EDITANDO: Solo actualizamos el nombre y el CI
      const { error } = await supabase
        .from("profiles")
        .update({ nombre, ci })
        .eq("id", editandoId);

      if (error) setErrorForm(error.message);
      else cerrarModal();
    } else {
      // SI ESTAMOS CREANDO: Usamos un cliente temporal para registrar un nuevo usuario sin cerrar la sesión actual del administrador
      const { data, error: authError } = await supabaseTemp.auth.signUp({
        email,
        password,
        options: { data: { nombre, rol: "conductor" } },
      });

      if (authError) {
        setErrorForm(authError.message);
        setProcesando(false);
        return;
      }

      // Una vez creado en autenticación, esperamos medio segundo, le asignamos el CI y lo marcamos como activo en la tabla de perfiles
      setTimeout(async () => {
        if (data.user) {
          await supabase
            .from("profiles")
            .update({ ci, activo: true })
            .eq("id", data.user.id);
          cerrarModal();
        }
      }, 500);
    }
  };

  const cerrarModal = () => {
    setMostrarModal(false);
    setProcesando(false);
    cargarConductores();
  };

  // --- DAR DE BAJA A UN CONDUCTOR ---
  // Deshabilita temporalmente a un conductor (cambia su estado) en lugar de borrarlo completamente
  const handleBajaLogica = async (id: string, nombre: string) => {
    if (
      confirm(
        `¿Mandar a inactivo al conductor ${nombre}? Ya no podrá usar la app.`
      )
    ) {
      // 1. Intentamos cambiar su estado a "activo: false"
      const { error } = await supabase
        .from("profiles")
        .update({ activo: false })
        .eq("id", id);

      // 2. Si hay error, lo mostramos en pantalla en lugar de ignorarlo
      if (error) {
        alert("No se pudo dar de baja. Error de base de datos: " + error.message);
        console.error("Detalle del error:", error);
      } else {
        // 3. Si todo salió bien, recargamos la lista
        cargarConductores();
      }
    }
  };

  const solicitarActivacion = (id: string) => {
    setIdParaActivar(id);
    setPassAdmin("");
    setErrorAdmin(null);
    setMostrarModalAdmin(true);
  };

  // --- REACTIVAR CONDUCTOR (CONFIRMACIÓN DE ADMINISTRADOR) ---
  // Para reactivar un conductor, el admin debe confirmar su propia contraseña por seguridad
  const confirmarActivacionAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcesando(true);
    setErrorAdmin(null);

    // Obtenemos el usuario actual (el administrador que está usando el sistema)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    // Intentamos iniciar sesión con la contraseña que escribió en el modal
    const { error } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: passAdmin,
    });

    // Si la contraseña es incorrecta, mostramos error
    if (error) {
      setErrorAdmin("Contraseña de administrador incorrecta.");
      setProcesando(false);
      return;
    }

    // Si la contraseña fue correcta, cambiamos el estado del conductor a "activo: true"
    if (idParaActivar) {
      await supabase
        .from("profiles")
        .update({ activo: true })
        .eq("id", idParaActivar);
      setMostrarModalAdmin(false);
      cargarConductores();
    }
    setProcesando(false);
  };

  const conductoresFiltrados = conductores.filter((conductor) => {
    const termino = filtroBusqueda.toLowerCase();
    const nombreValido = (conductor.nombre || "").toLowerCase().includes(termino);
    const ciValido = (conductor.ci || "").toLowerCase().includes(termino);
    return nombreValido || ciValido;
  });

  return (
    <div className="flex flex-col h-full gap-6 max-w-7xl mx-auto w-full">
      {/* CABECERA DINÁMICA */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-800 tracking-tight">
            {verInactivos ? "Conductores de Baja" : "Personal Activo"}
          </h1>
          <p className="text-gray-500 font-bold">
            {verInactivos
              ? "Lista de personal deshabilitado del sistema."
              : "Conductores con acceso total a la aplicación móvil."}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setVerInactivos(!verInactivos)}
            className={`border-2 border-black font-black py-3 px-5 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all ${
              verInactivos ? "bg-green-400" : "bg-red-600"
            }`}
          >
            {verInactivos ? "Ver Activos" : "Ver Inactivos"}
          </button>
          
          {!verInactivos && (
            <button
              onClick={abrirModalCrear}
              className="bg-blue-600 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 whitespace-nowrap"
            >
              + Nuevo Conductor
            </button>
          )}
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div className="bg-white border-2 border-black rounded-xl p-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-center gap-3">
        <span className="text-xl ml-2">🔍</span>
        <input
          type="text"
          placeholder="Buscar por nombre o número de C.I..."
          value={filtroBusqueda}
          onChange={(e) => setFiltroBusqueda(e.target.value)}
          className="w-full outline-none font-bold text-gray-700 bg-transparent placeholder-gray-400"
        />
        {filtroBusqueda && (
          <button
            onClick={() => setFiltroBusqueda("")}
            className="font-black text-gray-400 hover:text-red-500 mr-2"
          >
            X
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-blue-600 font-black animate-bounce mt-10">
          CARGANDO...
        </div>
      ) : conductoresFiltrados.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl flex-1 flex flex-col items-center justify-center text-gray-500 py-20 mt-4">
          <svg
            className="w-16 h-16 mb-4 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="font-bold text-lg">No se encontraron resultados</p>
          <p className="text-sm">
            {filtroBusqueda
              ? "Intenta con otro nombre o C.I."
              : "No hay conductores en esta lista."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-8">
          {conductoresFiltrados.map((conductor) => (
            <div
              key={conductor.id}
              className={`bg-white border-2 border-black rounded-2xl p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-4 relative ${
                !conductor.activo ? "opacity-75 grayscale-[0.5]" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-14 h-14 border-2 text-black border-black rounded-xl flex items-center justify-center text-xl font-black shadow-sm shrink-0 ${
                    conductor.activo ? "bg-yellow-200" : "bg-red-300"
                  }`}
                >
                  {conductor.nombre?.charAt(0).toUpperCase() || "C"}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-lg text-gray-900 leading-tight truncate">
                    {conductor.nombre}
                  </h3>
                  <p className="text-xs text-gray-500 font-bold mt-1">
                    C.I.: {conductor.ci || "Sin reg."}
                  </p>
                </div>
              </div>

              {/* IDENTIFICADOR Y ÚLTIMO ACCESO */}
              <div className="bg-gray-50 border-2 border-black rounded-xl p-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500 font-bold">Último acceso a la app:</span>
                  <span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 text-xs shadow-sm">
                    {formatearFecha(conductor.ultimo_acceso)}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 mt-auto pt-2 border-t-2 border-dashed border-gray-200">
                {conductor.activo ? (
                  <>
                    <button
                      onClick={() => abrirModalEditar(conductor)}
                      className="flex-1 bg-blue-100 text-blue-800 border-2 border-black font-black py-2 rounded-lg hover:bg-blue-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
                    >
                      EDITAR
                    </button>
                    <button
                      onClick={() =>
                        handleBajaLogica(conductor.id, conductor.nombre)
                      }
                      className="bg-red-100 text-red-800 border-2 border-black font-black px-4 py-2 rounded-lg hover:bg-red-200 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
                    >
                      BAJA
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => solicitarActivacion(conductor.id)}
                    className="w-full bg-green-400 text-black border-2 border-black font-black py-2 rounded-lg hover:bg-green-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
                  >
                    REACTIVAR CONDUCTOR
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL CONDUCTOR (CREAR/EDITAR) */}
      {mostrarModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black rounded-2xl w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <div className="bg-blue-900 p-4 border-b-4 border-black flex justify-between">
              <h2 className="text-xl font-black text-white">
                {editandoId ? "Actualizar Datos" : "Nuevo Conductor"}
              </h2>
              <button
                onClick={() => setMostrarModal(false)}
                className="text-white font-black bg-red-500 px-2 border-2 border-black rounded hover:bg-red-400"
              >
                X
              </button>
            </div>
            <form onSubmit={handleGuardar} className="p-6 space-y-4">
              {errorForm && (
                <div className="bg-red-100 border-2 border-red-500 p-2 text-xs font-bold text-red-700">
                  {errorForm}
                </div>
              )}
              <div>
                <label className="block text-xs font-black text-black uppercase mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value.toUpperCase())}
                  className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-black focus:bg-blue-50"
                />
              </div>
              
              {/* CAMPO DE C.I. CON EXTENSIONES BOLIVIANAS */}
              <div>
                <label className="block text-xs font-black text-black uppercase mb-1">
                  C.I. Boliviano
                </label>
                <input
                  type="text"
                  required
                  value={ci}
                  onChange={handleCiChange}
                  placeholder="Ej: 1234567LP"
                  className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-black focus:bg-blue-50"
                />
                <p className="text-[10px] text-gray-500 font-bold mt-1 leading-tight">
                  Mínimo 6 números. Extensiones permitidas: LP, SC, CB, OR, PT, CH, TJ, BE, PA.
                </p>
              </div>

              {!editandoId && (
                <>
                  <div>
                    <label className="block text-xs font-black text-black uppercase mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-black bg-blue-50 focus:bg-blue-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-black uppercase mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-black bg-blue-50 focus:bg-blue-100"
                    />
                  </div>
                </>
              )}
              <button
                type="submit"
                disabled={procesando}
                className="w-full bg-yellow-400 border-2 border-black py-4 font-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all mt-4 disabled:bg-gray-300 text-white"
              >
                {procesando ? "Guardando..." : "GUARDAR DATOS"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VERIFICACIÓN ADMIN (para reactivar) */}
      {mostrarModalAdmin && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black rounded-2xl w-full max-w-sm shadow-[10px_10px_0px_0px_rgba(239,68,68,1)] overflow-hidden">
            <div className="bg-red-600 p-4 border-b-4 border-black">
              <h2 className="text-white font-black text-center tracking-tighter">
                🔒 AUTORIZACIÓN REQUERIDA
              </h2>
            </div>
            <form onSubmit={confirmarActivacionAdmin} className="p-6 space-y-4">
              <p className="text-sm font-bold text-center text-gray-600">
                Ingresa tu contraseña de administrador para reactivar a este
                conductor.
              </p>
              {errorAdmin && (
                <div className="bg-red-100 border-2 border-red-500 p-2 text-xs font-black text-red-700 text-center">
                  {errorAdmin}
                </div>
              )}
              <input
                type="password"
                required
                placeholder="Contraseña del Admin"
                value={passAdmin}
                onChange={(e) => setPassAdmin(e.target.value)}
                className="w-full p-3 border-2 border-black text-black rounded-xl font-bold outline-none text-center"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarModalAdmin(false)}
                  className="flex-1 bg-red-400 border-2 border-black font-black py-3 rounded-xl active:translate-y-1 hover:bg-red-500"
                >
                  CANCELAR
                </button>
                <button
                  type="submit"
                  disabled={procesando}
                  className="flex-1 bg-green-400 hover:bg-green-500 border-2 border-black font-black py-3 rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all"
                >
                  CONFIRMAR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}