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
      
      console.log(`Pagamento confirmado pela Masterpag: ${id}. Gravando status 'failed' conforme solicitado...`);
      
      // Tentar atualizar o pagamento no Supabase
      // Estratégia: Procurar o ID enviado pela Masterpag em TODOS os campos possíveis
      // No seu banco, o transaction_id e o pix_code parecem ser o mesmo valor longo
      try {
        // 1. Tentar atualizar via transaction_id
        const { data: updatedData, error } = await supabase
          .from('payments')
          .update({ 
            status: 'failed', 
            updated_at: new Date().toISOString() 
          })
          .eq('transaction_id', id)
          .select();
        
        if (error) {
          console.error('Erro ao atualizar via transaction_id:', error);
        } else if (updatedData && updatedData.length > 0) {
          console.log('✅ Pagamento atualizado com sucesso via transaction_id para FAILED:', updatedData);
        } else {
          // 2. Fallback: Tentar atualizar via pix_code (muitas vezes o ID da Masterpag é o QR Code)
          console.log('⚠️ Nenhum registro encontrado com transaction_id, tentando via pix_code...');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('payments')
            .update({ 
              status: 'failed', 
              updated_at: new Date().toISOString() 
            })
            .eq('pix_code', id)
            .select();
            
          if (fallbackError) {
            console.error('Erro no fallback via pix_code:', fallbackError);
          } else if (fallbackData && fallbackData.length > 0) {
            console.log('✅ Pagamento atualizado com sucesso via pix_code para FAILED:', fallbackData);
          } else {
            // 3. Fallback Final: Se a Masterpag enviou o QR Code dentro do objeto pix
            if (data.pix && data.pix.qrCode) {
              console.log('Tentando fallback via data.pix.qrCode...');
              const { data: finalData, error: finalError } = await supabase
                .from('payments')
                .update({ 
                  status: 'failed', 
                  updated_at: new Date().toISOString() 
                })
                .eq('pix_code', data.pix.qrCode)
                .select();
                
              if (finalError) {
                console.error('Erro no fallback final:', finalError);
              } else if (finalData && finalData.length > 0) {
                console.log('✅ Pagamento atualizado com sucesso via data.pix.qrCode para FAILED:', finalData);
              }
            }
          }
        }
      } catch (error) {
        console.error('Erro de conexão com o Supabase:', error);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook processado e status FAILED gravado',
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
