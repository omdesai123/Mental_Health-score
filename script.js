/* =========================================================
   MindPulse — script.js
   Handles: form validation, API call to FastAPI backend,
   result rendering, dark/light toggle, reset, toasts.
   ========================================================= */

(() => {
  const API_URL = "https://mental-health-score-1-c133.onrender.com/predict";

  const form = document.getElementById('predictForm');
  const predictBtn = document.getElementById('predictBtn');
  const resetBtn = document.getElementById('resetBtn');
  const resultCard = document.getElementById('resultCard');
  const resultScore = document.getElementById('resultScore');
  const resultStatus = document.getElementById('resultStatus');
  const resultMessage = document.getElementById('resultMessage');
  const resultOrb = document.getElementById('resultOrb');
  const scaleSegs = document.querySelectorAll('.result__scale-seg');
  const toastStack = document.getElementById('toastStack');
  const themeToggle = document.getElementById('themeToggle');

  // Fields that must be sent as numbers to the FastAPI model
  const numericFields = new Set([
    'age',
    'avg_daily_usage_hours',
    'daily_unlocks',
    'study_hours',
    'physical_activity_hours',
    'sleep_hours_per_night',
  ]);

  /* ---------------------------------------------------------
     Toast notifications
     --------------------------------------------------------- */
  function showToast(message, type = 'error') {
    const toast = document.createElement('div');
    toast.className = `toast${type === 'success' ? ' toast--success' : ''}`;
    toast.textContent = message;
    toastStack.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 4200);
  }

  /* ---------------------------------------------------------
     Validation
     --------------------------------------------------------- */
  function clearFieldError(field) {
    const wrapper = field.closest('.field');
    wrapper.classList.remove('field--invalid');
    const errorEl = wrapper.querySelector('.field__error');
    if (errorEl) errorEl.textContent = '';
  }

  function setFieldError(field, message) {
    const wrapper = field.closest('.field');
    wrapper.classList.add('field--invalid');
    const errorEl = wrapper.querySelector('.field__error');
    if (errorEl) errorEl.textContent = message;
  }

  function validateForm() {
    let isValid = true;
    const elements = Array.from(form.elements).filter((el) => el.name);

    elements.forEach((field) => {
      clearFieldError(field);
      const value = field.value.trim();

      if (!value) {
        setFieldError(field, 'This field is required.');
        isValid = false;
        return;
      }

      if (numericFields.has(field.name)) {
        const num = Number(value);
        if (Number.isNaN(num)) {
          setFieldError(field, 'Enter a valid number.');
          isValid = false;
        } else if (num < 0) {
          setFieldError(field, 'Value cannot be negative.');
          isValid = false;
        } else if (field.name === 'age' && (num < 1 || num > 120)) {
          setFieldError(field, 'Enter a realistic age.');
          isValid = false;
        } else if (field.name !== 'age' && num > 24 && field.name !== 'daily_unlocks') {
          setFieldError(field, 'That looks too high for a single day.');
          isValid = false;
        }
      }
    });

    return isValid;
  }

  /* ---------------------------------------------------------
     Build payload matching the FastAPI request model
     --------------------------------------------------------- */
  function buildPayload() {
    const data = new FormData(form);
    const payload = {};
    for (const [key, value] of data.entries()) {
      payload[key] = numericFields.has(key) ? Number(value) : value;
    }
    return payload;
  }

  /* ---------------------------------------------------------
     Result rendering
     --------------------------------------------------------- */
  function describeScore(score) {
    if (score < 3) {
      return {
        label: 'Poor',
        color: 'var(--c-coral)',
        message:
          'Things look strained right now. Small steps like an earlier bedtime or a short walk can genuinely help \u2014 and talking to someone you trust is a good next move.',
        segIndex: 0,
      };
    }
    if (score < 6) {
      return {
        label: 'Average',
        color: 'var(--c-amber)',
        message:
          'You\u2019re holding steady, with room to breathe easier. A little more sleep or movement, and a little less scrolling, could tip things in your favour.',
        segIndex: 1,
      };
    }
    if (score < 8) {
      return {
        label: 'Good',
        color: 'var(--c-teal)',
        message:
          'Your habits are working in your favour. Keep the balance between screen time, rest, and activity that\u2019s getting you here.',
        segIndex: 2,
      };
    }
    return {
      label: 'Excellent',
      color: 'var(--c-violet)',
      message:
        'A strong, well-balanced picture. Whatever rhythm you\u2019ve found between offline life and online life, it\u2019s clearly serving you well.',
      segIndex: 3,
    };
  }

  function renderResult(score) {
    const clamped = Math.max(0, Math.min(10, score));
    const info = describeScore(clamped);

    resultScore.textContent = clamped.toFixed(2);
    resultStatus.textContent = info.label;
    resultStatus.style.color = info.color;
    resultMessage.textContent = info.message;
    resultOrb.style.setProperty('--orb-color', info.color);

    scaleSegs.forEach((seg, i) => {
      seg.classList.toggle('is-active', i === info.segIndex);
    });

    resultCard.hidden = false;
    resultCard.classList.remove('is-revealing');
    // Force reflow so the animation restarts on repeated predictions
    void resultCard.offsetWidth;
    resultCard.classList.add('is-revealing');
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ---------------------------------------------------------
     Submit handler
     --------------------------------------------------------- */
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!validateForm()) {
      showToast('Please fix the highlighted fields before predicting.');
      return;
    }

    const payload = buildPayload();

    predictBtn.classList.add('is-loading');
    predictBtn.disabled = true;

    try {
     const response = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify(payload),
});

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      const score = Number(data.predict_mental_health_score);

      if (Number.isNaN(score)) {
        throw new Error('Unexpected response shape from the server.');
      }

      renderResult(score);
      showToast('Prediction complete.', 'success');
    } catch (error) {
      console.error('Prediction request failed:', error);
      showToast(
        'Couldn\u2019t reach the prediction service. Make sure the FastAPI server is running on http://127.0.0.1:8000.'
      );
    } finally {
      predictBtn.classList.remove('is-loading');
      predictBtn.disabled = false;
    }
  });

  /* ---------------------------------------------------------
     Reset
     --------------------------------------------------------- */
  resetBtn.addEventListener('click', () => {
    form.reset();
    Array.from(form.elements).forEach((el) => {
      if (el.name) clearFieldError(el);
    });
    resultCard.hidden = true;
    resultCard.classList.remove('is-revealing');
  });

  /* ---------------------------------------------------------
     Live-clear errors as the user fixes fields
     --------------------------------------------------------- */
  form.addEventListener('input', (event) => {
    if (event.target.name) clearFieldError(event.target);
  });
  form.addEventListener('change', (event) => {
    if (event.target.name) clearFieldError(event.target);
  });

  /* ---------------------------------------------------------
     Theme toggle (persists only for the session, no storage API
     dependency required by the backend)
     --------------------------------------------------------- */
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('theme-light');
  });
})();
