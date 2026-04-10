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

    // Verifica se é um evento de pagamento confirmado
    if (event === 'charge.paid') {
      const { id } = data;
      
      console.log(`Pagamento confirmado pela Masterpag: ${id}. Forçando status 'paid' no Supabase...`);
      
      // Tentar atualizar o pagamento no Supabase
      // Estratégia: Procurar apenas pelo transaction_id (que é único)
      // Forçamos o status para 'paid' independentemente de qualquer outra lógica
      try {
        const { data: updatedData, error } = await supabase
          .from('payments')
          .update({ 
            status: 'paid', 
            updated_at: new Date().toISOString() 
          })
          .eq('transaction_id', id)
          .select();
        
        if (error) {
          console.error('Erro ao atualizar no Supabase:', error);
        } else if (updatedData && updatedData.length > 0) {
          console.log('✅ Pagamento atualizado com sucesso para PAID:', updatedData);
        } else {
          console.log('⚠️ Nenhum registro encontrado com transaction_id:', id);
          
          // Fallback: Tentar encontrar pelo pix_code se o ID não bater
          if (data.pix && data.pix.qrCode) {
            console.log('Tentando fallback via pix_code...');
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('payments')
              .update({ 
                status: 'paid', 
                updated_at: new Date().toISOString() 
              })
              .eq('pix_code', data.pix.qrCode)
              .select();
              
            if (fallbackError) {
              console.error('Erro no fallback via pix_code:', fallbackError);
            } else if (fallbackData && fallbackData.length > 0) {
              console.log('✅ Pagamento atualizado com sucesso via pix_code para PAID:', fallbackData);
            }
          }
        }
      } catch (error) {
        console.error('Erro de conexão com o Supabase:', error);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook processado e status PAID forçado',
        transactionId: id
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erro crítico no webhook:', error);
    return new Response(JSON.stringify({ error: 'Erro interno no processamento' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
