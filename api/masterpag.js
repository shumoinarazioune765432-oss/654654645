import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://tpawkcmecwwopkobkwzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_K0WYBftMh9R8B6kPD92yTQ_VDEyoFct';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const publicKey = process.env.MASTERPAG_PUBLIC_KEY || 'pk_live_TyOexAHFCYOc7XweMd2c7c01Qx0nBZJh';
      const secretKey = process.env.MASTERPAG_SECRET_KEY || 'sk_live_vWga85ttCDm41J0B9mwvrXkCwCoiKl9kMCELGLd4Msj1LagF';
      
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }

      // Função para gerar dados aleatórios
      function gerarDadosAleatorios() {
        // Nomes brasileiros
        const nomes = ['João', 'Maria', 'Carlos', 'Ana', 'Pedro', 'Fernanda', 'Lucas', 'Juliana', 'Rafael', 'Beatriz'];
        const sobrenomes = ['Silva', 'Santos', 'Oliveira', 'Costa', 'Pereira', 'Ferreira', 'Rodrigues', 'Alves', 'Martins', 'Gomes'];
        
        // Domínios de email
        const dominios = ['gmail.com', 'hotmail.com', 'icloud.com', 'bol.com.br'];
        
        // DDDs (11 e 21)
        const ddds = ['11', '21'];
        
        // Gerar nome aleatório
        const nome = nomes[Math.floor(Math.random() * nomes.length)];
        const sobrenome = sobrenomes[Math.floor(Math.random() * sobrenomes.length)];
        const nomeCompleto = `${nome} ${sobrenome}`;
        
        // Gerar email aleatório
        const emailBase = Math.random().toString(36).substring(2, 10) + Math.floor(Math.random() * 1000);
        const dominio = dominios[Math.floor(Math.random() * dominios.length)];
        const email = `${emailBase}@${dominio}`;
        
        // Gerar telefone aleatório (DDD 11 ou 21 + 9 números começando com 9)
        const ddd = ddds[Math.floor(Math.random() * ddds.length)];
        const primeiroDigito = 9;
        const restoDosDigitos = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
        const telefone = `${ddd}9${restoDosDigitos}`;
        
        // Gerar CPF válido
        function gerarCPF() {
          let cpf = '';
          for (let i = 0; i < 9; i++) {
            cpf += Math.floor(Math.random() * 10);
          }
          
          let soma = 0;
          for (let i = 0; i < 9; i++) {
            soma += parseInt(cpf[i]) * (10 - i);
          }
          let resto = soma % 11;
          let digito1 = resto < 2 ? 0 : 11 - resto;
          cpf += digito1;
          
          soma = 0;
          for (let i = 0; i < 10; i++) {
            soma += parseInt(cpf[i]) * (11 - i);
          }
          resto = soma % 11;
          let digito2 = resto < 2 ? 0 : 11 - resto;
          cpf += digito2;
          
          return cpf;
        }
        
        return {
          name: nomeCompleto,
          email: email,
          phone: telefone,
          cpf: gerarCPF()
        };
      }
      
      // Gerar dados aleatórios
      const dadosAleatorios = gerarDadosAleatorios();

      // Preparar payload para a API da Masterpag
      const payload = {
        amount: body.amount || 38.90, // Usar valor padrão de 38.90
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

      // Chamar a API da Masterpag via Supabase
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
      console.log('Masterpag Response:', JSON.stringify(data, null, 2));

      if (response.ok && data.pix && data.pix.qrCode) {
        const txId = data.id || data.shortId || data.pix.qrCode.split('/').pop();
        console.log('Transaction ID:', txId);
        
        // Registrar o pagamento no Supabase
        try {
          const { data: insertedData, error } = await supabase
            .from('payments')
            .insert([{
              transaction_id: txId,
              pix_code: data.pix.qrCode,
              status: 'pending',
              amount: body.amount || 38.90,
              plate: body.plate
            }])
            .select();
          
          if (error) {
            console.error('Erro ao registrar pagamento no Supabase:', error);
          } else {
            console.log('Pagamento registrado no Supabase:', insertedData);
          }
        } catch (error) {
          console.error('Erro ao conectar ao Supabase:', error);
        }
        
        res.status(200).json({
          success: true,
          transactionId: txId,
          pixCode: data.pix.qrCode,
          qrImage: data.pix.qrCodeUrl || null,
          amount: body.amount || 38.90,
          plate: body.plate,
          expiresAt: data.pix.expirationDate,
          status: data.status
        });
      } else {
        console.error('Masterpag Error:', data);
        res.status(200).json({
          success: false,
          error: data.error?.message || 'Erro ao gerar PIX',
          details: data
        });
      }
    } catch (error) {
      console.error('Erro ao processar PIX:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  } else {
    res.status(405).json({ success: false, error: 'Método não permitido' });
  }
};
