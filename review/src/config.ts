const env = import.meta.env;

export const API_URL = (env.VITE_API_URL || "https://api.ai4kanban.dev").replace(/\/+$/, "");
export const SUPABASE_URL = (env.VITE_SUPABASE_URL || "https://yajrbpprmdvtkvjjfpbk.supabase.co").replace(/\/+$/, "");
export const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ioUQ23BTtoj8NKqndp0Jrw_omVR3m4n";
