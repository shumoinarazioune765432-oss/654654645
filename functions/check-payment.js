import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    const { pixCode, transactionId, plate } = req.query;
    
    console.log('check-payment recebido:', { pixCode, transactionId, plate });
    
    try {
      let data = null;
      let error = null;
      
      // Estratégia 1: Procurar por transactionId
      if (transactionId) {
        console.log('Tentando encontrar com transactionId:', transactionId);
        const result = await supabase
          .from('payments')
          .select('*')
          .eq('transaction_id', transactionId)
          .single();
        data = result.data;
        error = result.error;
      }
      
      // Estratégia 2: Se não encontrou, procurar por pixCode
      if ((error || !data) && pixCode) {
        console.log('Não encontrado com transactionId, tentando com pixCode:', pixCode);
        const result = await supabase
          .from('payments')
          .select('*')
          .eq('pix_code', pixCode)
          .single();
        data = result.data;
        error = result.error;
      }
      
      // Estratégia 3: Se ainda não encontrou, procurar por plate (último registro)
      if ((error || !data) && plate) {
        console.log('Não encontrado com pixCode, tentando com plate:', plate);
        const result = await supabase
          .from('payments')
          .select('*')
          .eq('plate', plate)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        data = result.data;
        error = result.error;
      }
      
      if (!data) {
        console.log('Pagamento não encontrado');
        return res.status(200).json({ 
          success: false, 
          status: 'pending' 
        });
      }
      
      console.log('Pagamento encontrado:', { id: data.id, status: data.status, plate: data.plate });
      
      return res.status(200).json({
        success: data.status === 'paid',
        status: data.status,
        data: data
      });
    } catch (error) {
      console.error('Erro ao verificar pagamento:', error);
      return res.status(200).json({ 
        success: false, 
        status: 'pending',
        error: error.message 
      });
    }
  } else {
    res.status(405).json({ success: false, error: 'Método não permitido' });
  }
}
