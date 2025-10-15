const toggleButton = document.getElementById("btn-toggle-all");
const detailsElements = document.querySelectorAll("details");

toggleButton.addEventListener("click", () => {
    // Verifica se pelo menos um details está aberto
    const someAreOpen = Array.from(detailsElements).some((detail) => detail.hasAttribute("open"));

    detailsElements.forEach((detail) => {
        if (someAreOpen) {
            // Se algum está aberto, fecha todos
            detail.removeAttribute("open");
        } else {
            // Se todos estão fechados, abre todos
            detail.setAttribute("open", "");
        }
    });
});

// SUBSTITUI OS BOTÕES + E - DAS SPINBOXES E FORMATA OS CAMPOS DE MESES E JUROS
document.addEventListener("DOMContentLoaded", () => {
  // -------- utilitários --------
  const onlyDigits = (s) => s.replace(/\D/g, "");
  const toNum = (v) => {
    if (v == null) return NaN;
    const s = String(v).trim().replace(",", ".");
    return s === "" ? NaN : Number(s);
  };

  // Limita parte inteira a N dígitos e no máx. 2 decimais (aceita . ou , na digitação)
  function sanitizeInterestRaw(text, maxIntDigits = 4) {
    if (!text) return "";
    // mantém apenas dígitos e separadores . ,
    let t = text.replace(/[^0-9.,]/g, "");
    // normaliza múltiplos separadores -> mantém só o primeiro
    const firstSep = t.search(/[.,]/);
    if (firstSep !== -1) {
      // remove separadores posteriores
      t =
        t.slice(0, firstSep + 1) +
        t
          .slice(firstSep + 1)
          .replace(/[.,]/g, "");
    }
    // separa inteiro/decimal (aceita , ou .)
    let [intPart, decPart = ""] = t.split(/[.,]/);
    intPart = onlyDigits(intPart).slice(0, maxIntDigits);
    decPart = onlyDigits(decPart).slice(0, 2);
    // Recompõe usando ponto (compatível com type=number)
    return decPart.length ? `${intPart}.${decPart}` : intPart;
  }

  // Força duas casas decimais (retorna string com ponto)
  function forceTwoDecimals(value, maxIntDigits = 4) {
    // sanitiza textual e depois formata
    const s = sanitizeInterestRaw(String(value ?? ""), maxIntDigits);
    const n = toNum(s);
    if (isNaN(n)) return "";
    // limita novamente a parte inteira antes de formatar
    const capped = capIntDigits(n, maxIntDigits);
    return capped.toFixed(2); // com ponto
  }

  // Corta a parte inteira em N dígitos preservando valor
  function capIntDigits(n, maxIntDigits = 4) {
    const sign = n < 0 ? -1 : 1;
    const abs = Math.abs(n);
    const [intStr] = abs.toString().split(".");
    if (intStr.length <= maxIntDigits) return n;
    // se exceder, trunca para o maior número com N dígitos (ex.: 9999.99)
    const maxInt = Number("9".repeat(maxIntDigits));
    return sign * (maxInt + (abs % 1)); // mantém parte decimal original
  }

  // -------- 1) MESES --------
  document.querySelectorAll(".PremissaInputMESES").forEach((input) => {
    // ao digitar
    input.addEventListener("input", (e) => {
      let v = onlyDigits(e.target.value).slice(0, 2);
      e.target.value = v;
    });
    // ao sair, garante min/max e inteiro
    input.addEventListener("blur", (e) => {
      const min = e.target.min !== "" ? Number(e.target.min) : 0;
      const max = e.target.max !== "" ? Number(e.target.max) : 99;
      let v = Number(onlyDigits(e.target.value));
      if (isNaN(v)) {
        e.target.value = "";
        return;
      }
      if (v < min) v = min;
      if (v > max) v = max;
      e.target.value = String(Math.floor(v));
    });
  });

  // -------- 2) JUROS --------
  document.querySelectorAll(".PremissaInputJUROS").forEach((input) => {
    // ao digitar: limpa e limita inteiro/decimais (mostra com ponto por ser type=number)
    input.addEventListener("input", (e) => {
      const sanitized = sanitizeInterestRaw(e.target.value, 4);
      e.target.value = sanitized;
    });

    // ao sair: força 2 casas e respeita min/max/step
    input.addEventListener("blur", (e) => {
      const min = e.target.min !== "" ? Number(e.target.min) : 0;
      const max = e.target.max !== "" ? Number(e.target.max) : 99;
      const step = e.target.step !== "" ? Number(e.target.step) : 0.01;

      let val = forceTwoDecimals(e.target.value, 4);
      if (val === "") {
        e.target.value = "";
        return;
      }

      let num = Number(val);
      if (num < min) num = min;
      if (num > max) num = max;

      // opcional: alinhar ao step (ex.: 7.53 com step 0.25 -> 7.50)
      if (step > 0) {
        const steps = Math.round(num / step);
        num = steps * step;
      }

      e.target.value = num.toFixed(2); // ponto por ser type=number
    });

    // normaliza valores iniciais já presentes no HTML
    const initial = input.value;
    if (initial != null && initial !== "") {
      input.value = forceTwoDecimals(initial, 4);
    }
  });

  // -------- botões + e - das spinboxes --------
  document.querySelectorAll(".PremissaInputSpinbox").forEach((inputWrapper) => {
    const input = inputWrapper.querySelector('input[type="number"]');
    const btnPlus = inputWrapper.querySelector(".spinControlsMAIS");
    const btnMinus = inputWrapper.querySelector(".spinControlsMENOS");
    if (!input || !btnPlus || !btnMinus) return;

    const applyDelta = (delta) => {
      const step = input.step !== "" ? Number(input.step) : 1;
      const min = input.min !== "" ? Number(input.min) : -Infinity;
      const max = input.max !== "" ? Number(input.max) : Infinity;

      let current = toNum(input.value);
      if (isNaN(current)) current = 0;

      let next = current + delta * step;
      if (next < min) next = min;
      if (next > max) next = max;

      if (input.classList.contains("PremissaInputJUROS")) {
        // limite de dígitos na parte inteira antes de formatar
        next = capIntDigits(next, 4);
        input.value = next.toFixed(2); // ponto, válido para type=number
      } else if (input.classList.contains("PremissaInputMESES")) {
        // meses sempre inteiro, até 2 dígitos
        next = Math.round(next);
        if (next < 0) next = 0;
        input.value = String(next).slice(0, 2);
      } else {
        // fallback genérico
        input.value = String(next);
      }

      // dispara 'input' para manter máscaras sincronizadas
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    btnPlus.addEventListener("click", () => applyDelta(1));
    btnMinus.addEventListener("click", () => applyDelta(-1));
  });
});

// FORMATAR OS INPUTS DE ÁREAS
document.addEventListener("DOMContentLoaded", () => {
  const MAX_DIGITS = 6;

  const digitsOnly = (s) => (s || "").replace(/\D/g, "");
  const clampDigits = (s, max = MAX_DIGITS) => digitsOnly(s).slice(0, max);
  const formatThousands = (s) => (s ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "");

  document.querySelectorAll(".PremissaInputAREAS").forEach((input) => {
    // Permite exibir '.' como separador (type=number não exibe corretamente)
    try { input.type = "text"; } catch (_) {}
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("pattern", "\\d{0," + MAX_DIGITS + "}");

    // Aplica formatação com limite e salva o "valor puro" em data-attr
    const setFormatted = (rawCandidate) => {
      let raw = clampDigits(rawCandidate, MAX_DIGITS);
      // remove zeros à esquerda (mas mantém um zero se for tudo zero)
      raw = raw.replace(/^0+(?=\d)/, "");
      if (raw === "") {
        input.value = "";
        input.dataset.rawValue = "";
        return;
      }
      input.value = formatThousands(raw);
      input.dataset.rawValue = raw; // valor numérico sem pontos
    };

    // Normaliza valor inicial
    setFormatted(input.value);

    // Digitação
    input.addEventListener("input", (e) => {
      setFormatted(e.target.value);
    });

    // Colar
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text");
      setFormatted(text);
    });

    // Blur (reforça a formatação)
    input.addEventListener("blur", (e) => {
      setFormatted(e.target.value);
    });
  });
});

// FORMATAR OS INPUTS DE PREÇOS
document.addEventListener("DOMContentLoaded", () => {
  const MAX_DIGITS = 5;

  const digitsOnly = (s) => (s || "").replace(/\D/g, "");
  const clampDigits = (s, max = MAX_DIGITS) => digitsOnly(s).slice(0, max);
  const formatThousands = (s) => (s ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "");

  document.querySelectorAll(".PremissaInputPRECOS").forEach((input) => {
    // Permite exibir '.' como separador (type=number não exibe corretamente)
    try { input.type = "text"; } catch (_) {}
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("pattern", "\\d{0," + MAX_DIGITS + "}");

    // Aplica formatação com limite e salva o "valor puro" em data-attr
    const setFormatted = (rawCandidate) => {
      let raw = clampDigits(rawCandidate, MAX_DIGITS);
      // remove zeros à esquerda (mas mantém um zero se for tudo zero)
      raw = raw.replace(/^0+(?=\d)/, "");
      if (raw === "") {
        input.value = "";
        input.dataset.rawValue = "";
        return;
      }
      input.value = formatThousands(raw);
      input.dataset.rawValue = raw; // valor numérico sem pontos
    };

    // Normaliza valor inicial
    setFormatted(input.value);

    // Digitação
    input.addEventListener("input", (e) => {
      setFormatted(e.target.value);
    });

    // Colar
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text");
      setFormatted(text);
    });

    // Blur (reforça a formatação)
    input.addEventListener("blur", (e) => {
      setFormatted(e.target.value);
    });
  });
});

// FORMATAR OS INPUTS DE DINHEIROS
document.addEventListener("DOMContentLoaded", () => {
  const MAX_DIGITS = 9;

  const digitsOnly = (s) => (s || "").replace(/\D/g, "");
  const clampDigits = (s, max = MAX_DIGITS) => digitsOnly(s).slice(0, max);
  const formatThousands = (s) => (s ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "");

  document.querySelectorAll(".PremissaInputDINHEIROS").forEach((input) => {
    // Permite exibir '.' como separador (type=number não exibe corretamente)
    try { input.type = "text"; } catch (_) {}
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("pattern", "\\d{0," + MAX_DIGITS + "}");

    // Aplica formatação com limite e salva o "valor puro" em data-attr
    const setFormatted = (rawCandidate) => {
      let raw = clampDigits(rawCandidate, MAX_DIGITS);
      // remove zeros à esquerda (mas mantém um zero se for tudo zero)
      raw = raw.replace(/^0+(?=\d)/, "");
      if (raw === "") {
        input.value = "";
        input.dataset.rawValue = "";
        return;
      }
      input.value = formatThousands(raw);
      input.dataset.rawValue = raw; // valor numérico sem pontos
    };

    // Normaliza valor inicial
    setFormatted(input.value);

    // Digitação
    input.addEventListener("input", (e) => {
      setFormatted(e.target.value);
    });

    // Colar
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text");
      setFormatted(text);
    });

    // Blur (reforça a formatação)
    input.addEventListener("blur", (e) => {
      setFormatted(e.target.value);
    });
  });
});

// FORMATAR OS CALCULOS DE DINHEIROS
document.addEventListener("DOMContentLoaded", () => {
  const MAX_DIGITS = 9;

  const digitsOnly = (s) => (s || "").replace(/\D/g, "");
  const clampDigits = (s, max = MAX_DIGITS) => digitsOnly(s).slice(0, max);
  const formatThousands = (s) => (s ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "");

  document.querySelectorAll(".CalculoDINHEIROS").forEach((input) => {
    // Permite exibir '.' como separador (type=number não exibe corretamente)
    try { input.type = "text"; } catch (_) {}
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("pattern", "\\d{0," + MAX_DIGITS + "}");

    // Aplica formatação com limite e salva o "valor puro" em data-attr
    const setFormatted = (rawCandidate) => {
      let raw = clampDigits(rawCandidate, MAX_DIGITS);
      // remove zeros à esquerda (mas mantém um zero se for tudo zero)
      raw = raw.replace(/^0+(?=\d)/, "");
      if (raw === "") {
        input.value = "";
        input.dataset.rawValue = "";
        return;
      }
      input.value = formatThousands(raw);
      input.dataset.rawValue = raw; // valor numérico sem pontos
    };

    // Normaliza valor inicial
    setFormatted(input.value);

    // Digitação
    input.addEventListener("input", (e) => {
      setFormatted(e.target.value);
    });

    // Colar
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData("text");
      setFormatted(text);
    });

    // Blur (reforça a formatação)
    input.addEventListener("blur", (e) => {
      setFormatted(e.target.value);
    });
  });
});
