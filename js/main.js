// M1 Detailing, новый дизайн: блоки плавно проявляются при прокрутке (один раз).
document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', function () {
  var items = document.querySelectorAll('.up, .wedge, .obs');

  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('on'); });
  } else {
    // блок проявляется один раз и больше не прячется (чтобы при переходе по ссылке или поиске не было пустых мест)
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  setupBooking();
});

// ===== Анкета заявки =====
// Отправляет заявку туда же, куда и форма на рабочей главной: /api/lead.php (видно в админке).
// Защита от ботов: скрытое поле-ловушка, проверка, что форму заполняет человек, и лимит отправок.
function setupBooking() {
  var form = document.getElementById('bookingForm');
  if (!form) return;
  var phone = document.getElementById('bkPhone');
  var dateEl = document.getElementById('bkDate');
  var timeEl = document.getElementById('bkTime');
  var btn = document.getElementById('bkSubmit');
  var status = document.getElementById('bkStatus');
  var URL = '/api/lead.php';
  var KEY = 'm1_booking';
  var sending = false;

  // --- телефон: +7 (XXX) XXX-XX-XX ---
  function fmt(raw) {
    var d = raw.replace(/\D/g, '');
    if (/^[78]/.test(d)) d = d.slice(1);
    d = d.slice(0, 10);
    var out = '+7';
    if (d.length > 0) out += ' (' + d.slice(0, 3);
    if (d.length > 3) out += ') ' + d.slice(3, 6);
    if (d.length > 6) out += '-' + d.slice(6, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    return out;
  }
  phone.addEventListener('input', function () { phone.value = fmt(phone.value); });
  phone.addEventListener('focus', function () { if (!phone.value) phone.value = '+7'; });

  // --- дата: от сегодня до +60 дней; время: 11:00–22:00 (работаем до 23:00) ---
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function setRange() {
    var max = new Date(); max.setDate(max.getDate() + 60);
    dateEl.min = iso(new Date()); dateEl.max = iso(max);
  }
  setRange();
  var HOURS = [];
  for (let h = 11; h <= 22; h++) HOURS.push(String(h).padStart(2, '0') + ':00');
  timeEl.innerHTML = '<option value="">Выберите время</option>';
  HOURS.forEach(function (t) { var o = document.createElement('option'); o.textContent = t; timeEl.appendChild(o); });
  function refreshHours() {
    var today = dateEl.value === iso(new Date());
    var nowH = new Date().getHours();
    Array.prototype.forEach.call(timeEl.options, function (o) { if (o.value) o.disabled = today && +o.value.slice(0, 2) <= nowH; });
    if (timeEl.selectedOptions[0] && timeEl.selectedOptions[0].disabled) timeEl.value = '';
  }
  dateEl.addEventListener('change', refreshHours);
  timeEl.addEventListener('focus', refreshHours);

  // --- живой ли человек заполняет форму ---
  var st = { start: 0, human: false };
  ['pointerdown', 'touchstart', 'keydown', 'input', 'change'].forEach(function (ev) {
    form.addEventListener(ev, function (e) {
      if (!e.isTrusted) return;
      if (!st.start) st.start = Date.now();
      if (e.type !== 'input' && e.type !== 'change') st.human = true;
    }, { passive: true, capture: true });
  });
  function sentList() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter(function (t) { return Date.now() - t < 3600000; }); }
    catch (e) { return []; }
  }

  function show(type, html) { status.className = 'bform__status ' + type; status.innerHTML = html; }
  function bad(field, text) {
    show('bad', text);
    field.classList.add('err');
    field.focus();
    field.addEventListener('input', function () { field.classList.remove('err'); }, { once: true });
    field.addEventListener('change', function () { field.classList.remove('err'); }, { once: true });
  }
  function done(num) {
    show('ok', 'Заявка отправлена! Мы свяжемся с вами' + (num ? ' по номеру ' + num : '') + ' и подтвердим время.');
    form.reset();
    phone.value = '+7';
  }
  function clean(s) { return String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim(); }
  function hasLink(s) { return /(https?:\/\/|www\.|\.(ru|com|net|org|рф)\b)/i.test(s); }

  var SERVICES = Array.prototype.map.call(form.elements['service'].options, function (o) { return o.value; }).filter(Boolean);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    setRange(); refreshHours();
    var f = form.elements;

    // ловушки для ботов: делаем вид, что всё прошло, ничего не отправляя
    if (f['website'].value || navigator.webdriver || !st.human) { done(''); return; }
    if (!st.start || Date.now() - st.start < 4000) { show('bad', 'Проверьте, пожалуйста, данные и нажмите «Отправить заявку» ещё раз.'); return; }
    var list = sentList();
    if (list.length >= 3) { show('bad', 'Заявка уже отправлена. Если срочно — позвоните: <a href="tel:+79032444222">+7&nbsp;903&nbsp;244-42-22</a>.'); return; }

    var data = {
      form: 'Запись',
      name: clean(f['name'].value).slice(0, 60),
      phone: f['phone'].value.trim(),
      service: f['service'].value,
      date: f['date'].value,
      time: f['time'].value,
      car: clean(f['car'].value).slice(0, 60),
      comment: clean(f['comment'].value).slice(0, 500),
      consent: true,
      page: location.origin + location.pathname
    };

    if (!/^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё '’.-]{1,59}$/.test(data.name)) return bad(f['name'], 'Укажите имя буквами (минимум 2 буквы).');
    if (!/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(data.phone)) return bad(f['phone'], 'Введите номер телефона полностью.');
    if (SERVICES.indexOf(data.service) < 0) return bad(f['service'], 'Выберите услугу из списка.');
    if (!data.date || data.date < dateEl.min || data.date > dateEl.max) return bad(dateEl, 'Выберите дату в пределах ближайших 60 дней.');
    if (HOURS.indexOf(data.time) < 0) return bad(timeEl, 'Выберите время из списка.');
    if (hasLink(data.car)) return bad(f['car'], 'Пожалуйста, без ссылок.');
    if (hasLink(data.comment)) return bad(f['comment'], 'Пожалуйста, без ссылок в комментарии.');
    if (!f['consent'].checked) { show('bad', 'Отметьте согласие на обработку персональных данных.'); f['consent'].focus(); return; }

    sending = true;
    btn.disabled = true;
    var label = btn.innerHTML;
    btn.textContent = 'Отправляем…';
    var ctrl = new AbortController();
    var to = setTimeout(function () { ctrl.abort(); }, 15000);
    fetch(URL, { method: 'POST', body: JSON.stringify(data), signal: ctrl.signal })
      .then(function (res) { return res.json(); })
      .then(function (out) {
        if (!out.ok) throw new Error(out.error || 'server');
        list.push(Date.now());
        try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (err) { /* приватный режим */ }
        done(data.phone);
      })
      .catch(function () {
        show('bad', 'Не получилось отправить заявку. Попробуйте ещё раз или позвоните: <a href="tel:+79032444222">+7&nbsp;903&nbsp;244-42-22</a>.');
      })
      .then(function () {
        clearTimeout(to);
        sending = false;
        btn.disabled = false;
        btn.innerHTML = label;
      });
  });
}

// ===== Меню «Услуги»: открывается при наведении (CSS) и по нажатию — для телефона и клавиатуры =====
document.addEventListener('DOMContentLoaded', function () {
  var dd = document.getElementById('navServices');
  if (!dd) return;
  var btn = dd.querySelector('.dd__btn');
  function set(open) { dd.classList.toggle('open', open); btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
  btn.addEventListener('click', function (e) { e.stopPropagation(); set(!dd.classList.contains('open')); });
  document.addEventListener('click', function (e) { if (!dd.contains(e.target)) set(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && dd.classList.contains('open')) { set(false); btn.focus(); } });
});

// ===== Мобильное меню: «бургер» открывает список услуг на весь экран =====
document.addEventListener('DOMContentLoaded', function () {
  var btn = document.getElementById('burger');
  var panel = document.getElementById('mnav');
  var list = document.getElementById('mnavList');
  if (!btn || !panel) return;
  // список услуг берём из десктопного меню, чтобы не держать его в двух местах
  document.querySelectorAll('.dd__menu a:not(.dd__all)').forEach(function (a) {
    var c = a.cloneNode(true);
    list.appendChild(c);
  });
  // пока меню открыто, всё остальное на странице недоступно для клавиатуры и экранного диктора
  var behind = document.querySelectorAll('main, footer, .mbar');
  var hideTimer;
  function set(open, returnFocus) {
    if (open === document.body.classList.contains('nav-open')) return;
    clearTimeout(hideTimer);
    if (open) { panel.hidden = false; void panel.offsetWidth; }   // показать панель до анимации появления
    document.body.classList.toggle('nav-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    behind.forEach(function (el) { if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
    if (open) {
      setTimeout(function () { var first = list.querySelector('a'); if (first) first.focus(); }, 60);
    } else {
      hideTimer = setTimeout(function () { panel.hidden = true; }, 400);   // после анимации закрытия
      if (returnFocus) btn.focus();
    }
  }
  btn.addEventListener('click', function () { set(!document.body.classList.contains('nav-open'), true); });
  panel.addEventListener('click', function (e) { if (e.target.closest('a')) set(false, false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && document.body.classList.contains('nav-open')) set(false, true); });
  window.addEventListener('resize', function () { if (innerWidth > 1100) set(false, false); });
});

// ===== Нижняя панель на телефоне прячется, пока на экране анкета записи =====
document.addEventListener('DOMContentLoaded', function () {
  var book = document.querySelector('.book');
  if (!book || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function (entries) {
    document.body.classList.toggle('book-in-view', entries[0].isIntersecting);
  }, { threshold: 0.15 }).observe(book);
});

// ===== Окно «Рассчитать стоимость» и панель «Обратная связь» =====
document.addEventListener('DOMContentLoaded', function () {
  var modal = document.getElementById('calcModal');
  var cbw = document.getElementById('cbWidget');
  var cbPanel = document.getElementById('cbPanel');
  var cbToggle = document.getElementById('cbToggle');
  var lastFocus = null;

  function firstField(box) { return box.querySelector('input:not(.hp):not([type=checkbox])') || box.querySelector('textarea, select, button'); }

  function openCalc() {
    if (!modal) return;
    closeCb(false);
    lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add('lm-lock');
    setTimeout(function () { var ph = modal.querySelector('input[name=phone]'); (ph || firstField(modal)).focus(); }, 60);
  }
  function closeCalc() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove('lm-lock');
    if (lastFocus) lastFocus.focus();
  }
  function openCb() {
    if (!cbPanel) return;
    lastFocus = document.activeElement;
    cbPanel.hidden = false; cbw.classList.add('open');
    if (cbToggle) cbToggle.setAttribute('aria-expanded', 'true');
    setTimeout(function () { firstField(cbPanel).focus(); }, 60);
  }
  function closeCb(returnFocus) {
    if (!cbPanel || cbPanel.hidden) return;
    cbPanel.hidden = true; cbw.classList.remove('open');
    if (cbToggle) cbToggle.setAttribute('aria-expanded', 'false');
    if (returnFocus !== false && lastFocus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var op = e.target.closest('[data-open]');
    if (op) {
      e.preventDefault();
      if (op.dataset.open === 'calc') openCalc();
      if (op.dataset.open === 'cb') { if (cbPanel.hidden) openCb(); else closeCb(); }
      return;
    }
    var cl = e.target.closest('[data-close]');
    if (cl) { if (cl.dataset.close === 'calc') closeCalc(); else closeCb(); return; }
    // нажатие мимо панели обратной связи — закрыть
    if (cbPanel && !cbPanel.hidden && !cbw.contains(e.target)) closeCb(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (modal && !modal.hidden) closeCalc(); else closeCb();
  });
  // Tab не уходит из открытого окна расчёта
  if (modal) modal.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = [].filter.call(modal.querySelectorAll('a,button,input:not(.hp),select,textarea,summary'), function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });

  document.querySelectorAll('.lform').forEach(setupLeadForm);
});

// Короткие формы (расчёт и обратная связь): телефон, проверка, защита от ботов, отправка.
// Отправка идёт туда же, куда на сайте M1 (/api/lead.php); в этом проекте приёмника нет —
// тогда человек видит сообщение с телефоном студии.
function setupLeadForm(form) {
  var phone = form.querySelector('input[name=phone]');
  var status = form.querySelector('.bform__status');
  var btn = form.querySelector('button[type=submit]');
  var KEY = 'm1_lead_' + form.dataset.kind;
  var st = { start: 0, human: false }, sending = false;

  function fmt(raw) {
    var d = raw.replace(/\D/g, '');
    if (/^[78]/.test(d)) d = d.slice(1);
    d = d.slice(0, 10);
    var out = '+7';
    if (d.length > 0) out += ' (' + d.slice(0, 3);
    if (d.length > 3) out += ') ' + d.slice(3, 6);
    if (d.length > 6) out += '-' + d.slice(6, 8);
    if (d.length > 8) out += '-' + d.slice(8, 10);
    return out;
  }
  phone.addEventListener('input', function () { phone.value = fmt(phone.value); });
  // живой человек: касания, клавиатура, клик или фокус (так не теряются заявки от экранных дикторов)
  ['pointerdown', 'touchstart', 'keydown', 'click', 'focusin', 'input'].forEach(function (ev) {
    form.addEventListener(ev, function (e) {
      if (!e.isTrusted) return;
      if (!st.start) st.start = Date.now();
      if (e.type !== 'input') st.human = true;
    }, { passive: true, capture: true });
  });
  function show(type, html) { status.className = 'bform__status ' + type; status.innerHTML = html; }
  function bad(field, text) { show('bad', text); field.classList.add('err'); field.setAttribute('aria-invalid', 'true'); field.focus();
    field.addEventListener('input', function () { field.classList.remove('err'); field.removeAttribute('aria-invalid'); }, { once: true }); }
  function clean(s) { return String(s || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim(); }
  var CALL = 'позвоните: <a href="tel:+79032444222">+7&nbsp;903&nbsp;244-42-22</a>';

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sending) return;
    var f = form.elements;
    if (f['website'].value) { show('ok', 'Заявка отправлена! Мы перезвоним.'); form.reset(); phone.value = '+7'; return; }   // ловушка для ботов
    if (navigator.webdriver || !st.human || Date.now() - st.start < 3000) { show('bad', 'Проверьте, пожалуйста, данные и нажмите кнопку ещё раз.'); st.human = true; return; }
    var name = clean(f['name'] ? f['name'].value : '').slice(0, 60);
    if (form.dataset.nameRequired && !/^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё '’.-]{1,59}$/.test(name)) return bad(f['name'], 'Укажите имя буквами (минимум 2 буквы).');
    if (!/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/.test(phone.value)) return bad(phone, 'Введите номер телефона полностью.');
    if (!f['consent'].checked) { show('bad', 'Отметьте согласие на обработку персональных данных.'); f['consent'].focus(); return; }
    var sent = []; try { sent = JSON.parse(localStorage.getItem(KEY) || '[]').filter(function (t) { return Date.now() - t < 3600000; }); } catch (err) {}
    if (sent.length >= 3) { show('bad', 'Заявка уже отправлена. Если срочно — ' + CALL + '.'); return; }
    var data = { form: form.dataset.label, name: name, phone: phone.value,
      car: clean(f['car'] ? f['car'].value : '').slice(0, 60), service: f['service'] ? f['service'].value : '',
      comment: clean(f['comment'] ? f['comment'].value : '').slice(0, 500), consent: f['consent'].checked, page: location.origin + location.pathname };
    sending = true; btn.disabled = true;
    var ctrl = new AbortController(), to = setTimeout(function () { ctrl.abort(); }, 15000);
    fetch('/api/lead.php', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: ctrl.signal })
      .then(function (res) { if (!res.ok) throw new Error('http ' + res.status); return res.json(); })
      .then(function (out) {
        if (!out.ok) throw new Error('server');
        sent.push(Date.now()); try { localStorage.setItem(KEY, JSON.stringify(sent)); } catch (err) {}
        show('ok', 'Заявка отправлена! Перезвоним по номеру ' + data.phone + '.');
        form.reset(); phone.value = '+7';
      })
      .catch(function () { show('bad', 'Не получилось отправить заявку. Попробуйте ещё раз или ' + CALL + '.'); })
      .then(function () { clearTimeout(to); sending = false; btn.disabled = false; });
  });
}
