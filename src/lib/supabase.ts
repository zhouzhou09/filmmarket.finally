import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://jkqxdmiaofwuupqznr.supabase.co';
const supabaseKey = 'sb_publishable_8jUtWet__x5UzDnZxX1YAg_fkHs6RVG';

export const supabase = createClient(supabaseUrl, supabaseKey);

// 导出配置信息
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_KEY = supabaseKey;
