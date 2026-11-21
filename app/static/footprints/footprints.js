(() => {
  'use strict';

  const byId = (name) => document.getElementById(`footprints-${name}`);
  const assetPath = '/static/footprints/';

  function localAsset(path) {
    if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('Expected a local asset path');
    const url = new URL(path, location.href);
    if (url.origin !== location.origin) throw new Error('Expected a same-origin asset');
    return url.href;
  }

  async function loadJson(filename) {
    const response = await fetch(assetPath + filename, { redirect: 'error' });
    if (!response.ok) throw new Error(`Unable to load ${filename}`);
    return response.json();
  }

  function renderVisits(list, visits, includeCity) {
    list.replaceChildren(...visits.map((visit) => {
      const item = document.createElement('li');
      const date = document.createElement('time');
      date.dateTime = visit.date;
      date.textContent = visit.date;
      const body = document.createElement('div');
      if (includeCity) {
        const city = document.createElement('strong');
        city.textContent = visit.city;
        body.append(city);
      }
      const note = document.createElement('p');
      note.textContent = visit.note;
      body.append(note);
      if (visit.photo) {
        const image = document.createElement('img');
        image.src = visit.photo;
        image.alt = visit.photoAlt;
        image.loading = 'lazy';
        image.addEventListener('error', () => image.remove(), { once: true });
        body.append(image);
      }
      item.append(date, body);
      return item;
    }));
    list.hidden = visits.length === 0;
  }

  function normalizeVisits(data) {
    if (!Array.isArray(data)) throw new Error('Expected a list of visits');
    return data.filter((visit) => visit && typeof visit.cityId === 'string' &&
      typeof visit.city === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(visit.date) &&
      typeof visit.note === 'string').map((visit) => {
      let photo = null;
      if (visit.photo && typeof visit.photo.alt === 'string') {
        try { photo = localAsset(visit.photo.src); } catch { /* The visit is still readable. */ }
      }
      return { ...visit, photo, photoAlt: visit.photo?.alt };
    }).sort((left, right) => right.date.localeCompare(left.date));
  }

  async function mountMap(config, visits) {
    const L = window.L;
    const { image, provinces, cities } = config;
    const imageUrl = localAsset(image.src);
    if (!L || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
        image.width <= 0 || image.height <= 0) throw new Error('Invalid map configuration');

    // Use image-relative coordinates with the original aspect ratio and a top-left data origin.
    const width = 1000;
    const height = width * image.height / image.width;
    function point([x, y]) {
      if (![x, y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
        throw new Error('Image coordinates must be normalized');
      }
      return [height * (1 - y), width * x];
    }
    const whole = L.latLngBounds(point([0, 1]), point([1, 0]));
    const area = byId('map');
    const viewport = byId('view');
    const select = byId('province');
    const detail = byId('detail');
    const heading = byId('city');
    const padding = L.point(10, 10);
    byId('notice').textContent = config.notice || '';
    byId('notice').hidden = !config.notice;
    viewport.hidden = false;
    const map = L.map(area, {
      crs: L.CRS.Simple,
      minZoom: -6,
      maxZoom: 5,
      zoomSnap: 0,
      zoomDelta: 0.55,
      zoomAnimation: false,
      scrollWheelZoom: false,
      zoomControl: false,
      attributionControl: false,
      maxBounds: whole.pad(0.4),
    });

    try {
      map.fitBounds(whole, { padding, animate: false });
      const overlay = L.imageOverlay(imageUrl, whole, { alt: image.alt || '中国地图' });
      await new Promise((resolve, reject) => {
        overlay.once('load', resolve);
        overlay.once('error', reject);
        overlay.addTo(map);
      });
      const bitmap = overlay.getElement();
      if (bitmap.naturalWidth !== image.width || bitmap.naturalHeight !== image.height) {
        throw new Error('The image dimensions differ from the calibration');
      }

      const regions = new Map();
      const markers = new Map();
      let selectedRegion = '';
      let selectedMarker;

      function showCity(city, records, marker) {
        selectedMarker?.getElement()?.setAttribute('aria-pressed', 'false');
        selectedMarker = marker;
        marker.getElement().setAttribute('aria-pressed', 'true');
        heading.textContent = city.name;
        renderVisits(byId('city-visits'), records, false);
        detail.hidden = false;
        heading.focus({ preventScroll: true });
        detail.scrollIntoView({ block: 'nearest' });
      }

      function fitView() {
        // The full view is also the zoom-out limit, with a small margin for manual exploration.
        const available = map.getSize().subtract(padding.multiplyBy(2));
        const overviewScale = Math.min(available.x / width, available.y / height);
        if (!(overviewScale > 0)) return;
        map.setMinZoom(Math.log2(overviewScale) - 0.5);
        const bounds = regions.get(selectedRegion)?.getBounds() || whole;
        map.fitBounds(bounds, { padding, maxZoom: 3.6, animate: false });
      }

      function chooseRegion(id) {
        regions.get(selectedRegion)?.setStyle({ fillOpacity: 0 });
        selectedRegion = id;
        select.value = id;
        // The image supplies the boundary lines. The polygon only shades the interaction area.
        regions.get(id)?.setStyle({ fillOpacity: 0.11 });
        selectedMarker?.getElement()?.setAttribute('aria-pressed', 'false');
        selectedMarker = undefined;
        detail.hidden = true;
        for (const { marker, province } of markers.values()) {
          if (!id || province === id) marker.addTo(map);
          else marker.remove();
        }
        fitView();
      }

      for (const { id, name, polygons } of provinces) {
        const rings = polygons.map((polygon) => [polygon.map(point)]);
        const layer = L.polygon(rings, {
          color: '#526654', stroke: false, fillOpacity: 0, fill: true,
          bubblingMouseEvents: false,
        }).addTo(map);
        layer.getElement().dataset.province = id;
        layer.on('mouseover', () => {
          if (id !== selectedRegion) layer.setStyle({ fillOpacity: 0.17 });
        });
        layer.on('mouseout', () => {
          if (id !== selectedRegion) layer.setStyle({ fillOpacity: 0 });
        });
        layer.on('click', () => chooseRegion(id));
        regions.set(id, layer);
        select.add(new Option(name, id));
      }

      const visitsByCity = new Map();
      for (const visit of visits) {
        if (!visitsByCity.has(visit.cityId)) visitsByCity.set(visit.cityId, []);
        visitsByCity.get(visit.cityId).push(visit);
      }
      const icon = L.divIcon({ className: 'footprints-marker', html: '<span aria-hidden="true"></span>', iconSize: [40, 40] });
      for (const city of cities) {
        const records = visitsByCity.get(city.id);
        if (!records || markers.has(city.id)) continue;
        const marker = L.marker(point(city.point), { icon });
        const tooltip = document.createElement('span');
        tooltip.textContent = city.name;
        marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -10], className: 'footprints-tooltip' });
        marker.on('add', () => {
          const element = marker.getElement();
          element.setAttribute('aria-label', `${city.name}，${records.length} 次到访`);
          element.setAttribute('aria-pressed', 'false');
          element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              showCity(city, records, marker);
            }
          });
        });
        marker.on('click', () => showCity(city, records, marker));
        markers.set(city.id, { marker, province: city.province });
      }

      select.addEventListener('change', () => chooseRegion(select.value));
      byId('reset').addEventListener('click', () => chooseRegion(''));
      byId('zoom-in').addEventListener('click', () => map.zoomIn());
      byId('zoom-out').addEventListener('click', () => map.zoomOut());
      area.addEventListener('focusin', () => map.scrollWheelZoom.enable());
      area.addEventListener('focusout', (event) => {
        if (!area.contains(event.relatedTarget)) map.scrollWheelZoom.disable();
      });
      byId('source').textContent = [image.source, image.review].filter(Boolean).join(' · ');
      byId('toolbar').hidden = false;
      byId('caption').hidden = false;
      byId('status').hidden = true;
      area.inert = false;
      map.invalidateSize({ pan: false });
      chooseRegion('');
      map.on('resize', fitView);
    } catch (error) {
      map.remove();
      throw error;
    }
  }

  async function start() {
    const configRequest = loadJson('map.json').catch(() => undefined);
    let visits = [];
    try {
      visits = normalizeVisits(await loadJson('visits.json'));
      renderVisits(byId('visits'), visits, true);
      byId('empty').hidden = visits.length > 0;
    } catch {
      byId('empty').textContent = '足迹记录暂时无法读取。';
    }

    const status = byId('status');
    try {
      const config = await configRequest;
      if (config === null) {
        status.textContent = '地图尚未开放，可浏览下方的足迹时间线。';
        return;
      }
      status.textContent = '正在加载足迹地图…';
      await mountMap(config, visits);
    } catch {
      byId('view').hidden = true;
      status.hidden = false;
      status.textContent = '底图未能加载，仍可浏览下方的足迹时间线。';
    }
  }

  start();
})();
