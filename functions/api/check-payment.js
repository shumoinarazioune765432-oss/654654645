import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const pixCode = url.searchParams.get('pixCode');
  const transactionId = url.searchParams.get('transactionId');
  const plate = url.searchParams.get('plate');
  
  console.log('check-payment recebido:', { pixCode, transactionId, plate });
  
  try {
    let data = null;
    let error = null;
    
    // Estratégia 1: Procurar por transactionId
    if (transactionId) {
      const result = await supabase
        .from('payments')
        .select('*')
        .eq('transaction_id', transactionId)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }
    
    // Estratégia 2: Se não encontrou, procurar por pixCode
    if ((error || !data) && pixCode) {
      const result = await supabase
        .from('payments')
        .select('*')
        .eq('pix_code', pixCode)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }
    
    // Estratégia 3: Se ainda não encontrou, procurar por plate (último registro)
    if ((error || !data) && plate) {
      const result = await supabase
        .from('payments')
        .select('*')
        .eq('plate', plate)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      data = result.data;
      error = result.error;
    }
    
    if (!data) {
      return new Response(JSON.stringify({ 
        success: false, 
        status: 'pending' 
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    return new Response(JSON.stringify({
      success: data.status === 'paid',
      status: data.status,
      data: data
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (error) {
    console.error('Erro ao verificar pagamento:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      status: 'pending',
      error: error.message 
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
