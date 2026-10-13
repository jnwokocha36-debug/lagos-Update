(function () {
  'use strict';

  var cfg = window.APP_CONFIG || {};
  var sb = null;
  try { sb = window.supabase.createClient(cfg.url, cfg.key); } catch (e) { sb = null; }

  function $(id) { return document.getElementById(id); }
  function getStore(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function setStore(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  // Approximate centre points. Used to place pins on the map.
  var AREAS = [
    { name: 'Ikeja', lat: 6.6018, lng: 3.3515 },
    { name: 'Surulere', lat: 6.5010, lng: 3.3580 },
    { name: 'Lekki', lat: 6.4478, lng: 3.4723 },
    { name: 'Yaba', lat: 6.5095, lng: 3.3711 },
    { name: 'Ajah', lat: 6.4698, lng: 3.5852 },
    { name: 'Ikorodu', lat: 6.6194, lng: 3.5105 },
    { name: 'Maryland', lat: 6.5667, lng: 3.3647 },
    { name: 'Ikoyi', lat: 6.4549, lng: 3.4366 },
    { name: 'Victoria Island', lat: 6.4281, lng: 3.4219 },
    { name: 'Oshodi', lat: 6.5550, lng: 3.3430 },
    { name: 'Apapa', lat: 6.4489, lng: 3.3590 },
    { name: 'Festac', lat: 6.4667, lng: 3.2833 },
    { name: 'Ojota', lat: 6.5833, lng: 3.3833 },
    { name: 'Gbagada', lat: 6.5528, lng: 3.3917 },
    { name: 'Ketu', lat: 6.5976, lng: 3.3883 },
    { name: 'Mushin', lat: 6.5276, lng: 3.3550 },
    { name: 'Agege', lat: 6.6203, lng: 3.3190 },
    { name: 'Lagos Island', lat: 6.4541, lng: 3.3947 },
    { name: 'Third Mainland Bridge', lat: 6.4990, lng: 3.3990 }
  ];

  var LABEL = { jam: 'Road don jam', free: 'Road dey free', out: 'Light don go', restored: 'Light don come' };
  var KIND = { jam: 'traffic', free: 'traffic', out: 'power', restored: 'power' };
  var COLOR = { jam: '#C93636', free: '#0B6B3A', out: '#E0A010', restored: '#1E9E5A' };
  var THANKS = {
    jam: 'Thank you o, you don help people life lydis.',
    free: 'Thank you o, you don help people life lydis.',
    out: 'Thank you o, na to try buy fuel',
    restored: 'Ahh Thank God o'
  };

  var reports = [];
  var map = null;
  var layer = null;
  var homeArea = getStore('area') || '';

  function timeAgo(iso) {
    var m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
    if (m < 1) return 'just now';
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    return h + (h === 1 ? ' hour ago' : ' hours ago');
  }

  function findArea(name) {
    for (var i = 0; i < AREAS.length; i++) if (AREAS[i].name === name) return AREAS[i];
    return null;
  }

  function showNote(el, text) {
    if (!text) { el.hidden = true; el.textContent = ''; return; }
    el.textContent = text;
    el.hidden = false;
  }

  function showLines(el, lines) {
    el.textContent = '';
    lines.forEach(function (l) {
      var d = document.createElement('div');
      d.textContent = l;
      el.appendChild(d);
    });
    el.hidden = false;
    try { el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* ignore */ }
  }

  // ---------- Map ----------
  function initMap() {
    if (map || !window.L) return;
    map = L.map('map', { zoomControl: true }).setView([6.5244, 3.3792], 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    layer = L.layerGroup().addTo(map);
  }

  function drawMarkers() {
    if (!map || !layer) return;
    layer.clearLayers();
    var cutoff = Date.now() - 6 * 3600 * 1000;
    reports.forEach(function (r) {
      if (r.lat == null || r.lng == null) return;
      if (new Date(r.created_at).getTime() < cutoff) return;
      var m = L.circleMarker([r.lat, r.lng], {
        radius: 9, color: '#FFFFFF', weight: 3, fillColor: COLOR[r.status] || '#555', fillOpacity: 1
      });
      var el = document.createElement('div');
      el.textContent = (LABEL[r.status] || '') + ', ' + r.area + ', ' + timeAgo(r.created_at);
      m.bindPopup(el);
      m.addTo(layer);
    });
  }

  // ---------- Data ----------
  function fetchReports() {
    if (!sb) { showNote($('note'), 'App no fit connect. Check your network.'); return Promise.resolve(); }
    var since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
    return sb.from('reports')
      .select('id,kind,status,area,lat,lng,created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(function (res) {
        if (res.error) { showNote($('note'), 'Network wahala. Try again small time.'); return; }
        showNote($('note'), '');
        reports = res.data || [];
        drawMarkers();
      })
      .catch(function () { showNote($('note'), 'Network wahala. Try again small time.'); });
  }

  // ---------- Check: traffic ----------
  function trafficLines(dest) {
    var cutoff = Date.now() - 3 * 3600 * 1000;
    var q = (dest || '').trim().toLowerCase();
    var list = reports.filter(function (r) {
      return r.kind === 'traffic' &&
        new Date(r.created_at).getTime() > cutoff &&
        (!q || r.area.toLowerCase().indexOf(q) !== -1);
    });
    if (!list.length) {
      return [q ? 'No report yet for ' + dest.trim() + '. Be the first to report o.' : 'No traffic report yet. Be the first to report o.'];
    }
    return list.slice(0, 3).map(function (r) {
      return r.area + ': ' + LABEL[r.status] + ', ' + timeAgo(r.created_at) + '.';
    });
  }

  // ---------- Check: power ----------
  function powerLine(area) {
    var a = (area || '').trim();
    if (!a) return 'Type your area first o.';
    var cutoff = Date.now() - 6 * 3600 * 1000;
    var q = a.toLowerCase();
    var found = null;
    for (var i = 0; i < reports.length; i++) {
      var r = reports[i];
      if (r.kind === 'power' && new Date(r.created_at).getTime() > cutoff && r.area.toLowerCase().indexOf(q) !== -1) {
        found = r;
        break;
      }
    }
    if (!found) return 'No report yet for ' + a + '. Be the first to report o.';
    var recent = Date.now() - 2 * 3600 * 1000;
    var same = reports.filter(function (x) {
      return x.kind === 'power' && x.area === found.area && x.status === found.status && new Date(x.created_at).getTime() > recent;
    }).length;
    var count = same > 1 ? ' ' + same + ' reports.' : '';
    return found.area + ': ' + (found.status === 'out' ? 'no light.' : 'light dey.') + ' ' + timeAgo(found.created_at) + '.' + count;
  }

  function nearestArea(lat, lng) {
    var best = null, bestD = Infinity;
    AREAS.forEach(function (a) {
      var dy = a.lat - lat, dx = (a.lng - lng) * 0.99;
      var d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = a; }
    });
    return best;
  }

  function selectPowerChip(label) {
    var chips = $('power-chips').children;
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('on', chips[i].textContent === label);
  }

  function showPower(area) {
    showLines($('power-result'), [powerLine(area)]);
  }

  function buildPowerChips() {
    var box = $('power-chips');
    box.textContent = '';
    var names = ['Use my location'];
    if (homeArea && ['Ikeja', 'Surulere', 'Lekki', 'Yaba'].indexOf(homeArea) === -1) names.push(homeArea);
    names = names.concat(['Ikeja', 'Surulere', 'Lekki', 'Yaba']);
    names.forEach(function (n) {
      var b = document.createElement('button');
      b.className = 'chip';
      b.type = 'button';
      b.textContent = n;
      b.addEventListener('click', function () {
        selectPowerChip(n);
        if (n === 'Use my location') {
          if (!navigator.geolocation) { showLines($('power-result'), ['Your phone no allow location. Type your area.']); return; }
          showLines($('power-result'), ['Dey find where you dey...']);
          navigator.geolocation.getCurrentPosition(function (pos) {
            var a = nearestArea(pos.coords.latitude, pos.coords.longitude);
            if (a) { $('area-input').value = a.name; showPower(a.name); }
          }, function () {
            showLines($('power-result'), ['We no fit see your location. Type your area.']);
          }, { timeout: 10000 });
        } else {
          $('area-input').value = n;
          showPower(n);
        }
      });
      box.appendChild(b);
    });
  }

  // ---------- Report ----------
  // A random id for this phone, kept on the phone. The database uses it
  // to stop one phone from posting too many reports. It holds no name or number.
  function getDeviceId() {
    var id = getStore('device');
    if (id && id.length >= 8) return id;
    try {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : '';
    } catch (e) { id = ''; }
    if (!id) id = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    setStore('device', id);
    return id;
  }

  function fillReportAreas() {
    var sel = $('report-area');
    sel.textContent = '';
    AREAS.forEach(function (a) {
      var o = document.createElement('option');
      o.value = a.name;
      o.textContent = a.name;
      sel.appendChild(o);
    });
    if (homeArea && findArea(homeArea)) sel.value = homeArea;
  }

  function openSheet() { showNote($('sheet-note'), ''); $('sheet').hidden = false; }
  function closeSheet() { $('sheet').hidden = true; }

  function sendReport(status) {
    var area = $('report-area').value;
    var a = findArea(area);
    var key = 'last:' + status + ':' + area;
    var last = parseInt(getStore(key) || '0', 10);
    if (Date.now() - last < 60000) { showNote($('sheet-note'), 'You don already report am. Wait small.'); return; }
    if (!sb) { showNote($('sheet-note'), 'App no fit connect. Check your network.'); return; }
    showNote($('sheet-note'), 'Dey send...');
    sb.from('reports')
      .insert({ kind: KIND[status], status: status, area: area, lat: a ? a.lat : null, lng: a ? a.lng : null, device_id: getDeviceId() })
      .select('id,kind,status,area,lat,lng,created_at')
      .single()
      .then(function (res) {
        if (res.error || !res.data) {
          var msg = (res.error && res.error.message) || '';
          if (msg.indexOf('Already reported') !== -1) showNote($('sheet-note'), 'You don already report am. Wait small.');
          else if (msg.indexOf('Too many') !== -1) showNote($('sheet-note'), 'You don report plenty. Try again later.');
          else showNote($('sheet-note'), 'E no go. Check your network and try again.');
          return;
        }
        setStore(key, String(Date.now()));
        reports.unshift(res.data);
        drawMarkers();
        closeSheet();
        $('thanks-title').textContent = THANKS[status];
        $('thanks-sub').textContent = 'Your report don enter: ' + LABEL[status];
        $('thanks').hidden = false;
      })
      .catch(function () { showNote($('sheet-note'), 'E no go. Check your network and try again.'); });
  }

  // ---------- Onboarding ----------
  function buildObChips() {
    var box = $('ob-chips');
    box.textContent = '';
    AREAS.slice(0, 8).forEach(function (a) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (a.name === homeArea ? ' on' : '');
      b.textContent = a.name;
      b.addEventListener('click', function () {
        homeArea = a.name;
        setStore('area', homeArea);
        var all = box.children;
        for (var i = 0; i < all.length; i++) all[i].classList.toggle('on', all[i].textContent === a.name);
      });
      box.appendChild(b);
    });
  }

  function setObStep(n) {
    $('ob-1').hidden = n !== 1;
    $('ob-2').hidden = n !== 2;
    $('ob-step-label').textContent = 'Step ' + n + ' of 2';
    $('seg2').className = n === 2 ? 'on' : '';
  }

  function showHome() {
    $('onboarding').hidden = true;
    $('home').hidden = false;
    fillReportAreas();
    buildPowerChips();
    initMap();
    setTimeout(function () { if (map) map.invalidateSize(); }, 80);
    fetchReports();
  }

  function toggle(btnId, panelId) {
    var p = $(panelId);
    p.hidden = !p.hidden;
    $(btnId).setAttribute('aria-expanded', String(!p.hidden));
  }

  // ---------- Wire up ----------
  function init() {
    $('ob-next').addEventListener('click', function () {
      setStore('route', $('ob-route').value || '');
      setObStep(2);
    });
    $('ob-back').addEventListener('click', function () { setObStep(1); });
    $('ob-start').addEventListener('click', function () { setStore('onboarded', '1'); showHome(); });

    $('btn-check-traffic').addEventListener('click', function () {
      toggle('btn-check-traffic', 'panel-traffic');
      var r = getStore('route');
      if (!$('dest').value && r) $('dest').value = r.split(',')[0].trim();
    });
    $('btn-check-power').addEventListener('click', function () {
      toggle('btn-check-power', 'panel-power');
      if (!$('area-input').value && homeArea) $('area-input').value = homeArea;
    });
    $('go-traffic').addEventListener('click', function () {
      var dest = $('dest').value.trim();
      showLines($('traffic-result'), trafficLines(dest));
      if (dest) {
        var a = document.createElement('a');
        a.className = 'gmaps-link';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.href = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' +
          encodeURIComponent(dest + ', Lagos, Nigeria');
        a.textContent = 'See live traffic on Google Maps';
        $('traffic-result').appendChild(a);
      }
    });
    $('go-power').addEventListener('click', function () {
      selectPowerChip('');
      showPower($('area-input').value);
    });
    $('dest').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('go-traffic').click(); });
    $('area-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('go-power').click(); });

    $('btn-report').addEventListener('click', openSheet);
    $('sheet-cancel').addEventListener('click', closeSheet);
    var opts = document.querySelectorAll('.opt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].addEventListener('click', function (e) { sendReport(e.currentTarget.getAttribute('data-status')); });
    }
    $('thanks-close').addEventListener('click', function () { $('thanks').hidden = true; });

    buildObChips();
    if (getStore('onboarded') === '1') {
      showHome();
    } else {
      $('onboarding').hidden = false;
      setObStep(1);
    }

    setInterval(function () { if (!$('home').hidden) fetchReports(); }, 60000);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* ignore */ });
      });
    }
  }

  init();
})();
