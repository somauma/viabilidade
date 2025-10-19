// script.js (module)

// ---------- Utils ----------
const INTL_THOUSANDS = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const INTL_PERCENT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

const fmtThousands = (n) => INTL_THOUSANDS.format(Math.round(Number(n) || 0));
const fmtPercentLabel = (n) => `${INTL_PERCENT.format(Number(n) || 0)}%`;

const digitsOnly = (s) => String(s || '').replace(/\D/g, '');
const clampDigits = (s, max) => digitsOnly(s).slice(0, max);
const formatView = (raw) => (raw ? raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');

const toNum = (v) => {
  if (v == null) return NaN;
  const s = String(v).trim().replace(/\./g, '').replace(',', '.');
  return s === '' ? NaN : Number(s);
};

// Sanitiza juros/percentual durante digitação: mantém 2 casas
function sanitizePercentText(text, maxIntDigits = 4) {
  let t = String(text || '').replace(/[^0-9.,]/g, '');
  const firstSep = t.search(/[.,]/);
  if (firstSep !== -1) {
    t = t.slice(0, firstSep + 1) + t.slice(firstSep + 1).replace(/[.,]/g, '');
  }
  let [intPart, decPart = ''] = t.split(/[.,]/);
  intPart = digitsOnly(intPart).slice(0, maxIntDigits);
  decPart = digitsOnly(decPart).slice(0, 2);
  return decPart.length ? `${intPart}.${decPart}` : intPart;
}

// Dataset helpers (inputs mascarados como texto com value "10000" → "10.000")
const getRawFrom = (selector) => {
  const el = document.querySelector(selector);
  return Number(el?.dataset.rawValue || 0);
};

const getPercent = (selector) => {
  const el = document.querySelector(selector);
  return Number(el?.value || 0); // já é number (type="number") com duas casas
};

const getInt = (selector) => {
  const el = document.querySelector(selector);
  return Math.trunc(Number(el?.value || 0));
};

const setOut = (selector, number) => {
  const out = document.querySelector(selector);
  if (out) out.textContent = fmtThousands(number);
};

const setOutPercentText = (selector, number) => {
  const out = document.querySelector(selector);
  if (out) out.textContent = fmtPercentLabel(number).replace('.', ','); // vírgula visual
};

// ---------- Máscaras & Inputs ----------
document.addEventListener('DOMContentLoaded', () => {
  // Toggle all details
  const btn = document.getElementById('btn-toggle-all');
  const details = [...document.querySelectorAll('details')];

  const setToggleState = (open) => {
    details.forEach(d => d.toggleAttribute('open', open));
    btn.setAttribute('aria-pressed', String(open));
    btn.title = open ? 'Recolher todas as seções' : 'Expandir todas as seções';
    btn.textContent = open ? '− Contrair' : '+ Expandir';
  };
  btn.addEventListener('click', () => {
    const anyOpen = details.some(d => d.open);
    setToggleState(!anyOpen);
  });
  // comece fechado
  setToggleState(false);

  // Delegação: botões +/− das spinboxes
  document.addEventListener('click', (e) => {
    const isPlus = e.target.classList.contains('spinControlsMAIS');
    const isMinus = e.target.classList.contains('spinControlsMENOS');
    if (!isPlus && !isMinus) return;

    const wrapper = e.target.closest('.PremissaInputSpinbox');
    const input = wrapper?.querySelector('input');
    if (!input) return;

    const step = input.step ? Number(input.step) : 1;
    const min = input.min !== '' ? Number(input.min) : -Infinity;
    const max = input.max !== '' ? Number(input.max) : Infinity;

    let current = Number(input.value || 0);
    if (Number.isNaN(current)) current = 0;

    let next = current + (isPlus ? step : -step);
    next = Math.min(Math.max(next, min), max);

    if (input.classList.contains('PremissaInputMESES')) {
      next = Math.round(next);
      input.value = String(next).slice(0, 2);
    } else if (input.classList.contains('PremissaInputJUROS')) {
      input.value = next.toFixed(2);
    } else {
      input.value = String(next);
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    updateAll();
  });

  // Máscara: ÁREAS / PREÇOS (p/m²) / DINHEIROS (brutos) — inputs text com milhar
  const classMaxMap = {
    '.PremissaInputAREAS': 6,
    '.PremissaInputPRECOS': 5,
    '.PremissaInputDINHEIROS': 9,
  };

  Object.entries(classMaxMap).forEach(([selector, MAX]) => {
    document.querySelectorAll(selector).forEach((input) => {
      // força "text", numérico soft, e guarda valor puro no dataset
      try { input.type = 'text'; } catch {}
      input.setAttribute('inputmode', 'numeric');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('pattern', `\\d{0,${MAX}}`);

      const setFmt = (candidate) => {
        let raw = clampDigits(candidate, MAX).replace(/^0+(?=\d)/, '');
        input.value = raw ? formatView(raw) : '';
        input.dataset.rawValue = raw || '0';
      };

      // init
      setFmt(input.value);

      input.addEventListener('input', (e) => setFmt(e.target.value));
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        setFmt(text);
      });
      input.addEventListener('blur', (e) => setFmt(e.target.value));
    });
  });

  // Máscara: MESES (inteiro 0–99)
  document.addEventListener('input', (e) => {
    if (!e.target.classList.contains('PremissaInputMESES')) return;
    e.target.value = clampDigits(e.target.value, 2);
  }, true);
  document.addEventListener('blur', (e) => {
    if (!e.target.classList.contains('PremissaInputMESES')) return;
    const el = e.target;
    const min = el.min !== '' ? Number(el.min) : 0;
    const max = el.max !== '' ? Number(el.max) : 99;
    let v = Number(clampDigits(el.value, 2) || 0);
    v = Math.min(Math.max(v, min), max);
    el.value = String(Math.trunc(v));
  }, true);

  // Máscara: JUROS/percentuais
  document.addEventListener('input', (e) => {
    if (!e.target.classList.contains('PremissaInputJUROS')) return;
    e.target.value = sanitizePercentText(e.target.value, 4);
  }, true);
  document.addEventListener('blur', (e) => {
    if (!e.target.classList.contains('PremissaInputJUROS')) return;
    const el = e.target;
    const min = el.min !== '' ? Number(el.min) : 0;
    const max = el.max !== '' ? Number(el.max) : 100;
    const step = el.step !== '' ? Number(el.step) : 0.01;

    let num = Number(sanitizePercentText(el.value, 4) || 0);
    num = Math.min(Math.max(num, min), max);
    if (step > 0) num = Math.round(num / step) * step;
    el.value = num.toFixed(2);
  }, true);

  // Qualquer mudança relevante → recalcula
  document.addEventListener('input', updateAll);
  document.addEventListener('blur', updateAll, true);

  // Primeira rodada
  updateAll();
});

// ---------- Cálculos ----------
function calcAreaTotal() {
  return getRawFrom('#id-area-residencial') +
         getRawFrom('#id-area-escritorios') +
         getRawFrom('#id-area-lojas') +
         getRawFrom('#id-area-outros');
}

function calcPrazosTotal() {
  return getInt('#id-prazo-diligencia') +
         getInt('#id-prazo-aprovacao') +
         getInt('#id-prazo-construcao') +
         getInt('#id-prazo-repasse');
}

function calcVgv() {
  const ar = getRawFrom('#id-area-residencial');
  const ae = getRawFrom('#id-area-escritorios');
  const al = getRawFrom('#id-area-lojas');
  const ao = getRawFrom('#id-area-outros');

  const pr = getRawFrom('#id-preco-residencial');
  const pe = getRawFrom('#id-preco-escritorios');
  const pl = getRawFrom('#id-preco-lojas');
  const po = getRawFrom('#id-preco-outros');

  const vgvR = ar * pr;
  const vgvE = ae * pe;
  const vgvL = al * pl;
  const vgvO = ao * po;
  const vgvT = vgvR + vgvE + vgvL + vgvO;

  return { vgvR, vgvE, vgvL, vgvO, vgvT };
}


function calcPrecoAquisicaoPm2(precoAquisicao, areaTotal) {
  if (!areaTotal) return 0;
  return Math.round(precoAquisicao / areaTotal);
}

function calcDespesasComerciais(vgvTotal) {
  const ppem = getPercent('#id-ppem');
  const corret = getPercent('#id-corretagem');
  const imp = getPercent('#id-impostos');
  const rep = getPercent('#id-repasse');

  const vPPM = vgvTotal * (ppem / 100);
  const vCor = vgvTotal * (corret / 100);
  const vImp = vgvTotal * (imp / 100);
  const vRep = vgvTotal * (rep / 100);
  const total = vPPM + vCor + vImp + vRep;

  return { vPPM, vCor, vImp, vRep, total };
}

function calcCustoObra(areaTotal) {
  const cobraPm2 = getRawFrom('#id-cobra');
  return areaTotal * cobraPm2;
}

function calcDespesasOperacionais(vgvTotal, custoObra) {
  const fee = getPercent('#id-fee-gestao');
  const pop = getPercent('#id-pop');
  const op = getPercent('#id-op');

  const vFee = vgvTotal * (fee / 100);
  const vPop = custoObra * (pop / 100);
  const vOp = custoObra * (op / 100);

  const total = vFee + vPop + vOp + custoObra;
  return { vFee, vPop, vOp, total };
}

function calcAlavancagem(custoObra) {
  const alav = getPercent('#id-alavancagem');
  return custoObra * (alav / 100);
}

function calcSubvencao(vgvTotal) {
  const pontos = getInt('#id-subvencao-pontos'); // 1 ponto = 0,25%
  const percentual = pontos * 0.25;
  const valor = vgvTotal * (percentual / 100); // ajuste a base se necessário
  return { percentual, valor };
}

function updateAll() {
  // Áreas e prazos
  const areaTotal = calcAreaTotal();
  setOut('#id-area-total', areaTotal);

  const prazosTotal = calcPrazosTotal();
  setOut('#id-prazo-total', prazosTotal);

  // VGVs
  const { vgvR, vgvE, vgvL, vgvO, vgvT } = calcVgv();
  setOut('#id-vgv-residencial-reais', vgvR);
  setOut('#id-vgv-escritorios-reais', vgvE);
  setOut('#id-vgv-lojas-reais', vgvL);
  setOut('#id-vgv-outros-reais', vgvO);
  setOut('#id-vgv-total-reais', vgvT);

  // VGV por m²
  const vgvPm2 = areaTotal ? Math.round(vgvT / areaTotal) : 0;
  setOut('#id-vgv-total-reais-pm2', vgvPm2);

  // Aquisição p/m²
  const precoAquisicao = getRawFrom('#id-preco-aquisicao');
  const aqPm2 = calcPrecoAquisicaoPm2(precoAquisicao, areaTotal);
  setOut('#id-preco-aquisicao-pm2', aqPm2);

  // Despesas comerciais
  const dc = calcDespesasComerciais(vgvT);
  setOut('#id-ppem-reais', dc.vPPM);
  setOut('#id-corretagem-reais', dc.vCor);
  setOut('#id-impostos-reais', dc.vImp);
  setOut('#id-repasse-reais', dc.vRep);
  setOut('#id-despesas-comerciais-reais', dc.total);
  const dcPm2 = areaTotal ? Math.round(dc.total / areaTotal) : 0;
  setOut('#id-despesas-comerciais-reais-pm2', dcPm2);

  // Custo de obra (R$/m² * área)
  const custoObra = calcCustoObra(areaTotal);
  setOut('#id-cobra-reais', custoObra);

  // Despesas operacionais (fee + POP + OP + C.Obra)
  const dope = calcDespesasOperacionais(vgvT, custoObra);
  setOut('#id-fee-gestao-reais', dope.vFee);
  setOut('#id-pop-reais', dope.vPop);
  setOut('#id-op-reais', dope.vOp);
  setOut('#id-despesas-operacionais-reais', dope.total);
  const dopePm2 = areaTotal ? Math.round(dope.total / areaTotal) : 0;
  setOut('#id-despesas-operacionais-reais-pm2', dopePm2);

  // Alavancagem (% do C.Obra)
  const alavR$ = calcAlavancagem(custoObra);
  setOut('#id-alavancagem-reais', alavR$);

  // Outras receitas - Subvenção
  const { percentual, valor } = calcSubvencao(vgvT);
  setOutPercentText('#id-subvencao-percentual', percentual);
  setOut('#id-subvencao-reais', valor);
}
