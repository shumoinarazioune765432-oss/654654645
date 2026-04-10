import { createClient } from '@supabase/supabase-js';

export async function onRequestGet(context) {
  return new Response(JSON.stringify({
    success: true,
    message: "Webhook Cloudflare Functions está ATIVO e aguardando pagamentos (POST)."
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    // Inicialização do Supabase usando variáveis de ambiente do Cloudflare
    const supabaseUrl = env.SUPABASE_URL || 'https://tpawkcmecwwopkobkwzu.supabase.co';
    const supabaseAnonKey = env.SUPABASE_ANON_KEY || 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const body = await request.json();
    const { event, data } = body;

    // Log para debug (aparece no painel da Cloudflare)
    console.log('Webhook recebido:', JSON.stringify({ event, data }, null, 2));

    if (event === 'charge.paid') {
      const masterpagId = data.id;
      
      console.log(`Pagamento confirmado pela Masterpag: ${masterpagId}. Gravando status 'failed' conforme solicitado...`);
      
      // Agora que masterpag.js salva apenas o UUID, podemos fazer um match exato.
      const { data: updateData, error } = await supabase
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('transaction_id', masterpagId);

      if (error) {
        console.error('Erro ao atualizar pagamento no Supabase:', error);
        // Não retorne um erro 500 para a Masterpag, pois ela pode tentar reenviar indefinidamente.
        // Apenas logue o erro e retorne sucesso.
        return new Response(JSON.stringify({ success: true, message: 'Erro interno ao processar o webhook.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      console.log('Pagamento atualizado no Supabase. Linhas afetadas:', updateData ? updateData.length : 0);

      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook recebido e pagamento atualizado com sucesso',
        id: masterpagId
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Retorna sucesso para outros eventos não tratados para que a Masterpag não reenvie.
    return new Response(JSON.stringify({ success: true, message: 'Evento não tratado.' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erro crítico no webhook:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 200, // Retorna 200 para evitar retentativas da Masterpag.
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
