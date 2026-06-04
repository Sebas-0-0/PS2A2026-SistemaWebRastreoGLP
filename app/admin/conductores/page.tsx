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
  const [mostrarModalAdminCrear, setMostrarModalAdminCrear] = useState(false); // NUEVO: modal crear admin
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [idParaActivar, setIdParaActivar] = useState<string | null>(null);
 
  // Formulario Conductor (existente)
  const [nombre, setNombre] = useState("");
  const [ci, setCi] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
 
  // Formulario Administrador (nuevo)
  const [nombreAdmin, setNombreAdmin] = useState("");
  const [emailAdmin, setEmailAdmin] = useState("");
  const [passwordAdmin, setPasswordAdmin] = useState("");
  const [rolAdmin, setRolAdmin] = useState<"conductor" | "admin">("admin");
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [errorAdminForm, setErrorAdminForm] = useState<string | null>(null);
  const [successAdmin, setSuccessAdmin] = useState(false);
 
  // Verificación Admin (reactivación)
  const [passAdmin, setPassAdmin] = useState("");
  const [errorAdmin, setErrorAdmin] = useState<string | null>(null);
 
  useEffect(() => {
    cargarConductores();
  }, [verInactivos]);
 
  const cargarConductores = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("rol", "conductor")
      .eq("activo", !verInactivos);
 
    if (data) setConductores(data);
    setLoading(false);
  };
 
  // --- CRUD Conductores (existente) ---
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
 
  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcesando(true);
    setErrorForm(null);
 
    if (editandoId) {
      const { error } = await supabase
        .from("profiles")
        .update({ nombre, ci })
        .eq("id", editandoId);
 
      if (error) setErrorForm(error.message);
      else cerrarModal();
    } else {
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
 
  const handleBajaLogica = async (id: string, nombre: string) => {
    if (
      confirm(
        `¿Mandar a inactivo al conductor ${nombre}? Ya no podrá usar la app.`
      )
    ) {
      await supabase.from("profiles").update({ activo: false }).eq("id", id);
      cargarConductores();
    }
  };
 
  const solicitarActivacion = (id: string) => {
    setIdParaActivar(id);
    setPassAdmin("");
    setErrorAdmin(null);
    setMostrarModalAdmin(true);
  };
 
  const confirmarActivacionAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcesando(true);
    setErrorAdmin(null);
 
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: passAdmin,
    });
 
    if (error) {
      setErrorAdmin("Contraseña de administrador incorrecta.");
      setProcesando(false);
      return;
    }
 
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
 
  // --- NUEVO: Crear Administrador vía API ---
  const handleCrearAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingAdmin(true);
    setErrorAdminForm(null);
    setSuccessAdmin(false);
 
    const response = await fetch("/api/crear-usuario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: nombreAdmin,
        email: emailAdmin,
        password: passwordAdmin,
        rol: rolAdmin,
      }),
    });
 
    const data = await response.json();
 
    if (data.error) {
      setErrorAdminForm(data.error);
    } else {
      setSuccessAdmin(true);
      setNombreAdmin("");
      setEmailAdmin("");
      setPasswordAdmin("");
      // Opcional: cerrar modal después de 2 segundos
      setTimeout(() => {
        setMostrarModalAdminCrear(false);
        setSuccessAdmin(false);
      }, 1500);
    }
 
    setLoadingAdmin(false);
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
<>
<button
                onClick={abrirModalCrear}
                className="bg-blue-600 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 whitespace-nowrap"
>
                + Nuevo Conductor
</button>
              {/* NUEVO BOTÓN: CREAR ADMINISTRADOR */}
<button
                onClick={() => {
                  setMostrarModalAdminCrear(true);
                  setErrorAdminForm(null);
                  setSuccessAdmin(false);
                }}
                className="bg-purple-600 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-white font-bold py-3 px-6 rounded-xl hover:bg-purple-700 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 whitespace-nowrap"
>
                + Crear Administrador
</button>
</>
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
<div className="bg-gray-50 border-2 border-black rounded-xl p-3 flex flex-col gap-2">
<div className="flex justify-between items-center text-sm">
<span className="text-gray-500 font-bold">Identificador:</span>
<span className="font-mono text-xs font-bold text-black bg-gray-200 px-2 py-1 rounded border border-gray-300">
                    {conductor.id.substring(0, 8)}...
</span>
</div>
<div className="flex justify-between items-center text-sm border-t border-gray-200 pt-2 mt-1">
<span className="text-gray-500 font-bold">Último acceso:</span>
<span className="font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded border border-blue-200 text-xs">
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
 
      {/* MODAL CONDUCTOR (CREAR/EDITAR) - SIN CAMBIOS */}
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
                  className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-yellow-600 focus:bg-blue-50"
                />
</div>
<div>
<label className="block text-xs font-black text-black uppercase mb-1">
                  C.I.
</label>
<input
                  type="text"
                  required
                  value={ci}
                  onChange={(e) => setCi(e.target.value.toUpperCase())}
                  className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-yellow-600 focus:bg-blue-50"
                />
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
                      className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-yellow-600 focus:bg-blue-50"
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
                      className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-yellow-600 focus:bg-blue-50"
                    />
</div>
</>
              )}
<button
                type="submit"
                disabled={procesando}
                className="w-full bg-yellow-400 border-2 border-black py-4 font-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all mt-2 disabled:bg-gray-300"
>
                {procesando ? "Guardando..." : "GUARDAR DATOS"}
</button>
</form>
</div>
</div>
      )}
 
      {/* MODAL VERIFICACIÓN ADMIN (para reactivar) - SIN CAMBIOS */}
      {mostrarModalAdmin && (
<div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
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
 
      {/* NUEVO MODAL: CREAR ADMINISTRADOR (vía API) */}
      {mostrarModalAdminCrear && (
<div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
<div className="bg-white border-4 border-black rounded-2xl w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
<div className="bg-purple-700 p-4 border-b-4 border-black flex justify-between">
<h2 className="text-xl font-black text-white">
                Crear Administrador
</h2>
<button
                onClick={() => setMostrarModalAdminCrear(false)}
                className="text-white font-black bg-red-500 px-2 border-2 border-black rounded hover:bg-red-400"
>
                X
</button>
</div>
<form onSubmit={handleCrearAdmin} className="p-6 space-y-4">
              {errorAdminForm && (
<div className="bg-red-100 border-2 border-red-500 p-2 text-xs font-bold text-red-700">
                  {errorAdminForm}
</div>
              )}
              {successAdmin && (
<div className="bg-green-100 border-2 border-green-500 p-2 text-xs font-bold text-green-700">
                  ✅ Administrador creado correctamente
</div>
              )}
 
              <div>
<label className="block text-xs font-black text-black uppercase mb-1">
                  Nombre Completo
</label>
<input
                  type="text"
                  required
                  value={nombreAdmin}
                  onChange={(e) => setNombreAdmin(e.target.value.toUpperCase())}
                  className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-purple-700 focus:bg-purple-50"
                />
</div>
<div>
<label className="block text-xs font-black text-black uppercase mb-1">
                  Email
</label>
<input
                  type="email"
                  required
                  value={emailAdmin}
                  onChange={(e) => setEmailAdmin(e.target.value)}
                  className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-purple-700 focus:bg-purple-50"
                />
</div>
<div>
<label className="block text-xs font-black text-black uppercase mb-1">
                  Contraseña
</label>
<input
                  type="password"
                  required
                  minLength={8}
                  value={passwordAdmin}
                  onChange={(e) => setPasswordAdmin(e.target.value)}
                  className="w-full p-3 border-2 border-black rounded-xl font-bold outline-none text-purple-700 focus:bg-purple-50"
                />
</div>
<div>
<label className="block text-xs font-black text-black uppercase mb-1">
                  Rol
</label>
<select
                  value={rolAdmin}
                  onChange={(e) =>
                    setRolAdmin(e.target.value as "conductor" | "admin")
                  }
                  className="w-full p-3 border-2 border-black rounded-xl font-bold bg-white"
>
<option value="admin">Administrador</option>
<option value="conductor">Conductor</option>
</select>
</div>
<button
                type="submit"
                disabled={loadingAdmin}
                className="w-full bg-purple-600 border-2 border-black py-4 font-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-1 active:shadow-none transition-all mt-2 disabled:bg-gray-300 text-white"
>
                {loadingAdmin ? "Creando..." : "CREAR ADMINISTRADOR"}
</button>
</form>
</div>
</div>
      )}
</div>
  );
}