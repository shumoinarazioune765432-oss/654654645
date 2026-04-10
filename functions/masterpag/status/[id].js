module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    try {
      const { id } = req.query;
      console.log('Verificando status da transação:', id, 'query:', req.query);
      const publicKey = process.env.MASTERPAG_PUBLIC_KEY || 'pk_live_TyOexAHFCYOc7XweMd2c7c01Qx0nBZJh';
      const secretKey = process.env.MASTERPAG_SECRET_KEY || 'sk_live_vWga85ttCDm41J0B9mwvrXkCwCoiKl9kMCELGLd4Msj1LagF';

      if (!id) {
        return res.status(400).json({ error: 'ID da transação é obrigatório' });
      }

      // Chamar a API da Masterpag para verificar o status
      const response = await fetch(`https://dcnmsoaogkbgkbwpldrp.supabase.co/functions/v1/pix-receive?transaction_id=${encodeURIComponent(id)}`, {
        method: 'GET',
        headers: {
          'x-public-key': publicKey,
          'x-secret-key': secretKey,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        res.status(200).json({
          success: true,
          status: data.status,
          id: data.id,
          amount: data.amount,
          paidAt: data.paidAt
        });
      } else {
        res.status(200).json({
          success: false,
          status: 'pending',
          error: data.error?.message || 'Erro ao verificar status'
        });
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      res.status(500).json({
        success: false,
        status: 'error',
        error: error.message
      });
    }
  } else {
    res.status(405).json({ success: false, error: 'Método não permitido' });
  }
};
