import { supabase } from '@/lib/supabase'

export async function POST(request: Request) {
  // 1. Recibimos el 'ci' en la desestructuración del JSON que nos manda la web
  const { nombre, ci, email, password, rol } = await request.json()

  // Verificar que solo admin puede crear usuarios
  const { data: { user } } = await supabase.auth.getUser()

  // Crear usuario en auth.users (Bóveda segura de Supabase)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: {
      nombre,
      ci,     // 2. Guardamos el C.I. en los metadatos del usuario
      rol     // 'conductor' o 'admin'
    },
    email_confirm: true // confirma email directo sin verificación
  })

  if (error) {
    return Response.json({ error: error.message }, { status: 400 })
  }

  return Response.json({ success: true, user: data.user })
}