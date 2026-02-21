// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 앱 전역에서 재사용할 수 있도록 하나의 인스턴스만 생성하여 내보냅니다.
export const supabase = createClient(supabaseUrl, supabaseKey);