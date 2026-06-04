// app/api/crear-usuario/route.js (Next.js API route)
import {supabase} from '@/lib/supabase'
 
export async function POST(request: Request) {
  const { nombre, email, password, rol } = await request.json()
 
  // Verificar que solo admin puede crear usuarios
  const { data: { user } } = await supabase.auth.getUser()
 
  // Crear usuario en auth.users
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: {
      nombre,
      rol // 'conductor' o 'admin'
    },
    email_confirm: true // confirma email directo sin verificación
  })
 
  if (error) {
    return Response.json({ error: error.message }, { status: 400 })
  }
 
  return Response.json({ success: true, user: data.user })
}