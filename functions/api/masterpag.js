import { createClient } from '@supabase/supabase-js';

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
    const publicKey = env.MASTERPAG_PUBLIC_KEY || 'pk_live_TyOexAHFCYOc7XweMd2c7c01Qx0nBZJh';
    const secretKey = env.MASTERPAG_SECRET_KEY || 'sk_live_vWga85ttCDm41J0B9mwvrXkCwCoiKl9kMCELGLd4Msj1LagF';
    
    const body = await request.json();
    
    function gerarDadosAleatorios() {
      const nomes = ['João', 'Maria', 'Carlos', 'Ana', 'Pedro', 'Fernanda', 'Lucas', 'Juliana', 'Rafael', 'Beatriz'];
      const sobrenomes = ['Silva', 'Santos', 'Oliveira', 'Costa', 'Pereira', 'Ferreira', 'Rodrigues', 'Alves', 'Martins', 'Gomes'];
      const dominios = ['gmail.com', 'hotmail.com', 'icloud.com', 'bol.com.br'];
      const ddds = ['11', '21'];
      
      const nome = nomes[Math.floor(Math.random() * nomes.length)];
      const sobrenome = sobrenomes[Math.floor(Math.random() * sobrenomes.length)];
      const nomeCompleto = `${nome} ${sobrenome}`;
      const emailBase = Math.random().toString(36).substring(2, 10) + Math.floor(Math.random() * 1000);
      const dominio = dominios[Math.floor(Math.random() * dominios.length)];
      const email = `${emailBase}@${dominio}`;
      const ddd = ddds[Math.floor(Math.random() * ddds.length)];
      const restoDosDigitos = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      const telefone = `${ddd}9${restoDosDigitos}`;
      
      function gerarCPF() {
        let cpf = '';
        for (let i = 0; i < 9; i++) cpf += Math.floor(Math.random() * 10);
        let soma = 0;
        for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
        let resto = soma % 11;
        let digito1 = resto < 2 ? 0 : 11 - resto;
        cpf += digito1;
        soma = 0;
        for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
        resto = soma % 11;
        let digito2 = resto < 2 ? 0 : 11 - resto;
        cpf += digito2;
        return cpf;
      }
      
      return { name: nomeCompleto, email, phone: telefone, cpf: gerarCPF() };
    }
    
    const dadosAleatorios = gerarDadosAleatorios();
    const payload = {
      amount: body.amount || 38.90,
      paymentMethod: 'pix',
      customer: {
        name: body.customer?.name || dadosAleatorios.name,
        email: body.customer?.email || dadosAleatorios.email,
        phone: body.customer?.phone || dadosAleatorios.phone,
        document: {
          number: body.customer?.document || dadosAleatorios.cpf,
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

    const response = await fetch('https://dcnmsoaogkbgkbwpldrp.supabase.co/functions/v1/pix-receive', {
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
      
      try {
        await supabase
          .from('payments')
          .insert([{
            transaction_id: txId,
            pix_code: data.pix.qrCode,
            status: 'pending',
            amount: body.amount || 38.90,
            plate: body.plate
          }]);
      } catch (e) {
        console.error('Supabase error:', e);
      }
      
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
