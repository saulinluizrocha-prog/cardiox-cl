(function () {
  'use strict';

  /* ============================================================
     1. CAPTURA DE PARAMS DA URL (gclid, sub1-5, utms)
     ============================================================ */
  var urlParams = new URLSearchParams(window.location.search);

  var trackedParams = {
    gclid    : urlParams.get('gclid')       || '',
    sub1     : urlParams.get('sub1')        || '',
    sub2     : urlParams.get('sub2')        || '',
    sub3     : urlParams.get('sub3')        || '',
    sub4     : urlParams.get('sub4')        || '',
    sub5     : urlParams.get('sub5')        || '',
    utm_source   : urlParams.get('utm_source')   || '',
    utm_medium   : urlParams.get('utm_medium')   || '',
    utm_campaign : urlParams.get('utm_campaign') || '',
    utm_term     : urlParams.get('utm_term')     || '',
    utm_content  : urlParams.get('utm_content')  || '',
  };

  // Persistir em sessionStorage para não perder em navegação interna
  Object.keys(trackedParams).forEach(function (key) {
    if (trackedParams[key]) {
      sessionStorage.setItem('cl_' + key, trackedParams[key]);
    } else {
      // Tentar recuperar do sessionStorage se não veio na URL
      var stored = sessionStorage.getItem('cl_' + key);
      if (stored) trackedParams[key] = stored;
    }
  });

  /* ============================================================
     2. NORMALIZAÇÃO DE TELEFONE — CHILE (+56)
     Aceita: +569..., 569..., 0056..., 9XXXXXXXX, XXXXXXXX
     Normaliza para: +56XXXXXXXXX
     ============================================================ */
  function normalizeChilePhone(raw) {
    // Remove tudo exceto dígitos
    var digits = raw.replace(/\D/g, '');

    // Remove prefixo internacional 00 (0056 → 56...)
    if (digits.indexOf('0056') === 0) digits = digits.slice(2);

    // Já tem código do país (56...)
    if (digits.indexOf('56') === 0) {
      var afterCC = digits.slice(2); // dígitos após o 56
      if (afterCC.length >= 8 && afterCC.length <= 9) {
        return '+56' + afterCC;
      }
      return null;
    }

    // Formato local com 9 à frente: 9XXXXXXXX (9 dígitos)
    if (digits.indexOf('9') === 0 && digits.length === 9) {
      return '+56' + digits;
    }

    // Formato local sem o 9 (8 dígitos apenas): adiciona 9 na frente
    if (digits.length === 8) {
      return '+569' + digits;
    }

    // Fixo Santiago (começa com 2) ou outras regiões — 9 dígitos
    if (digits.length === 9) {
      return '+56' + digits;
    }

    return null; // inválido
  }

  function isValidNormalized(normalized) {
    if (!normalized) return false;
    // +56 seguido de exatamente 9 dígitos
    return /^\+56\d{9}$/.test(normalized);
  }

  /* ============================================================
     3. FORMATAÇÃO VISUAL DO CAMPO TELEFONE (enquanto digita)
     ============================================================ */
  function formatPhoneDisplay(value) {
    var digits = value.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 1) return digits;
    if (digits.length <= 5) return digits.slice(0, 1) + ' ' + digits.slice(1);
    return digits.slice(0, 1) + ' ' + digits.slice(1, 5) + ' ' + digits.slice(5);
  }

  /* ============================================================
     4. EXIBIR PREÇOS (mantém compatibilidade com código original)
     ============================================================ */
  var promoEl = document.getElementsByClassName('al-cost-promo');
  for (var p = 0; p < promoEl.length; p++) {
    promoEl[p].innerText = '69.000 CLP';
  }

  var priceEl = document.getElementsByClassName('al-cost');
  for (var q = 0; q < priceEl.length; q++) {
    priceEl[q].innerText = '34.500 CLP';
  }

  /* ============================================================
     5. CONFIGURAR FORMULÁRIOS
     ============================================================ */
  document.addEventListener('DOMContentLoaded', function () {

    var forms = document.forms;

    for (var i = 0; i < forms.length; i++) {
      (function (form) {

        // 5a. Definir action e method
        form.action = '/api/order' + window.location.search;
        form.method = 'POST';

        // 5b. Injetar campos hidden de rastreamento
        var hiddenFields = Object.assign({}, trackedParams);

        // gclid vai para sub1 se sub1 estiver vazio
        if (hiddenFields.gclid && !hiddenFields.sub1) {
          hiddenFields.sub1 = hiddenFields.gclid;
        }

        Object.keys(hiddenFields).forEach(function (key) {
          var existing = form.querySelector('input[name="' + key + '"]');
          if (!existing) {
            var hidden = document.createElement('input');
            hidden.type  = 'hidden';
            hidden.name  = key;
            hidden.value = hiddenFields[key];
            hidden.className = 'cl-tracking-field';
            form.appendChild(hidden);
          } else {
            existing.value = hiddenFields[key];
          }
        });

        // 5c. Campo country
        var countryField = form.querySelector('[name="country"]');
        if (countryField) countryField.value = 'CL';

        // 5d. Required nos campos principais
        var nameField  = form.querySelector('[name="name"]');
        var phoneField = form.querySelector('[name="phone"]');
        var submitBtn  = form.querySelector('[type="submit"]');

        if (nameField)  nameField.required  = true;
        if (phoneField) phoneField.required = true;

        // 5e. Criar div de erro inline para o telefone (se não existir)
        var errorDiv = form.querySelector('.cl-phone-error');
        if (!errorDiv && phoneField) {
          errorDiv = document.createElement('div');
          errorDiv.className = 'cl-phone-error';
          errorDiv.style.cssText = 'color:#e63946;font-size:13px;margin-top:-8px;margin-bottom:8px;display:none;';
          phoneField.parentNode.insertBefore(errorDiv, phoneField.nextSibling);
        }

        // 5f. Formatação visual ao digitar
        if (phoneField) {
          phoneField.setAttribute('placeholder', '9 XXXX XXXX');
          phoneField.setAttribute('inputmode', 'tel');
          phoneField.setAttribute('maxlength', '13');

          phoneField.addEventListener('input', function () {
            var raw = this.value;
            // Só formata se não começar com + ou 0 (usuário pode estar digitando prefixo)
            if (!raw.startsWith('+') && !raw.startsWith('00') && !raw.startsWith('56')) {
              this.value = formatPhoneDisplay(raw);
            }
            if (errorDiv) errorDiv.style.display = 'none';
          });
        }

        // 5g. Validação + submit
        form.addEventListener('submit', function (e) {
          e.preventDefault();

          // Validar nome
          if (nameField && !nameField.value.trim()) {
            nameField.focus();
            return;
          }

          // Validar e normalizar telefone
          var rawPhone = phoneField ? phoneField.value : '';
          var normalized = normalizeChilePhone(rawPhone);

          if (!isValidNormalized(normalized)) {
            if (errorDiv) {
              errorDiv.textContent = 'Número inválido. Ejemplo: 9 1234 5678';
              errorDiv.style.display = 'block';
            }
            if (phoneField) phoneField.focus();
            return;
          }

          // Sobrescrever com número normalizado
          phoneField.value = normalized;

          // Atualizar hidden fields com valores finais
          var gclidHidden = form.querySelector('input[name="gclid"]');
          if (gclidHidden) gclidHidden.value = trackedParams.gclid;

          // Estado de loading no botão
          if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalText = submitBtn.textContent;
            submitBtn.textContent = 'Enviando…';
            submitBtn.style.opacity = '0.7';
          }

          // Submeter o form
          form.submit();
        });

      })(forms[i]);
    }

    /* ============================================================
       6. SCROLL SUAVE PARA O FORMULÁRIO (links internos)
       ============================================================ */
    var links = document.querySelectorAll('a:not(.js-noscroll)');
    links.forEach(function (link) {
      link.addEventListener('click', function (e) {
        var formTarget = document.getElementById('form');
        if (formTarget) {
          e.preventDefault();
          window.scrollTo({ top: formTarget.offsetTop - 20, behavior: 'smooth' });
        }
      });
    });

  }); // DOMContentLoaded

})();