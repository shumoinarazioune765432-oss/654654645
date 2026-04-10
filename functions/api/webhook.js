import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function onRequestPost(context) {
  const { request } = context;
  
  try {
    const body = await request.json();
    const { event, data } = body;

    // Log para debug
    console.log('Webhook recebido:', { event, data });

    // Verifica se é um evento de pagamento confirmado
    if (event === 'charge.paid') {
      const { id, amount, status, pix, metadata } = data;
      console.log(`Pagamento confirmado: ${id} - R$ ${amount / 100}`);
      
      // Converter amount de centavos para reais
      const amountInReais = amount / 100;
      
      // Tentar atualizar com transaction_id + amount (estratégia principal)
      try {
        const { data: updatedData, error } = await supabase
          .from('payments')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('transaction_id', id)
          .eq('amount', amountInReais)
          .select();
        
        if (error) {
          console.error('Erro ao atualizar:', error);
        } else if (updatedData && updatedData.length > 0) {
          console.log('✅ Pagamento atualizado com sucesso:', updatedData);
        } else {
          // Fallback: tentar apenas com amount
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('payments')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('amount', amountInReais)
            .eq('status', 'pending')
            .select();
          
          if (fallbackError) {
            console.error('Erro no fallback:', fallbackError);
          }
        }
      } catch (error) {
        console.error('Erro ao conectar ao Supabase:', error);
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook processado com sucesso',
        transactionId: id
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return new Response(JSON.stringify({ error: 'Erro ao processar webhook' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
