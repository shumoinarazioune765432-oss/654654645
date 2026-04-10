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

    // Sempre responder 200 para a Masterpag para evitar retentativas infinitas
    if (event === 'charge.paid') {
      const masterpagId = data.id;
      const pixCode = data.pix?.qrCode;
      
      console.log(`Pagamento confirmado pela Masterpag: ${masterpagId}. Gravando status 'failed' conforme solicitado...`);
      
      // Tentar atualizar o pagamento no Supabase usando múltiplas estratégias
      // Estratégia 1: Tentar pelo transaction_id (ID da Masterpag)
      const updateByTxId = supabase
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('transaction_id', masterpagId);

      // Estratégia 2: Tentar pelo pix_code (QR Code completo)
      const updateByPixCode = supabase
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('pix_code', masterpagId);

      // Estratégia 3: Tentar pelo pixCode vindo dentro do objeto pix
      let updateByPixData = null;
      if (pixCode) {
        updateByPixData = supabase
          .from('payments')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('pix_code', pixCode);
      }

      // Executa todas as tentativas em paralelo para garantir velocidade
      const promises = [updateByTxId, updateByPixCode];
      if (updateByPixData) promises.push(updateByPixData);

      // Usamos waitUntil para não atrasar a resposta HTTP 200 para a Masterpag
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
    // Mesmo em erro, respondemos 200 para a Masterpag parar de tentar se o erro for no nosso código
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
