import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default async function handler(req, res) {
  // Apenas POST é permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { event, data } = req.body;

    // Log para debug
    console.log('Webhook recebido:', { event, data });

    // Verifica se é um evento de pagamento confirmado
    if (event === 'charge.paid') {
      const { id, amount, status, pix, metadata } = data;

      console.log(`Pagamento confirmado: ${id} - R$ ${amount / 100}`);
      console.log('Dados completos do webhook:', JSON.stringify(data, null, 2));
      
      // Converter amount de centavos para reais
      const amountInReais = amount / 100;
      
      console.log('Tentando encontrar e atualizar pagamento...');
      console.log('  - transaction_id:', id);
      console.log('  - amount:', amountInReais);
      
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
          console.log('⚠️ Nenhum registro encontrado com transaction_id + amount');
          console.log('Tentando apenas com amount...');
          
          // Fallback: tentar apenas com amount
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('payments')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('amount', amountInReais)
            .eq('status', 'pending')
            .select();
          
          if (fallbackError) {
            console.error('Erro no fallback:', fallbackError);
          } else if (fallbackData && fallbackData.length > 0) {
            console.log('✅ Pagamento atualizado com fallback:', fallbackData);
          } else {
            console.log('❌ Nenhum registro encontrado mesmo com fallback');
          }
        }
      } catch (error) {
        console.error('Erro ao conectar ao Supabase:', error);
      }

      // Responde com sucesso para a Masterpag
      return res.status(200).json({
        success: true,
        message: 'Webhook processado com sucesso',
        transactionId: id
      });
    }

    // Se for outro evento, apenas registra
    if (event === 'charge.created') {
      console.log('Cobrança criada:', data.id);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    return res.status(500).json({ error: 'Erro ao processar webhook' });
  }
}
// Force redeploy - Fri Mar 13 18:51:59 EDT 2026
