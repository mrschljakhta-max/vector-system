(() => {
  'use strict';

  const q = (s) => document.querySelector(s);
  const VA = window.VectorAnalytics;
  if (!VA) return;

  const modal = q('#exportModal');
  const fromInput = q('#exportFrom');
  const toInput = q('#exportTo');
  const progress = q('#exportProgress');
  const buildButton = q('#buildExport');
  const openButton = q('#exportExcel');
  const one = VA.helpers.one;
  const geo = VA.helpers.geo;
  const km = VA.helpers.km;

  const COLORS = {
    navy: 'FF1F2937', dark: 'FF111827', orange: 'FFD78219', paleOrange: 'FFFCE7C2', blue: 'FF4AA3FF', green: 'FF63D471', red: 'FFEF4444', gray: 'FF6B7280', light: 'FFF3F4F6', white: 'FFFFFFFF', border: 'FFD1D5DB'
  };

  function setProgress(text, type = '') {
    progress.textContent = text;
    progress.className = `export-progress${type ? ` ${type}` : ''}`;
  }

  function dateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.year}-${map.month}-${map.day}`;
  }

  function dateTimeParts(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(date);
    return Object.fromEntries(parts.map((p) => [p.type, p.value]));
  }

  function latestValidEventDate() {
    const maxAllowed = Date.now() + 86400000;
    const valid = VA.state.events.map((event) => event.event_at ? new Date(event.event_at) : null).filter((date) => date && !Number.isNaN(date.getTime()) && date.getTime() <= maxAllowed).sort((a, b) => b - a);
    return valid[0] || new Date();
  }

  function setPreset(days) {
    if (days === 'all') {
      const dates = VA.state.events.map((event) => event.event_at ? new Date(event.event_at) : null).filter((date) => date && !Number.isNaN(date.getTime())).sort((a, b) => a - b);
      fromInput.value = dates.length ? dateKey(dates[0]) : '';
      toInput.value = dates.length ? dateKey(dates[dates.length - 1]) : dateKey(new Date());
      return;
    }
    const to = latestValidEventDate();
    const from = new Date(to.getTime() - (Number(days) - 1) * 86400000);
    fromInput.value = dateKey(from);
    toInput.value = dateKey(to);
  }

  async function openModal() {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setProgress('Завантажую доступний діапазон дат...');
    try {
      await VA.ready;
      setPreset(30);
      setProgress('Оберіть період і натисніть «Сформувати XLSX».');
    } catch (error) {
      setProgress(error.message || String(error), 'error');
    }
  }

  function closeModal() {
    if (buildButton.disabled) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function filterEvents(from, to) {
    return VA.state.events.filter((event) => {
      if (!event.event_at) return false;
      const key = dateKey(new Date(event.event_at));
      return key && key >= from && key <= to;
    });
  }

  function mapCount(rows, keyFn) {
    const map = new Map();
    rows.forEach((row) => {
      const key = keyFn(row) || 'Не визначено';
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function aggregateEvents(events) {
    const byType = new Map();
    const byStation = new Map();
    const bySettlement = new Map();
    const byDay = new Map();
    const byHour = Array.from({ length: 24 }, () => ({ events: 0, detected: 0, suppressed: 0, cover: 0 }));
    const byDowHour = Array.from({ length: 7 }, () => Array(24).fill(0));
    const azimuthSectors = Array.from({ length: 12 }, (_, index) => ({ label: `${index * 30}–${index * 30 + 29}°`, events: 0 }));

    events.forEach((event) => {
      const uav = one(event.uav)?.uav_name || 'Не визначено';
      const station = one(event.station)?.station_name || 'Не визначено';
      const settlement = one(event.settlement)?.name || 'Не визначено';
      const typeItem = byType.get(uav) || { name: uav, category: one(event.uav)?.uav_category || '', side: one(event.uav)?.side || '', events: 0, detected: 0, suppressed: 0, cover: 0, stations: new Set(), settlements: new Set() };
      typeItem.events += 1;
      typeItem.detected += event.is_detected ? 1 : 0;
      typeItem.suppressed += event.is_suppressed ? 1 : 0;
      typeItem.cover += event.is_cover ? 1 : 0;
      if (event.station_id) typeItem.stations.add(event.station_id);
      if (event.settlement_id) typeItem.settlements.add(event.settlement_id);
      byType.set(uav, typeItem);

      const stationItem = byStation.get(station) || { name: station, code: one(event.station)?.station_code || '', events: 0, detected: 0, suppressed: 0, cover: 0, types: new Set(), settlements: new Set() };
      stationItem.events += 1;
      stationItem.detected += event.is_detected ? 1 : 0;
      stationItem.suppressed += event.is_suppressed ? 1 : 0;
      stationItem.cover += event.is_cover ? 1 : 0;
      if (event.uav_type_id) stationItem.types.add(event.uav_type_id);
      if (event.settlement_id) stationItem.settlements.add(event.settlement_id);
      byStation.set(station, stationItem);

      const settlementItem = bySettlement.get(settlement) || { name: settlement, district: one(event.settlement)?.district || '', region: one(event.settlement)?.region || '', hromada: one(event.settlement)?.hromada_name || '', lat: one(event.settlement)?.lat ?? null, lon: one(event.settlement)?.lon ?? null, mgrs: one(event.settlement)?.mgrs || '', events: 0, detected: 0, suppressed: 0, cover: 0, types: new Set(), stations: new Set() };
      settlementItem.events += 1;
      settlementItem.detected += event.is_detected ? 1 : 0;
      settlementItem.suppressed += event.is_suppressed ? 1 : 0;
      settlementItem.cover += event.is_cover ? 1 : 0;
      if (event.uav_type_id) settlementItem.types.add(event.uav_type_id);
      if (event.station_id) settlementItem.stations.add(event.station_id);
      bySettlement.set(settlement, settlementItem);

      const parts = dateTimeParts(event.event_at);
      if (parts) {
        const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
        const dayItem = byDay.get(dayKey) || { date: dayKey, events: 0, detected: 0, suppressed: 0, cover: 0 };
        dayItem.events += 1;
        dayItem.detected += event.is_detected ? 1 : 0;
        dayItem.suppressed += event.is_suppressed ? 1 : 0;
        dayItem.cover += event.is_cover ? 1 : 0;
        byDay.set(dayKey, dayItem);
        const hour = Number(parts.hour);
        byHour[hour].events += 1;
        byHour[hour].detected += event.is_detected ? 1 : 0;
        byHour[hour].suppressed += event.is_suppressed ? 1 : 0;
        byHour[hour].cover += event.is_cover ? 1 : 0;
        const weekday = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'].findIndex((x) => String(parts.weekday || '').toLowerCase().startsWith(x));
        if (weekday >= 0) byDowHour[weekday][hour] += 1;
      }

      if (event.azimuth != null && Number.isFinite(Number(event.azimuth))) {
        const normalized = ((Number(event.azimuth) % 360) + 360) % 360;
        azimuthSectors[Math.floor(normalized / 30)].events += 1;
      }
    });

    return {
      byType: [...byType.values()].sort((a, b) => b.events - a.events),
      byStation: [...byStation.values()].sort((a, b) => b.events - a.events),
      bySettlement: [...bySettlement.values()].sort((a, b) => b.events - a.events),
      byDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      byHour: byHour.map((item, hour) => ({ hour: `${String(hour).padStart(2, '0')}:00`, ...item })),
      byDowHour,
      azimuthSectors
    };
  }

  function calculateCoverage(cover, stations) {
    const activeStations = stations.filter((station) => station.is_active !== false && geo(station));
    return cover.map((object) => {
      const hits = geo(object) ? activeStations.map((station) => ({ station, distance: km(object, station), radius: Number(station.coverage_radius_km) || 15 })).filter((item) => item.distance <= item.radius).sort((a, b) => a.distance - b.distance) : [];
      const nearest = geo(object) ? activeStations.map((station) => ({ station, distance: km(object, station) })).sort((a, b) => a.distance - b.distance)[0] : null;
      return { ...object, hits, nearest, covered: hits.length > 0 };
    });
  }

  function formatBool(value) { return value ? 'Так' : 'Ні'; }
  function formatPercent(a, b) { return b ? Number(((a / b) * 100).toFixed(1)) : 0; }
  function safeSheetName(name) { return name.replace(/[\\/*?:\[\]]/g, ' ').slice(0, 31); }

  function styleTitle(ws, lastColumn, title, subtitle) {
    ws.mergeCells(1, 1, 1, lastColumn);
    ws.getCell(1, 1).value = title;
    ws.getCell(1, 1).font = { name: 'Arial', size: 18, bold: true, color: { argb: COLORS.white } };
    ws.getCell(1, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dark } };
    ws.getCell(1, 1).alignment = { vertical: 'middle', horizontal: 'left' };
    ws.getRow(1).height = 32;
    ws.mergeCells(2, 1, 2, lastColumn);
    ws.getCell(2, 1).value = subtitle;
    ws.getCell(2, 1).font = { name: 'Arial', size: 10, italic: true, color: { argb: COLORS.gray } };
    ws.getRow(2).height = 22;
  }

  function addDataSheet(workbook, name, title, subtitle, columns, rows) {
    const ws = workbook.addWorksheet(safeSheetName(name), { views: [{ state: 'frozen', ySplit: 4 }] });
    styleTitle(ws, columns.length, title, subtitle);
    columns.forEach((column, index) => {
      const cell = ws.getCell(4, index + 1);
      cell.value = column.header;
      cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: COLORS.white } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = { bottom: { style: 'thin', color: { argb: COLORS.orange } } };
      ws.getColumn(index + 1).width = column.width || 16;
    });
    ws.getRow(4).height = 32;
    rows.forEach((row, rowIndex) => {
      const excelRow = ws.getRow(rowIndex + 5);
      columns.forEach((column, colIndex) => {
        const cell = excelRow.getCell(colIndex + 1);
        cell.value = row[column.key] ?? null;
        cell.font = { name: 'Arial', size: 9 };
        cell.alignment = { vertical: 'top', wrapText: Boolean(column.wrap) };
        if (column.numFmt) cell.numFmt = column.numFmt;
      });
      if ((rowIndex + 1) % 2 === 0) excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
    });
    if (rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: columns.length } };
    return ws;
  }

  function addMetric(ws, row, col, label, value, note = '') {
    ws.mergeCells(row, col, row, col + 1);
    ws.getCell(row, col).value = label;
    ws.getCell(row, col).font = { name: 'Arial', size: 9, bold: true, color: { argb: COLORS.gray } };
    ws.mergeCells(row + 1, col, row + 2, col + 1);
    ws.getCell(row + 1, col).value = value;
    ws.getCell(row + 1, col).font = { name: 'Arial', size: 22, bold: true, color: { argb: COLORS.dark } };
    ws.getCell(row + 1, col).alignment = { vertical: 'middle', horizontal: 'left' };
    ws.mergeCells(row + 3, col, row + 3, col + 1);
    ws.getCell(row + 3, col).value = note;
    ws.getCell(row + 3, col).font = { name: 'Arial', size: 8, color: { argb: COLORS.gray } };
    for (let r = row; r <= row + 3; r += 1) {
      for (let c = col; c <= col + 1; c += 1) {
        ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.light } };
        ws.getCell(r, c).border = { top: { style: 'thin', color: { argb: COLORS.border } }, left: { style: 'thin', color: { argb: COLORS.border } }, right: { style: 'thin', color: { argb: COLORS.border } }, bottom: { style: 'thin', color: { argb: COLORS.border } } };
      }
    }
  }

  async function chartImage(config, width = 1120, height = 600) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.position = 'fixed';
    canvas.style.left = '-20000px';
    canvas.style.top = '0';
    document.body.appendChild(canvas);
    const backgroundPlugin = { id: 'whiteBackground', beforeDraw(chart) { const ctx = chart.ctx; ctx.save(); ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, chart.width, chart.height); ctx.restore(); } };
    const chart = new Chart(canvas.getContext('2d'), {
      ...config,
      plugins: [...(config.plugins || []), backgroundPlugin],
      options: {
        responsive: false,
        animation: false,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#374151', font: { family: 'Arial', size: 12 } } }, title: { display: true, color: '#111827', font: { family: 'Arial', size: 18, weight: 'bold' } }, ...(config.options?.plugins || {}) },
        scales: config.type === 'doughnut' || config.type === 'polarArea' ? {} : { x: { ticks: { color: '#4B5563', font: { family: 'Arial' } }, grid: { color: '#E5E7EB' } }, y: { beginAtZero: true, ticks: { color: '#4B5563', precision: 0, font: { family: 'Arial' } }, grid: { color: '#E5E7EB' } }, ...(config.options?.scales || {}) },
        ...config.options
      }
    });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const image = canvas.toDataURL('image/png');
    chart.destroy();
    canvas.remove();
    return image;
  }

  function addImage(workbook, ws, dataUrl, col, row, width = 580, height = 310) {
    const imageId = workbook.addImage({ base64: dataUrl, extension: 'png' });
    ws.addImage(imageId, { tl: { col, row }, ext: { width, height } });
  }

  async function supplementalData() {
    const [uavDirectory, routes, points] = await Promise.all([
      VA.rows('dict_uav', 'id,uav_code,uav_name,uav_category,side,control_freq_from_mhz,control_freq_to_mhz,video_freq_from_mhz,video_freq_to_mhz,telemetry_freq_from_mhz,telemetry_freq_to_mhz,nav_freq_from_mhz,nav_freq_to_mhz,note,is_active,created_at,updated_at', 3000),
      VA.rows('dict_routes', 'id,route_code,route_name,route_purpose,route_status,is_active,note,created_at,updated_at,from_settlement:dict_settlements!dict_routes_from_settlement_id_fkey(id,name,district,region,hromada_name,lat,lon,mgrs),to_settlement:dict_settlements!dict_routes_to_settlement_id_fkey(id,name,district,region,hromada_name,lat,lon,mgrs)', 3000),
      VA.rows('dict_map_points', 'id,point_code,point_name,point_type,lat,lon,mgrs,note,is_active,created_at,updated_at,settlement:dict_settlements!dict_map_points_settlement_id_fkey(id,name,district,region,hromada_name)', 3000)
    ]);
    return { uavDirectory, routes, points };
  }

  async function buildWorkbook(from, to) {
    const events = filterEvents(from, to);
    const { uavDirectory, routes, points } = await supplementalData();
    const aggregates = aggregateEvents(events);
    const coverageRows = calculateCoverage(VA.state.cover, VA.state.stations);
    const activeCoverageRows = coverageRows.filter((row) => row.is_active !== false);
    const coveredCount = activeCoverageRows.filter((row) => row.covered).length;
    const uncoveredCount = activeCoverageRows.filter((row) => geo(row) && !row.covered).length;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'VECTOR Analytics';
    workbook.lastModifiedBy = 'VECTOR Analytics';
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.properties.date1904 = false;

    const periodText = `${from} — ${to}`;
    const generatedText = `Сформовано ${new Date().toLocaleString('uk-UA')} · часовий пояс Europe/Kyiv`;

    const summary = workbook.addWorksheet('Зведення', { views: [{ state: 'frozen', ySplit: 4 }] });
    summary.columns = Array.from({ length: 12 }, () => ({ width: 14 }));
    summary.mergeCells('A1:L2');
    summary.getCell('A1').value = 'VECTOR — АНАЛІТИЧНИЙ ЗВІТ';
    summary.getCell('A1').font = { name: 'Arial', size: 24, bold: true, color: { argb: COLORS.white } };
    summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.dark } };
    summary.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
    summary.getRow(1).height = 30;
    summary.getRow(2).height = 20;
    summary.mergeCells('A3:L3');
    summary.getCell('A3').value = `Період подій БпЛА: ${periodText}. Станції, ВП/СП, маршрути та пункти наведені станом на дату формування. ${generatedText}.`;
    summary.getCell('A3').font = { name: 'Arial', size: 10, italic: true, color: { argb: COLORS.gray } };

    const detected = events.filter((event) => event.is_detected).length;
    const suppressed = events.filter((event) => event.is_suppressed).length;
    const coverEvents = events.filter((event) => event.is_cover).length;
    const geoEvents = events.filter((event) => event.settlement_id).length;
    const activeStations = VA.state.stations.filter((station) => station.is_active !== false).length;
    const stationsInPeriod = new Set(events.map((event) => event.station_id).filter(Boolean)).size;
    const uniqueTypes = new Set(events.map((event) => event.uav_type_id).filter(Boolean)).size;
    const uniqueSettlements = new Set(events.map((event) => event.settlement_id).filter(Boolean)).size;

    addMetric(summary, 5, 1, 'Події БпЛА', events.length, `період ${periodText}`);
    addMetric(summary, 5, 4, 'Виявлено', detected, `${formatPercent(detected, events.length)}% від подій`);
    addMetric(summary, 5, 7, 'Подавлено', suppressed, `${formatPercent(suppressed, events.length)}% від подій`);
    addMetric(summary, 5, 10, 'Прикриття', coverEvents, `${formatPercent(coverEvents, events.length)}% від подій`);
    addMetric(summary, 10, 1, 'Типи БпЛА', uniqueTypes, 'визначені типи у періоді');
    addMetric(summary, 10, 4, 'Станції в роботі', stationsInPeriod, `активних у довіднику: ${activeStations}`);
    addMetric(summary, 10, 7, 'Населені пункти', uniqueSettlements, `${formatPercent(geoEvents, events.length)}% подій із прив’язкою`);
    addMetric(summary, 10, 10, 'Покрито ВП/СП', coveredCount, `неприкрито: ${uncoveredCount}`);

    setProgress('Будую діаграми для Excel...');
    const topTypes = aggregates.byType.slice(0, 12);
    const topStations = aggregates.byStation.slice(0, 12);
    const topSettlements = aggregates.bySettlement.slice(0, 12);
    const dailyChart = await chartImage({ type: 'line', data: { labels: aggregates.byDay.map((x) => x.date), datasets: [{ label: 'Події', data: aggregates.byDay.map((x) => x.events), borderColor: '#D78219', backgroundColor: 'rgba(215,130,25,.18)', fill: true, tension: .25 }, { label: 'Виявлено', data: aggregates.byDay.map((x) => x.detected), borderColor: '#4AA3FF', tension: .25 }, { label: 'Подавлено', data: aggregates.byDay.map((x) => x.suppressed), borderColor: '#63D471', tension: .25 }] }, options: { plugins: { title: { text: 'Динаміка подій БпЛА' } }, scales: { x: { ticks: { maxTicksLimit: 20 } } } } });
    const typeChart = await chartImage({ type: 'bar', data: { labels: topTypes.map((x) => x.name), datasets: [{ label: 'Події', data: topTypes.map((x) => x.events), backgroundColor: '#D78219' }] }, options: { indexAxis: 'y', plugins: { title: { text: 'Типи БпЛА' } } } });
    const stationChart = await chartImage({ type: 'bar', data: { labels: topStations.map((x) => x.name), datasets: [{ label: 'Події', data: topStations.map((x) => x.events), backgroundColor: '#6B7280' }, { label: 'Виявлено', data: topStations.map((x) => x.detected), backgroundColor: '#4AA3FF' }, { label: 'Подавлено', data: topStations.map((x) => x.suppressed), backgroundColor: '#63D471' }] }, options: { indexAxis: 'y', plugins: { title: { text: 'Робота станцій' } } } });
    const resultChart = await chartImage({ type: 'doughnut', data: { labels: ['Виявлено і подавлено', 'Подавлено без виявлення', 'Виявлено без подавлення', 'Прикриття', 'Інше'], datasets: [{ data: [events.filter((e) => e.is_detected && e.is_suppressed).length, events.filter((e) => !e.is_detected && e.is_suppressed).length, events.filter((e) => e.is_detected && !e.is_suppressed).length, events.filter((e) => e.is_cover).length, events.filter((e) => !e.is_detected && !e.is_suppressed && !e.is_cover).length], backgroundColor: ['#63D471', '#D78219', '#4AA3FF', '#8B5CF6', '#6B7280'] }] }, options: { plugins: { title: { text: 'Структура результатів подій' }, legend: { position: 'right' } } } });
    const settlementChart = await chartImage({ type: 'bar', data: { labels: topSettlements.map((x) => x.name), datasets: [{ label: 'Події', data: topSettlements.map((x) => x.events), backgroundColor: '#4AA3FF' }] }, options: { indexAxis: 'y', plugins: { title: { text: 'Найактивніші населені пункти' } } } });
    const azimuthChart = await chartImage({ type: 'polarArea', data: { labels: aggregates.azimuthSectors.map((x) => x.label), datasets: [{ label: 'Події', data: aggregates.azimuthSectors.map((x) => x.events), backgroundColor: ['#D78219','#4AA3FF','#63D471','#8B5CF6','#EF4444','#F59E0B','#14B8A6','#6366F1','#EC4899','#84CC16','#06B6D4','#64748B'] }] }, options: { plugins: { title: { text: 'Розподіл подій за азимутами' }, legend: { position: 'right' } } } });
    const coverageChart = await chartImage({ type: 'doughnut', data: { labels: ['Покрито', 'Неприкрито', 'Без координат'], datasets: [{ data: [coveredCount, uncoveredCount, activeCoverageRows.filter((row) => !geo(row)).length], backgroundColor: ['#63D471', '#EF4444', '#6B7280'] }] }, options: { plugins: { title: { text: 'Покриття ВП/СП активними станціями' }, legend: { position: 'right' } } } });
    const pointTypes = mapCount(points, (point) => point.point_type).slice(0, 12);
    const pointChart = await chartImage({ type: 'bar', data: { labels: pointTypes.map((x) => x[0]), datasets: [{ label: 'Пункти', data: pointTypes.map((x) => x[1]), backgroundColor: '#8B5CF6' }] }, options: { plugins: { title: { text: 'Пункти за типами' } } } });

    addImage(workbook, summary, dailyChart, 0, 15);
    addImage(workbook, summary, typeChart, 6, 15);
    addImage(workbook, summary, stationChart, 0, 32);
    addImage(workbook, summary, resultChart, 6, 32);
    addImage(workbook, summary, settlementChart, 0, 49);
    addImage(workbook, summary, azimuthChart, 6, 49);
    addImage(workbook, summary, coverageChart, 0, 66);
    addImage(workbook, summary, pointChart, 6, 66);
    for (let row = 15; row <= 83; row += 1) summary.getRow(row).height = 15;

    setProgress('Додаю повні таблиці даних...');
    const eventRows = events.slice().sort((a, b) => new Date(a.event_at) - new Date(b.event_at)).map((event, index) => ({
      no: index + 1,
      eventAt: event.event_at ? new Date(event.event_at) : null,
      date: dateTimeParts(event.event_at) ? `${dateTimeParts(event.event_at).day}.${dateTimeParts(event.event_at).month}.${dateTimeParts(event.event_at).year}` : '',
      time: dateTimeParts(event.event_at) ? `${dateTimeParts(event.event_at).hour}:${dateTimeParts(event.event_at).minute}` : '',
      uav: one(event.uav)?.uav_name || '', category: one(event.uav)?.uav_category || '', side: one(event.uav)?.side || '',
      station: one(event.station)?.station_name || '', stationCode: one(event.station)?.station_code || '',
      settlement: one(event.settlement)?.name || '', district: one(event.settlement)?.district || '', region: one(event.settlement)?.region || '', hromada: one(event.settlement)?.hromada_name || '', lat: Number(one(event.settlement)?.lat) || null, lon: Number(one(event.settlement)?.lon) || null, mgrs: one(event.settlement)?.mgrs || '',
      azimuth: event.azimuth ?? null, detected: formatBool(event.is_detected), suppressed: formatBool(event.is_suppressed), cover: formatBool(event.is_cover), result: event.result_normalized || '', resultRaw: event.result_raw || '', verified: formatBool(event.is_verified), verifiedBy: event.verified_by || '', verifiedAt: event.verified_at ? new Date(event.verified_at) : null,
      id: event.id, rawId: event.raw_id, batchId: event.batch_id, uavTypeId: event.uav_type_id, uavId: event.uav_id, stationId: event.station_id, settlementId: event.settlement_id, createdAt: event.created_at ? new Date(event.created_at) : null
    }));
    addDataSheet(workbook, 'БпЛА — події', 'ПОВНИЙ ПЕРЕЛІК ПОДІЙ БПЛА', `Період ${periodText}. Усього рядків: ${eventRows.length}.`, [
      { header: '№', key: 'no', width: 7 }, { header: 'Дата й час', key: 'eventAt', width: 20, numFmt: 'dd.mm.yyyy hh:mm' }, { header: 'Дата', key: 'date', width: 12 }, { header: 'Час', key: 'time', width: 9 },
      { header: 'Тип БпЛА', key: 'uav', width: 22 }, { header: 'Категорія', key: 'category', width: 22 }, { header: 'Сторона', key: 'side', width: 13 },
      { header: 'Станція', key: 'station', width: 20 }, { header: 'Код станції', key: 'stationCode', width: 15 }, { header: 'Населений пункт', key: 'settlement', width: 22 }, { header: 'Район', key: 'district', width: 18 }, { header: 'Область', key: 'region', width: 18 }, { header: 'Громада', key: 'hromada', width: 20 },
      { header: 'Широта', key: 'lat', width: 12, numFmt: '0.000000' }, { header: 'Довгота', key: 'lon', width: 12, numFmt: '0.000000' }, { header: 'MGRS', key: 'mgrs', width: 18 }, { header: 'Азимут', key: 'azimuth', width: 10 },
      { header: 'Виявлено', key: 'detected', width: 11 }, { header: 'Подавлено', key: 'suppressed', width: 11 }, { header: 'Прикриття', key: 'cover', width: 11 }, { header: 'Результат', key: 'result', width: 24, wrap: true }, { header: 'Результат (джерело)', key: 'resultRaw', width: 28, wrap: true },
      { header: 'Верифіковано', key: 'verified', width: 13 }, { header: 'Верифікував', key: 'verifiedBy', width: 18 }, { header: 'Час верифікації', key: 'verifiedAt', width: 20, numFmt: 'dd.mm.yyyy hh:mm' },
      { header: 'ID події', key: 'id', width: 38 }, { header: 'Raw ID', key: 'rawId', width: 38 }, { header: 'Batch ID', key: 'batchId', width: 38 }, { header: 'UAV type ID', key: 'uavTypeId', width: 38 }, { header: 'UAV ID', key: 'uavId', width: 38 }, { header: 'Station ID', key: 'stationId', width: 38 }, { header: 'Settlement ID', key: 'settlementId', width: 38 }, { header: 'Створено', key: 'createdAt', width: 20, numFmt: 'dd.mm.yyyy hh:mm' }
    ], eventRows);

    const typeRows = aggregates.byType.map((item, index) => ({ no: index + 1, type: item.name, category: item.category, side: item.side, events: item.events, share: formatPercent(item.events, events.length), detected: item.detected, detectedShare: formatPercent(item.detected, item.events), suppressed: item.suppressed, suppressedShare: formatPercent(item.suppressed, item.events), cover: item.cover, stations: item.stations.size, settlements: item.settlements.size }));
    const typeWs = addDataSheet(workbook, 'БпЛА — типи', 'АНАЛІТИКА ЗА ТИПАМИ БПЛА', `Період ${periodText}.`, [
      { header: '№', key: 'no', width: 7 }, { header: 'Тип БпЛА', key: 'type', width: 24 }, { header: 'Категорія', key: 'category', width: 22 }, { header: 'Сторона', key: 'side', width: 14 }, { header: 'Події', key: 'events', width: 12 }, { header: 'Частка, %', key: 'share', width: 13, numFmt: '0.0' }, { header: 'Виявлено', key: 'detected', width: 12 }, { header: 'Виявлено, %', key: 'detectedShare', width: 14, numFmt: '0.0' }, { header: 'Подавлено', key: 'suppressed', width: 12 }, { header: 'Подавлено, %', key: 'suppressedShare', width: 14, numFmt: '0.0' }, { header: 'Прикриття', key: 'cover', width: 12 }, { header: 'Станцій', key: 'stations', width: 11 }, { header: 'Населених пунктів', key: 'settlements', width: 19 }
    ], typeRows);
    addImage(workbook, typeWs, typeChart, 14, 3, 620, 340);

    const dayWs = addDataSheet(workbook, 'БпЛА — динаміка', 'ДИНАМІКА ПОДІЙ БПЛА', `Період ${periodText}.`, [
      { header: 'Дата', key: 'date', width: 15 }, { header: 'Події', key: 'events', width: 12 }, { header: 'Виявлено', key: 'detected', width: 12 }, { header: 'Подавлено', key: 'suppressed', width: 12 }, { header: 'Прикриття', key: 'cover', width: 12 }
    ], aggregates.byDay);
    addImage(workbook, dayWs, dailyChart, 6, 3, 720, 390);

    const hourWs = addDataSheet(workbook, 'БпЛА — час', 'АКТИВНІСТЬ ЗА ГОДИНАМИ ТА ДНЯМИ ТИЖНЯ', `Період ${periodText}. Часовий пояс Europe/Kyiv.`, [
      { header: 'Година', key: 'hour', width: 12 }, { header: 'Події', key: 'events', width: 12 }, { header: 'Виявлено', key: 'detected', width: 12 }, { header: 'Подавлено', key: 'suppressed', width: 12 }, { header: 'Прикриття', key: 'cover', width: 12 }
    ], aggregates.byHour);
    const weekdays = ['Понеділок','Вівторок','Середа','Четвер','П’ятниця','Субота','Неділя'];
    hourWs.getCell('G4').value = 'День / година';
    for (let hour = 0; hour < 24; hour += 1) hourWs.getCell(4, 8 + hour).value = hour;
    const maxHeat = Math.max(1, ...aggregates.byDowHour.flat());
    aggregates.byDowHour.forEach((row, dayIndex) => {
      hourWs.getCell(5 + dayIndex, 7).value = weekdays[dayIndex];
      row.forEach((value, hour) => {
        const cell = hourWs.getCell(5 + dayIndex, 8 + hour);
        cell.value = value;
        const intensity = value / maxHeat;
        const red = Math.round(255 - (255 - 215) * intensity);
        const green = Math.round(255 - (255 - 130) * intensity);
        const blue = Math.round(255 - (255 - 25) * intensity);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${red.toString(16).padStart(2,'0')}${green.toString(16).padStart(2,'0')}${blue.toString(16).padStart(2,'0')}`.toUpperCase() } };
        cell.alignment = { horizontal: 'center' };
      });
    });
    for (let col = 7; col <= 31; col += 1) hourWs.getColumn(col).width = col === 7 ? 16 : 5;

    const azWs = addDataSheet(workbook, 'БпЛА — азимути', 'РОЗПОДІЛ ПОДІЙ ЗА АЗИМУТАМИ', `Період ${periodText}.`, [{ header: 'Сектор', key: 'label', width: 18 }, { header: 'Події', key: 'events', width: 12 }], aggregates.azimuthSectors);
    addImage(workbook, azWs, azimuthChart, 4, 3, 680, 420);

    const stationStats = new Map(aggregates.byStation.map((item) => [item.name, item]));
    const stationRows = VA.state.stations.map((station, index) => {
      const stat = stationStats.get(station.station_name) || { events: 0, detected: 0, suppressed: 0, cover: 0, types: new Set(), settlements: new Set() };
      return { no: index + 1, name: station.station_name, code: station.station_code, type: one(station.station_type)?.type_name || '', category: one(station.station_type)?.category || '', unit: one(station.unit)?.short_name || one(station.unit)?.unit_name || '', settlement: one(station.settlement)?.name || '', status: station.status_text || '', active: formatBool(station.is_active !== false), radius: Number(station.coverage_radius_km) || null, lat: Number(station.lat) || null, lon: Number(station.lon) || null, mgrs: station.mgrs || '', events: stat.events, detected: stat.detected, suppressed: stat.suppressed, cover: stat.cover, detectedShare: formatPercent(stat.detected, stat.events), suppressedShare: formatPercent(stat.suppressed, stat.events), types: stat.types.size, settlements: stat.settlements.size, note: station.note || '', id: station.id };
    });
    const stationWs = addDataSheet(workbook, 'Станції', 'СТАН ТА БОЙОВА РОБОТА СТАНЦІЙ', `Показники бойової роботи за період ${periodText}; стан і координати — поточні.`, [
      { header: '№', key: 'no', width: 7 }, { header: 'Станція', key: 'name', width: 22 }, { header: 'Код', key: 'code', width: 14 }, { header: 'Тип', key: 'type', width: 20 }, { header: 'Категорія', key: 'category', width: 18 }, { header: 'Підрозділ', key: 'unit', width: 20 }, { header: 'Населений пункт', key: 'settlement', width: 20 }, { header: 'Статус', key: 'status', width: 18 }, { header: 'Активна', key: 'active', width: 10 }, { header: 'Радіус, км', key: 'radius', width: 12, numFmt: '0.0' }, { header: 'Широта', key: 'lat', width: 12, numFmt: '0.000000' }, { header: 'Довгота', key: 'lon', width: 12, numFmt: '0.000000' }, { header: 'MGRS', key: 'mgrs', width: 18 }, { header: 'Події', key: 'events', width: 10 }, { header: 'Виявлено', key: 'detected', width: 11 }, { header: 'Подавлено', key: 'suppressed', width: 11 }, { header: 'Прикриття', key: 'cover', width: 11 }, { header: 'Виявлено, %', key: 'detectedShare', width: 13, numFmt: '0.0' }, { header: 'Подавлено, %', key: 'suppressedShare', width: 13, numFmt: '0.0' }, { header: 'Типів БпЛА', key: 'types', width: 13 }, { header: 'Населених пунктів', key: 'settlements', width: 19 }, { header: 'Примітка', key: 'note', width: 28, wrap: true }, { header: 'ID', key: 'id', width: 38 }
    ], stationRows);
    addImage(workbook, stationWs, stationChart, 24, 3, 650, 380);

    const coverExportRows = coverageRows.map((object, index) => ({
      no: index + 1, code: object.object_code, name: object.object_name, type: object.object_type || object.type_code || '', unit: one(object.unit)?.short_name || one(object.unit)?.unit_name || '', settlement: one(object.settlement)?.name || '', district: one(object.settlement)?.district || '', region: one(object.settlement)?.region || '', priority: object.priority ?? null, active: formatBool(object.is_active !== false), lat: Number(object.lat) || null, lon: Number(object.lon) || null, mgrs: object.mgrs || '', coverage: !geo(object) ? 'Без координат' : object.covered ? 'Покрито' : 'Неприкрито', coveringStations: object.hits.length, stations: object.hits.map((item) => item.station.station_name).join(', '), nearestStation: object.nearest?.station?.station_name || '', nearestDistance: object.nearest ? Number(object.nearest.distance.toFixed(2)) : null, revision: object.coordinate_revision_status || '', revisionNote: object.coordinate_revision_note || '', note: object.note || '', id: object.id
    }));
    const coverWs = addDataSheet(workbook, 'ВП-СП', 'ВП/СП ТА РОЗРАХУНОК ПОКРИТТЯ', `Поточний стан на ${new Date().toLocaleString('uk-UA')}. Радіус береться з картки кожної активної станції.`, [
      { header: '№', key: 'no', width: 7 }, { header: 'Код', key: 'code', width: 14 }, { header: 'Назва', key: 'name', width: 24 }, { header: 'Тип', key: 'type', width: 14 }, { header: 'Підрозділ', key: 'unit', width: 20 }, { header: 'Населений пункт', key: 'settlement', width: 20 }, { header: 'Район', key: 'district', width: 18 }, { header: 'Область', key: 'region', width: 18 }, { header: 'Пріоритет', key: 'priority', width: 11 }, { header: 'Активний', key: 'active', width: 10 }, { header: 'Широта', key: 'lat', width: 12, numFmt: '0.000000' }, { header: 'Довгота', key: 'lon', width: 12, numFmt: '0.000000' }, { header: 'MGRS', key: 'mgrs', width: 18 }, { header: 'Покриття', key: 'coverage', width: 15 }, { header: 'Станцій покриття', key: 'coveringStations', width: 17 }, { header: 'Станції покриття', key: 'stations', width: 32, wrap: true }, { header: 'Найближча станція', key: 'nearestStation', width: 22 }, { header: 'Відстань, км', key: 'nearestDistance', width: 14, numFmt: '0.00' }, { header: 'Перевірка координат', key: 'revision', width: 18 }, { header: 'Примітка перевірки', key: 'revisionNote', width: 28, wrap: true }, { header: 'Примітка', key: 'note', width: 28, wrap: true }, { header: 'ID', key: 'id', width: 38 }
    ], coverExportRows);
    addImage(workbook, coverWs, coverageChart, 23, 3, 650, 380);

    const routeRows = routes.map((route, index) => {
      const fromSettlement = one(route.from_settlement) || {};
      const toSettlement = one(route.to_settlement) || {};
      const distance = geo(fromSettlement) && geo(toSettlement) ? km(fromSettlement, toSettlement) : null;
      return { no: index + 1, code: route.route_code, name: route.route_name || '', purpose: route.route_purpose || '', status: route.route_status || '', active: formatBool(route.is_active !== false), from: fromSettlement.name || '', fromDistrict: fromSettlement.district || '', fromRegion: fromSettlement.region || '', fromLat: Number(fromSettlement.lat) || null, fromLon: Number(fromSettlement.lon) || null, fromMgrs: fromSettlement.mgrs || '', to: toSettlement.name || '', toDistrict: toSettlement.district || '', toRegion: toSettlement.region || '', toLat: Number(toSettlement.lat) || null, toLon: Number(toSettlement.lon) || null, toMgrs: toSettlement.mgrs || '', distance: distance == null ? null : Number(distance.toFixed(2)), note: route.note || '', createdAt: route.created_at ? new Date(route.created_at) : null, updatedAt: route.updated_at ? new Date(route.updated_at) : null, id: route.id };
    });
    addDataSheet(workbook, 'Маршрути', 'МАРШРУТИ', `Поточний довідник маршрутів. Сформовано ${new Date().toLocaleString('uk-UA')}.`, [
      { header: '№', key: 'no', width: 7 }, { header: 'Код', key: 'code', width: 15 }, { header: 'Назва', key: 'name', width: 24 }, { header: 'Призначення', key: 'purpose', width: 22 }, { header: 'Статус', key: 'status', width: 14 }, { header: 'Активний', key: 'active', width: 10 }, { header: 'Звідки', key: 'from', width: 20 }, { header: 'Район звідки', key: 'fromDistrict', width: 18 }, { header: 'Область звідки', key: 'fromRegion', width: 18 }, { header: 'Широта звідки', key: 'fromLat', width: 13, numFmt: '0.000000' }, { header: 'Довгота звідки', key: 'fromLon', width: 13, numFmt: '0.000000' }, { header: 'MGRS звідки', key: 'fromMgrs', width: 18 }, { header: 'Куди', key: 'to', width: 20 }, { header: 'Район куди', key: 'toDistrict', width: 18 }, { header: 'Область куди', key: 'toRegion', width: 18 }, { header: 'Широта куди', key: 'toLat', width: 13, numFmt: '0.000000' }, { header: 'Довгота куди', key: 'toLon', width: 13, numFmt: '0.000000' }, { header: 'MGRS куди', key: 'toMgrs', width: 18 }, { header: 'Відстань по прямій, км', key: 'distance', width: 22, numFmt: '0.00' }, { header: 'Примітка', key: 'note', width: 28, wrap: true }, { header: 'Створено', key: 'createdAt', width: 20, numFmt: 'dd.mm.yyyy hh:mm' }, { header: 'Оновлено', key: 'updatedAt', width: 20, numFmt: 'dd.mm.yyyy hh:mm' }, { header: 'ID', key: 'id', width: 38 }
    ], routeRows);

    const pointRows = points.map((point, index) => ({ no: index + 1, code: point.point_code, name: point.point_name, type: point.point_type, settlement: one(point.settlement)?.name || '', district: one(point.settlement)?.district || '', region: one(point.settlement)?.region || '', hromada: one(point.settlement)?.hromada_name || '', lat: Number(point.lat) || null, lon: Number(point.lon) || null, mgrs: point.mgrs || '', active: formatBool(point.is_active !== false), note: point.note || '', createdAt: point.created_at ? new Date(point.created_at) : null, updatedAt: point.updated_at ? new Date(point.updated_at) : null, id: point.id }));
    const pointWs = addDataSheet(workbook, 'Пункти', 'ПУНКТИ', `Поточний довідник пунктів. Сформовано ${new Date().toLocaleString('uk-UA')}.`, [
      { header: '№', key: 'no', width: 7 }, { header: 'Код', key: 'code', width: 15 }, { header: 'Назва', key: 'name', width: 24 }, { header: 'Тип', key: 'type', width: 18 }, { header: 'Населений пункт', key: 'settlement', width: 20 }, { header: 'Район', key: 'district', width: 18 }, { header: 'Область', key: 'region', width: 18 }, { header: 'Громада', key: 'hromada', width: 20 }, { header: 'Широта', key: 'lat', width: 13, numFmt: '0.000000' }, { header: 'Довгота', key: 'lon', width: 13, numFmt: '0.000000' }, { header: 'MGRS', key: 'mgrs', width: 18 }, { header: 'Активний', key: 'active', width: 10 }, { header: 'Примітка', key: 'note', width: 28, wrap: true }, { header: 'Створено', key: 'createdAt', width: 20, numFmt: 'dd.mm.yyyy hh:mm' }, { header: 'Оновлено', key: 'updatedAt', width: 20, numFmt: 'dd.mm.yyyy hh:mm' }, { header: 'ID', key: 'id', width: 38 }
    ], pointRows);
    addImage(workbook, pointWs, pointChart, 17, 3, 650, 380);

    const directoryRows = uavDirectory.map((uav, index) => ({ no: index + 1, code: uav.uav_code, name: uav.uav_name, category: uav.uav_category, side: uav.side, controlFrom: Number(uav.control_freq_from_mhz) || null, controlTo: Number(uav.control_freq_to_mhz) || null, videoFrom: Number(uav.video_freq_from_mhz) || null, videoTo: Number(uav.video_freq_to_mhz) || null, telemetryFrom: Number(uav.telemetry_freq_from_mhz) || null, telemetryTo: Number(uav.telemetry_freq_to_mhz) || null, navFrom: Number(uav.nav_freq_from_mhz) || null, navTo: Number(uav.nav_freq_to_mhz) || null, active: formatBool(uav.is_active !== false), note: uav.note || '', createdAt: uav.created_at ? new Date(uav.created_at) : null, updatedAt: uav.updated_at ? new Date(uav.updated_at) : null, id: uav.id }));
    addDataSheet(workbook, 'Довідник БпЛА', 'ДОВІДНИК БПЛА', `Поточний довідник. Сформовано ${new Date().toLocaleString('uk-UA')}.`, [
      { header: '№', key: 'no', width: 7 }, { header: 'Код', key: 'code', width: 14 }, { header: 'Назва', key: 'name', width: 24 }, { header: 'Категорія', key: 'category', width: 22 }, { header: 'Сторона', key: 'side', width: 14 }, { header: 'Керування від, МГц', key: 'controlFrom', width: 18, numFmt: '0.000' }, { header: 'Керування до, МГц', key: 'controlTo', width: 18, numFmt: '0.000' }, { header: 'Відео від, МГц', key: 'videoFrom', width: 16, numFmt: '0.000' }, { header: 'Відео до, МГц', key: 'videoTo', width: 16, numFmt: '0.000' }, { header: 'Телеметрія від, МГц', key: 'telemetryFrom', width: 19, numFmt: '0.000' }, { header: 'Телеметрія до, МГц', key: 'telemetryTo', width: 19, numFmt: '0.000' }, { header: 'Навігація від, МГц', key: 'navFrom', width: 18, numFmt: '0.000' }, { header: 'Навігація до, МГц', key: 'navTo', width: 18, numFmt: '0.000' }, { header: 'Активний', key: 'active', width: 10 }, { header: 'Примітка', key: 'note', width: 30, wrap: true }, { header: 'Створено', key: 'createdAt', width: 20, numFmt: 'dd.mm.yyyy hh:mm' }, { header: 'Оновлено', key: 'updatedAt', width: 20, numFmt: 'dd.mm.yyyy hh:mm' }, { header: 'ID', key: 'id', width: 38 }
    ], directoryRows);

    const qualityRows = [
      { metric: 'Події у вибраному періоді', value: events.length, share: 100, note: periodText },
      { metric: 'Без типу БпЛА', value: events.filter((e) => !e.uav_type_id).length, share: formatPercent(events.filter((e) => !e.uav_type_id).length, events.length), note: 'Немає зв’язку з dict_uav' },
      { metric: 'Без станції', value: events.filter((e) => !e.station_id).length, share: formatPercent(events.filter((e) => !e.station_id).length, events.length), note: 'Немає зв’язку з dict_stations' },
      { metric: 'Без населеного пункту', value: events.filter((e) => !e.settlement_id).length, share: formatPercent(events.filter((e) => !e.settlement_id).length, events.length), note: 'Немає геоприв’язки' },
      { metric: 'Без азимуту', value: events.filter((e) => e.azimuth == null).length, share: formatPercent(events.filter((e) => e.azimuth == null).length, events.length), note: 'Азимут не заповнено' },
      { metric: 'Не верифіковано', value: events.filter((e) => !e.is_verified).length, share: formatPercent(events.filter((e) => !e.is_verified).length, events.length), note: 'is_verified = false' },
      { metric: 'uav_id відрізняється від uav_type_id', value: events.filter((e) => e.uav_id && e.uav_type_id && e.uav_id !== e.uav_type_id).length, share: formatPercent(events.filter((e) => e.uav_id && e.uav_type_id && e.uav_id !== e.uav_type_id).length, events.length), note: 'Потребує перевірки структури даних' },
      { metric: 'Активні ВП/СП без координат', value: activeCoverageRows.filter((row) => !geo(row)).length, share: formatPercent(activeCoverageRows.filter((row) => !geo(row)).length, activeCoverageRows.length), note: 'Не беруть участі в розрахунку покриття' },
      { metric: 'Активні станції без координат', value: VA.state.stations.filter((row) => row.is_active !== false && !geo(row)).length, share: formatPercent(VA.state.stations.filter((row) => row.is_active !== false && !geo(row)).length, VA.state.stations.filter((row) => row.is_active !== false).length), note: 'Не беруть участі в розрахунку покриття' }
    ];
    addDataSheet(workbook, 'Якість даних', 'КОНТРОЛЬ ЯКОСТІ ДАНИХ', `Період подій ${periodText}.`, [{ header: 'Показник', key: 'metric', width: 38 }, { header: 'Кількість', key: 'value', width: 14 }, { header: 'Частка, %', key: 'share', width: 14, numFmt: '0.0' }, { header: 'Пояснення', key: 'note', width: 48, wrap: true }], qualityRows);

    const metaRows = [
      { parameter: 'Період подій БпЛА', value: periodText },
      { parameter: 'Часовий пояс', value: 'Europe/Kyiv' },
      { parameter: 'Дата формування', value: new Date().toLocaleString('uk-UA') },
      { parameter: 'Події БпЛА', value: events.length },
      { parameter: 'Станції у довіднику', value: VA.state.stations.length },
      { parameter: 'ВП/СП у довіднику', value: VA.state.cover.length },
      { parameter: 'Маршрути', value: routes.length },
      { parameter: 'Пункти', value: points.length },
      { parameter: 'Типи БпЛА у довіднику', value: uavDirectory.length },
      { parameter: 'Правило фільтрації', value: 'Події фільтруються за event_at. Станції, ВП/СП, маршрути, пункти й довідник БпЛА — поточний стан на момент формування.' },
      { parameter: 'Розрахунок покриття', value: 'Об’єкт вважається покритим, якщо відстань до активної станції не перевищує coverage_radius_km цієї станції; за відсутності значення використовується 15 км.' },
      { parameter: 'Діаграми', value: 'Вбудовані в XLSX як зображення; усі вихідні таблиці залишаються доступними для фільтрації та подальшої роботи.' }
    ];
    addDataSheet(workbook, 'Метадані', 'МЕТАДАНІ ЗВІТУ', generatedText, [{ header: 'Параметр', key: 'parameter', width: 34 }, { header: 'Значення', key: 'value', width: 90, wrap: true }], metaRows);

    workbook.worksheets.forEach((ws) => {
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
      ws.headerFooter.oddFooter = '&LВнутрішній аналітичний матеріал&CСторінка &P з &N&R' + new Date().toLocaleDateString('uk-UA');
    });

    return workbook;
  }

  async function generate() {
    const from = fromInput.value;
    const to = toInput.value;
    if (!from || !to) {
      setProgress('Вкажіть початок і кінець періоду.', 'error');
      return;
    }
    if (from > to) {
      setProgress('Початок періоду не може бути пізніше завершення.', 'error');
      return;
    }
    if (!window.ExcelJS || !window.saveAs || !window.Chart) {
      setProgress('Не завантажилися бібліотеки ExcelJS, FileSaver або Chart.js. Оновіть сторінку.', 'error');
      return;
    }

    buildButton.disabled = true;
    openButton.disabled = true;
    q('#cancelExport').disabled = true;
    try {
      setProgress('Готую дані з Supabase...');
      await VA.ready;
      const eventCount = filterEvents(from, to).length;
      if (!eventCount) {
        setProgress('За обраний період немає подій БпЛА. Змініть дати.', 'error');
        return;
      }
      const workbook = await buildWorkbook(from, to);
      setProgress('Формую файл XLSX. Це може тривати кілька секунд...');
      const buffer = await workbook.xlsx.writeBuffer();
      const filename = `VECTOR_аналітика_${from}_${to}.xlsx`;
      saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
      setProgress(`Готово: ${filename}`, 'success');
    } catch (error) {
      console.error(error);
      setProgress(`Помилка формування: ${error.message || error}`, 'error');
    } finally {
      buildButton.disabled = false;
      openButton.disabled = false;
      q('#cancelExport').disabled = false;
    }
  }

  openButton.addEventListener('click', openModal);
  q('#closeExport').addEventListener('click', closeModal);
  q('#cancelExport').addEventListener('click', closeModal);
  q('#buildExport').addEventListener('click', generate);
  q('.presets').addEventListener('click', (event) => {
    const button = event.target.closest('[data-days]');
    if (button) setPreset(button.dataset.days);
  });
  modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });
})();
