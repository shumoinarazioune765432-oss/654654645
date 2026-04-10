import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function onRequestGet() {
  return new Response(JSON.stringify({
    success: true,
    message: "Webhook Cloudflare Functions está ATIVO e aguardando pagamentos (POST)."
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request } = context;
  
  try {
    const body = await request.json();
    const { event, data } = body;

    // Log para debug (aparece no painel da Cloudflare)
    console.log('Webhook recebido:', JSON.stringify({ event, data }, null, 2));

    if (event === 'charge.paid') {
      const masterpagId = data.id;
      const pixCode = data.pix?.qrCode;
      
      console.log(`Pagamento confirmado pela Masterpag: ${masterpagId}. Gravando status 'failed' conforme solicitado...`);
      
      // Tentar atualizar o pagamento no Supabase usando busca por aproximação (ilike)
      // Isso resolve o problema de IDs longos salvos no banco vs IDs curtos enviados pela Masterpag
      
      // Estratégia 1: Tentar pelo transaction_id (contendo o ID da Masterpag)
      const updateByTxId = supabase
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .ilike('transaction_id', `%${masterpagId}%`);

      // Estratégia 2: Tentar pelo pix_code (contendo o ID da Masterpag)
      const updateByPixCode = supabase
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .ilike('pix_code', `%${masterpagId}%`);

      // Estratégia 3: Se tivermos o pixCode completo no payload, tentar match exato
      let updateByPixData = null;
      if (pixCode) {
        updateByPixData = supabase
          .from('payments')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('pix_code', pixCode);
      }

      const promises = [updateByTxId, updateByPixCode];
      if (updateByPixData) promises.push(updateByPixData);

      context.waitUntil(
        Promise.all(promises).then(results => {
          results.forEach((res, index) => {
            if (res.error) console.error(`Erro na tentativa ${index}:`, res.error);
            else console.log(`Tentativa ${index} concluída com sucesso.`);
          });
        })
      );

      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook recebido e processamento iniciado',
        id: masterpagId
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erro crítico no webhook:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
