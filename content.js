(() => {
  'use strict';

  const SKIP_TYPES = new Set([
    'submit', 'button', 'reset', 'image',
    'password', 'file', 'hidden'
  ]);

  function isEligible(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input' && SKIP_TYPES.has((el.type || '').toLowerCase())) return false;
    return tag === 'input' || tag === 'select' || tag === 'textarea';
  }

  function fingerprintField(el, formIdx, fieldIdx) {
    if (el.id)                           return `id:${el.id}`;
    if (el.name)                         return `name:${el.name}`;
    const aria = el.getAttribute('aria-label');
    if (aria)                            return `aria-label:${aria}`;
    if (el.placeholder)                  return `placeholder:${el.placeholder}`;
    return `pos:form${formIdx}:input${fieldIdx}`;
  }

  function readFieldValue(el) {
    const type = (el.type || '').toLowerCase();
    const tag  = el.tagName.toLowerCase();

    if (type === 'checkbox' || type === 'radio') {
      return el.checked;
    }
    if (tag === 'select' && el.multiple) {
      return Array.from(el.selectedOptions).map(o => o.value);
    }
    return el.value;
  }

  function getFieldType(el) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'select') return el.multiple ? 'select-multiple' : 'select';
    if (tag === 'textarea') return 'textarea';
    return (el.type || 'text').toLowerCase();
  }

  function collectFields(container, formIdx) {
    const fields = [];
    const els = container.querySelectorAll('input, select, textarea');
    let fieldIdx = 0;
    for (const el of els) {
      if (!isEligible(el)) continue;
      fields.push({
        fingerprint: fingerprintField(el, formIdx, fieldIdx),
        value: readFieldValue(el),
        type: getFieldType(el)
      });
      fieldIdx++;
    }
    return fields;
  }

  function scanForms() {
    const forms = [];
    const formEls = document.querySelectorAll('form');

    formEls.forEach((form, idx) => {
      const fields = collectFields(form, idx);
      if (fields.length > 0) {
        forms.push({ formIndex: idx, fields });
      }
    });

    // Collect loose inputs (outside any <form>)
    const allInputs = new Set(document.querySelectorAll('input, select, textarea'));
    const formInputs = new Set(document.querySelectorAll('form input, form select, form textarea'));
    const looseEls = [...allInputs].filter(el => !formInputs.has(el));

    if (looseEls.length > 0) {
      const fields = [];
      let fieldIdx = 0;
      for (const el of looseEls) {
        if (!isEligible(el)) continue;
        fields.push({
          fingerprint: fingerprintField(el, -1, fieldIdx),
          value: readFieldValue(el),
          type: getFieldType(el)
        });
        fieldIdx++;
      }
      if (fields.length > 0) {
        forms.push({ formIndex: -1, fields });
      }
    }

    return forms;
  }

  function applyValue(el, stored) {
    const type = (el.type || '').toLowerCase();
    const tag  = el.tagName.toLowerCase();

    if (type === 'checkbox' || type === 'radio') {
      el.checked = !!stored.value;
    } else if (tag === 'select' && el.multiple && Array.isArray(stored.value)) {
      const vals = new Set(stored.value);
      for (const opt of el.options) {
        opt.selected = vals.has(opt.value);
      }
    } else {
      el.value = stored.value == null ? '' : String(stored.value);
    }

    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function findFieldInContainer(container, storedFingerprint, formIdx) {
    const els = container.querySelectorAll('input, select, textarea');
    let fieldIdx = 0;
    for (const el of els) {
      if (!isEligible(el)) continue;
      if (fingerprintField(el, formIdx, fieldIdx) === storedFingerprint) {
        return el;
      }
      fieldIdx++;
    }
    return null;
  }

  function fillForms(storedForms) {
    let filled = 0;
    let skipped = 0;
    const formEls = document.querySelectorAll('form');

    // Build loose-input list for formIndex: -1
    const allInputs = new Set(document.querySelectorAll('input, select, textarea'));
    const formInputs = new Set(document.querySelectorAll('form input, form select, form textarea'));
    const looseEls = [...allInputs].filter(el => !formInputs.has(el));

    for (const storedForm of storedForms) {
      let container;
      if (storedForm.formIndex === -1) {
        // Virtual container wrapping loose inputs
        container = { querySelectorAll: () => looseEls };
      } else {
        container = formEls[storedForm.formIndex];
        if (!container) {
          skipped += storedForm.fields.length;
          continue;
        }
      }

      for (const storedField of storedForm.fields) {
        const el = findFieldInContainer(container, storedField.fingerprint, storedForm.formIndex);
        if (el) {
          applyValue(el, storedField);
          filled++;
        } else {
          skipped++;
        }
      }
    }

    return { filled, skipped };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    try {
      if (msg.action === 'SCAN_FORMS') {
        const forms = scanForms();
        sendResponse({ ok: true, forms });
      } else if (msg.action === 'FILL_FORMS') {
        const { filled, skipped } = fillForms(msg.payload.forms);
        sendResponse({ ok: true, filled, skipped });
      } else {
        sendResponse({ ok: false, error: 'Unknown action' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message });
    }
    return true; // keep channel open for async response
  });
})();
