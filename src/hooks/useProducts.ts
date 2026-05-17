import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import type { DbProduct } from '../types';

interface UseProductsOptions {
  category?: string;
  status?: 'active' | 'sold' | 'hidden';
  limit?: number;
  orderBy?: 'created_at' | 'price' | 'views';
  orderDesc?: boolean;
}

// 检查 Supabase 是否可用的标志
let supabaseAvailable: boolean | null = null;
const SUPABASE_TIMEOUT = 3000; // 3秒超时

async function checkSupabaseAvailability(): Promise<boolean> {
  if (supabaseAvailable !== null) return supabaseAvailable;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SUPABASE_TIMEOUT);
    
    // 简单检查是否可以访问 Supabase 域名
    await fetch(SUPABASE_URL, {
      method: 'HEAD',
      mode: 'no-cors',
      signal: controller.signal
    }).catch(() => {});
    
    clearTimeout(timeoutId);
    supabaseAvailable = true;
  } catch {
    supabaseAvailable = false;
  }
  
  return supabaseAvailable;
}

export function useProducts(options: UseProductsOptions = {}) {
  const { category, status = 'active', limit, orderBy = 'created_at', orderDesc = true } = options;
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchCalled = useRef(false);

  const fetchProducts = useCallback(async () => {
    // 防止重复调用
    if (fetchCalled.current) return;
    fetchCalled.current = true;
    
    setLoading(true);
    setError(null);

    try {
      // 检查 Supabase 是否可用
      const isAvailable = await checkSupabaseAvailability();
      
      if (!isAvailable) {
        // Supabase 不可用，返回空数组，HomePage 会自动降级到 mock 数据
        console.log('Supabase 不可用，将使用本地 mock 数据');
        setProducts([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('products')
        .select('*')
        .eq('status', status);

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      // 排序
      query = query.order(orderBy, { ascending: !orderDesc });

      // 限制数量
      if (limit) {
        query = query.limit(limit);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw fetchError;
      }

      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      // 出错时返回空数组，让 HomePage 降级到 mock 数据
      setProducts([]);
      setError(null); // 不显示错误，静默降级
    } finally {
      setLoading(false);
    }
  }, [category, status, limit, orderBy, orderDesc]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}

// 获取单个商品详情
export function useProduct(productId: string | undefined) {
  const [product, setProduct] = useState<DbProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) {
      setLoading(false);
      return;
    }

    async function fetchProduct() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setProduct(data);
      }
      setLoading(false);
    }

    fetchProduct();
  }, [productId]);

  return { product, loading, error };
}

// 添加商品
export async function addProduct(product: Omit<DbProduct, 'id' | 'created_at' | 'updated_at' | 'views' | 'status'>) {
  const { data, error } = await supabase
    .from('products')
    .insert([product])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// 更新商品
export async function updateProduct(productId: string, updates: Partial<DbProduct>) {
  const { data, error } = await supabase
    .from('products')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

// 删除商品
export async function deleteProduct(productId: string) {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', productId);

  if (error) {
    throw error;
  }
}

// 增加浏览量
export async function incrementViews(productId: string) {
  try {
    await supabase.rpc('increment_views', { product_id: productId });
  } catch {
    // 如果 rpc 失败，忽略
  }
}
