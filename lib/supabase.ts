import { createClient } from '@supabase/supabase-js';

// Usamos las variables de entorno que configuramos en el .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Este es el cliente estándar que usarás en casi toda tu app (público)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ------------------------------------------------------------------
// CLIENTE ADMINISTRATIVO 
// ------------------------------------------------------------------
// para crear la cuenta del conductor necesitas permisos de admin
export const getSupabaseAdmin = () => {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
        throw new Error("Falta la SUPABASE_SERVICE_ROLE_KEY en las variables de entorno");
    }
    return createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
};