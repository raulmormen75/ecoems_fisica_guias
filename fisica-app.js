(() => {
  const DATA = window.IFR_APP_DATA || { meta: {}, topics: [], guides: [] };
  const GUIDES = DATA.guides || [];
  const TOPICS = DATA.topics || [];
  const GUIDE_ORDER = Object.fromEntries(GUIDES.map((guide, index) => [guide.id, index]));
  const STATE = { view: 'todos', guide: 'all', topic: 'all', query: '' };
  const CARD_STATE = {};

  const VIEWS = [
    { id: 'guia-1', label: 'Guía 1' },
    { id: 'guia-2', label: 'Guía 2' },
    { id: 'temas', label: 'Temas' },
    { id: 'todos', label: 'Todos los reactivos' }
  ];

  const GUIDE_TEXT = {
    'guia-1': 'Primera guía con reactivos del 105 al 116 y cuatro opciones por ejercicio.',
    'guia-2': 'Segunda guía con reactivos del 105 al 116 y cinco opciones por ejercicio.'
  };

  const byId = (id) => document.getElementById(id);

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const EXERCISES = GUIDES.flatMap((guide) =>
    (guide.exercises || []).map((exercise) => ({
      ...exercise,
      guideOrder: GUIDE_ORDER[guide.id] || 0,
      searchIndex: normalizeText([
        exercise.guideName,
        exercise.number,
        exercise.topic,
        exercise.question,
        exercise.hint,
        ...(exercise.options || []).map((option) => option.text)
      ].join(' '))
    }))
  );

  function cardState(exerciseId) {
    if (!CARD_STATE[exerciseId]) {
      CARD_STATE[exerciseId] = {
        status: 'idle',
        selectedOption: '',
        hintOpen: false
      };
    }

    return CARD_STATE[exerciseId];
  }

  function paragraphs(text) {
    const blocks = String(text || '')
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    if (!blocks.length) return '';

    return `<div class="text">${blocks
      .map((block) => block.split('\n').map((line) => `<p>${esc(line)}</p>`).join(''))
      .join('')}</div>`;
  }

  function question(lines) {
    return `<div class="question">${(Array.isArray(lines) ? lines : [])
      .filter(Boolean)
      .map((line) => `<p>${esc(line)}</p>`)
      .join('')}</div>`;
  }

  function currentGuide() {
    if (STATE.view === 'guia-1') return 'guia-1';
    if (STATE.view === 'guia-2') return 'guia-2';
    return STATE.guide;
  }

  function matches() {
    const guide = currentGuide();
    const topic = STATE.topic;
    const query = normalizeText(STATE.query.trim());

    return EXERCISES.filter((exercise) => {
      if (guide !== 'all' && exercise.guideId !== guide) return false;
      if (topic !== 'all' && exercise.topicId !== topic) return false;
      if (query && !exercise.searchIndex.includes(query)) return false;
      return true;
    }).sort((left, right) => {
      if (left.guideOrder !== right.guideOrder) return left.guideOrder - right.guideOrder;
      return left.sourceOrder - right.sourceOrder;
    });
  }

  function distinct(exercises, field) {
    return new Set(exercises.map((exercise) => exercise[field])).size;
  }

  function chip(label, active, action, data = {}) {
    const attrs = Object.entries(data)
      .map(([key, value]) => ` ${key}="${esc(value)}"`)
      .join('');
    return `<button class="chip${active ? ' active' : ''}" type="button" data-action="${esc(action)}"${attrs}>${esc(label)}</button>`;
  }

  function panelButton(exerciseId, label) {
    const open = cardState(exerciseId).hintOpen;
    const text = open ? 'Ocultar pista' : label;
    return `<button class="action hint-action${open ? ' open' : ''}" type="button" data-action="toggle-hint" data-id="${esc(exerciseId)}">${esc(text)}</button>`;
  }

  function selectionState(exercise) {
    const state = cardState(exercise.id);
    return {
      selected: state.selectedOption || '',
      correct: exercise.correctOption?.label || '',
      status: state.status
    };
  }

  function optionTone(exercise, option) {
    const { selected, status } = selectionState(exercise);

    if (status === 'idle') {
      return {
        tone: '',
        label: 'Selecciona',
        disabled: false
      };
    }

    if (status === 'wrong') {
      return {
        tone: option.label === selected ? ' is-wrong' : ' is-locked',
        label: option.label === selected ? 'Incorrecta' : 'Bloqueada',
        disabled: true
      };
    }

    if (status === 'correct') {
      return {
        tone: option.label === selected ? ' is-correct' : ' is-locked',
        label: option.label === selected ? 'Correcta' : 'Bloqueada',
        disabled: true
      };
    }

    return { tone: '', label: 'Selecciona', disabled: false };
  }

  function optionList(exercise) {
    return `<div class="opts">${(exercise.options || [])
      .map((option) => {
        const state = optionTone(exercise, option);
        return `<button class="opt${state.tone}" type="button" data-action="pick-option" data-id="${esc(exercise.id)}" data-option="${esc(option.label)}"${state.disabled ? ' disabled' : ''}>
          <div class="row">
            <span class="let">${esc(option.label)}</span>
            <span class="lab">${esc(state.label)}</span>
          </div>
          <div class="opt-text">${esc(option.text)}</div>
        </button>`;
      })
      .join('')}</div>`;
  }

  function retryButton(exercise) {
    const { status } = selectionState(exercise);
    if (status !== 'wrong') return '';
    return `<button class="action retry-action" type="button" data-action="retry-option" data-id="${esc(exercise.id)}">Reintentar</button>`;
  }

  function attemptMessage(exercise) {
    const { status } = selectionState(exercise);

    if (status === 'wrong') {
      return `<section class="attempt-state warning">
        <div class="meta">Intenta de nuevo</div>
        <p>Revisa la pista y vuelve a intentarlo 🧠</p>
      </section>`;
    }

    if (status === 'correct') {
      return `<section class="attempt-state success">
        <div class="meta">Acierto confirmado</div>
        <p>Bien resuelto ✅ Ahora revisa por qué las demás no corresponden.</p>
      </section>`;
    }

    return '';
  }

  function axisTicks(maxValue, count) {
    if (!maxValue || maxValue <= 0) return [];
    return Array.from({ length: count }, (_, index) => Number(((maxValue / count) * (index + 1)).toFixed(1)));
  }

  function chartPath(points, scaleX, scaleY) {
    return points
      .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${scaleX(x)} ${scaleY(y)}`)
      .join(' ');
  }

  function defaultMotionPoints(spec) {
    if (spec.chartType === 'line') {
      return spec.fromOrigin
        ? [[0, 0], [4, 4]]
        : [[0, 1], [4, 4]];
    }

    return spec.fromOrigin
      ? [[0, 0], [1, 0.4], [2, 1.3], [3, 2.6], [4, 4.2]]
      : [[0, 0.9], [1, 1.1], [2, 1.7], [3, 2.9], [4, 4.2]];
  }

  function customTicks(maxValue, step) {
    if (!step || !maxValue || maxValue <= 0) return [];
    const ticks = [];
    for (let v = step; v <= maxValue; v = Number((v + step).toFixed(4))) {
      ticks.push(Number(v.toFixed(4)));
    }
    return ticks;
  }

  function renderChartSvg(spec, options = {}) {
    const compact = !!options.compact;
    const width = compact ? 190 : 360;
    const height = compact ? 150 : 220;
    const padding = compact
      ? { top: 12, right: 18, bottom: 36, left: 34 }
      : { top: 16, right: 24, bottom: 42, left: 44 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const points = (spec.points && spec.points.length ? spec.points : defaultMotionPoints(spec)).map((entry) => [
      Number(entry[0]),
      Number(entry[1])
    ]);
    const minX = 0;
    const minY = 0;
    const maxX = spec.xMax != null ? Number(spec.xMax) : Math.max(...points.map((point) => point[0]), 1);
    const maxY = spec.yMax != null ? Number(spec.yMax) : Math.max(...points.map((point) => point[1]), 1);

    const scaleX = (value) => padding.left + ((value - minX) / (maxX - minX || 1)) * plotWidth;
    const scaleY = (value) => padding.top + plotHeight - ((value - minY) / (maxY - minY || 1)) * plotHeight;
    const path = chartPath(points, scaleX, scaleY);
    const xTicks = spec.xStep ? customTicks(maxX, spec.xStep) : axisTicks(maxX, compact ? 3 : 4);
    const yTicks = spec.yStep ? customTicks(maxY, spec.yStep) : axisTicks(maxY, compact ? 3 : 4);

    return `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(spec.title || 'Gráfica del reactivo')}">
        <rect x="0" y="0" width="${width}" height="${height}" rx="${compact ? 18 : 24}" fill="rgba(255,255,255,0.98)"/>
        <line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="chart-axis"></line>
        <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="chart-axis"></line>
        ${yTicks
          .map((tick) => `
            <g>
              <line x1="${padding.left - 4}" y1="${scaleY(tick)}" x2="${width - padding.right}" y2="${scaleY(tick)}" class="chart-grid"></line>
              <text x="${padding.left - 6}" y="${scaleY(tick) + 4}" text-anchor="end" class="chart-tick">${esc(tick)}</text>
            </g>
          `)
          .join('')}
        ${xTicks
          .map((tick) => `
            <g>
              <line x1="${scaleX(tick)}" y1="${height - padding.bottom}" x2="${scaleX(tick)}" y2="${padding.top}" class="chart-grid"></line>
              <text x="${scaleX(tick)}" y="${height - padding.bottom + 14}" text-anchor="middle" class="chart-tick">${esc(tick)}</text>
            </g>
          `)
          .join('')}
        <path d="${path}" class="chart-line ${spec.chartType === 'curve' ? 'curve' : ''}"></path>
        ${points
          .map(
            ([x, y]) => `<circle cx="${scaleX(x)}" cy="${scaleY(y)}" r="${compact ? 3 : 4}" class="chart-point"></circle>`
          )
          .join('')}
        ${spec.yLabel ? `<text x="${-(padding.top + plotHeight / 2)}" y="${padding.left - 24}" transform="rotate(-90)" text-anchor="middle" class="chart-label chart-label-y">${esc(spec.yLabel)}</text>` : ''}
        ${spec.xLabel ? `<text x="${padding.left + plotWidth / 2}" y="${height - 6}" text-anchor="middle" class="chart-label">${esc(spec.xLabel)}</text>` : ''}
      </svg>
    `;
  }

  function renderTableVisual(table) {
    return `
      <div class="data-table">
        <table>
          <thead>
            <tr>${table.columns.map((column) => `<th>${esc(column)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${table.rows
              .map((row) => `<tr>${row.map((value) => `<td>${esc(value)}</td>`).join('')}</tr>`)
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTableAndOptionsVisual(spec) {
    return `
      <section class="visual-support">
        <div class="visual-head">
          <div>
            <div class="meta">Apoyo visual</div>
            <h4>${esc(spec.title)}</h4>
          </div>
          ${spec.promptNote ? `<span class="visual-badge">${esc(spec.promptNote)}</span>` : ''}
        </div>
        <div class="visual-grid split">
          <article class="visual-card">
            <div class="visual-card-head">Datos visibles</div>
            ${renderTableVisual(spec.table)}
          </article>
          <article class="visual-card">
            <div class="visual-card-head">Opciones gráficas</div>
            <div class="mini-chart-grid">
              ${spec.options
                .map(
                  (option) => `
                    <div class="mini-chart-card">
                      <div class="mini-chart-head"><span>${esc(option.label)}</span></div>
                      ${renderChartSvg(option, { compact: true })}
                    </div>
                  `
                )
                .join('')}
            </div>
          </article>
        </div>
      </section>
    `;
  }

  function renderMotionFamilyVisual(spec) {
    return `
      <section class="visual-support">
        <div class="visual-head">
          <div>
            <div class="meta">Apoyo visual</div>
            <h4>${esc(spec.title)}</h4>
          </div>
        </div>
        <div class="mini-chart-grid">
          ${spec.charts
            .map(
              (chart) => `
                <div class="mini-chart-card abstract">
                  <div class="mini-chart-head"><span>Gráfica ${esc(chart.label)}</span></div>
                  ${renderChartSvg({ ...chart, title: `Gráfica ${chart.label}` }, { compact: true })}
                </div>
              `
            )
            .join('')}
        </div>
      </section>
    `;
  }

  function visualBlock(exercise) {
    const spec = exercise.visualSpec;
    if (!spec) return '';

    if (spec.type === 'table-and-option-graphs') {
      return renderTableAndOptionsVisual(spec);
    }

    if (spec.type === 'motion-family-graphs') {
      return renderMotionFamilyVisual(spec);
    }

    if (spec.type === 'velocity-time-graph' || spec.type === 'position-time-graph') {
      return `
        <section class="visual-support">
          <div class="visual-head">
            <div>
              <div class="meta">Apoyo visual</div>
              <h4>${esc(spec.title)}</h4>
            </div>
            ${spec.approximate ? '<span class="visual-badge">Puntos aproximados</span>' : ''}
          </div>
          <div class="single-chart">${renderChartSvg(spec)}</div>
        </section>
      `;
    }

    return '';
  }

  function analysisList(exercise) {
    const items = (exercise.optionsAnalysis || []).filter((item) => item.text);
    if (!items.length) return '';

    return `<div class="analysis-grid">${items
      .map((item) => `
        <article class="analysis">
          <div class="analysis-head">
            <span class="badge">${esc(item.label)}</span>
            <span>${esc(item.option || `Opción ${item.label}`)}</span>
          </div>
          ${paragraphs(item.text)}
        </article>
      `)
      .join('')}</div>`;
  }

  function solvedContent(exercise) {
    const { status } = selectionState(exercise);
    if (status !== 'correct') return '';

    return `<section class="feedback-stack">
      ${exercise.argument ? `
        <article class="support solved-panel final">
          <div class="meta">Análisis del reactivo</div>
          ${paragraphs(exercise.argument)}
        </article>
      ` : ''}
      ${(exercise.optionsAnalysis || []).length ? `
        <article class="support solved-panel">
          <div class="meta">Revisión de opciones</div>
          ${analysisList(exercise)}
        </article>
      ` : ''}
    </section>`;
  }

  function card(exercise) {
    return `<article class="card" id="reactivo-${esc(exercise.id)}">
      <div class="head">
        <div>
          <div class="type">${esc(`${exercise.guideName} · Reactivo ${exercise.number}`)}</div>
          <h3>${esc(exercise.topic)}</h3>
        </div>
      </div>
      <div class="layout">
        <div class="block question-block">
          <div class="problem-head">
            <div class="meta">Pregunta</div>
            <span class="reactivo-chip">${esc(`${exercise.options.length} opciones`)}</span>
          </div>
          ${question(exercise.questionLines)}
          ${visualBlock(exercise)}
        </div>
        <div class="block">
          <div class="problem-head">
            <div class="meta">Opciones</div>
          </div>
          ${optionList(exercise)}
        </div>
      </div>
      <div class="actions act">
        ${retryButton(exercise)}
        ${panelButton(exercise.id, 'Ver pista')}
      </div>
      ${attemptMessage(exercise)}
      <section class="support hint"${cardState(exercise.id).hintOpen ? '' : ' hidden'}>
        <div class="meta">Pista</div>
        ${paragraphs(exercise.hint)}
      </section>
      ${solvedContent(exercise)}
    </article>`;
  }

  function guideSection(guide, exercises) {
    if (!exercises.length) return '';

    return `<section class="section">
      <header class="section-head">
        <div>
          <h2>${esc(guide.name)}</h2>
          <p>${esc(GUIDE_TEXT[guide.id] || 'Consulta los reactivos de esta guía sin alterar su secuencia original.')}</p>
        </div>
        <span class="count">${esc(String(exercises.length))} reactivos</span>
      </header>
      <div class="cards">${exercises.map(card).join('')}</div>
    </section>`;
  }

  function topicSection(topic, exercises) {
    const byGuide = new Map();

    exercises.forEach((exercise) => {
      if (!byGuide.has(exercise.guideId)) byGuide.set(exercise.guideId, []);
      byGuide.get(exercise.guideId).push(exercise);
    });

    const splits = Array.from(byGuide.entries())
      .sort((left, right) => (GUIDE_ORDER[left[0]] || 0) - (GUIDE_ORDER[right[0]] || 0))
      .map(([guideId, items]) => {
        const guide = GUIDES.find((entry) => entry.id === guideId);
        return `<div class="guide-split">
          <div class="guide-split-head">
            <h3>${esc(guide ? guide.name : guideId)}</h3>
            <span>${esc(`${items.length} reactivos en su orden original`)}</span>
          </div>
          <div class="cards">${items.map(card).join('')}</div>
        </div>`;
      })
      .join('');

    return `<section class="section">
      <header class="section-head">
        <div>
          <h2>${esc(topic.name)}</h2>
          <p>La agrupación por tema facilita la práctica, pero cada guía conserva el orden fuente de sus reactivos.</p>
        </div>
        <span class="count">${esc(String(exercises.length))} reactivos</span>
      </header>
      ${splits}
    </section>`;
  }

  function home() {
    const guideCards = GUIDES.map((guide) => {
      const first = guide.exercises[0];
      const last = guide.exercises[guide.exercises.length - 1];
      const optionCount = guide.id === 'guia-1' ? '4 opciones por reactivo' : '5 opciones por reactivo';
      return `<article class="info-card">
        <h3>${esc(guide.name)}</h3>
        <p>${esc(GUIDE_TEXT[guide.id] || '')}</p>
        <p>${esc(`${guide.exerciseCount} reactivos · orden ${first.number} a ${last.number}`)}</p>
        <p>${esc(optionCount)}</p>
        <button class="chip" type="button" data-action="view" data-view="${esc(guide.id)}">Entrar a ${esc(guide.name)}</button>
      </article>`;
    }).join('');

    const topicButtons = TOPICS.map((topic) =>
      `<button type="button" data-action="topic" data-topic="${esc(topic.id)}">${esc(`${topic.name} (${topic.exerciseCount})`)}</button>`
    ).join('');

    const previews = GUIDES.map((guide) => guideSection(guide, guide.exercises.slice(0, 2))).join('');

    return `<section class="panel">
      <h2>Ruta de práctica sugerida</h2>
      <p>Empieza por una guía si quieres recorrer la secuencia completa. Entra a temas si necesitas reforzar un contenido puntual sin romper el orden interno de cada guía. Usa la pista solo cuando haga falta y vuelve a intentar sin respuestas adelantadas.</p>
      <div class="hero-grid">${guideCards}</div>
    </section>
    <section class="panel">
      <h2>Temas disponibles</h2>
      <p>La clasificación temática sale del material fuente y sirve para localizar mejor los reactivos sin modificar su contenido original.</p>
      <div class="quick-topics">${topicButtons}</div>
    </section>
    ${previews}`;
  }

  function renderPresetNav() {
    return VIEWS.map((view) => chip(view.label, STATE.view === view.id, 'view', { 'data-view': view.id })).join('');
  }

  function renderGuideChips() {
    return [
      chip('Todas las guías', currentGuide() === 'all' && !['guia-1', 'guia-2'].includes(STATE.view), 'guide', { 'data-guide': 'all' }),
      ...GUIDES.map((guide) => chip(guide.name, currentGuide() === guide.id, 'guide', { 'data-guide': guide.id }))
    ].join('');
  }

  function renderTopicChips(list) {
    const visibleTopics = TOPICS.filter((topic) =>
      list.some((exercise) => exercise.topicId === topic.id) || STATE.topic === topic.id
    );

    return [
      chip('Todos los temas', STATE.topic === 'all', 'topic', { 'data-topic': 'all' }),
      ...visibleTopics.map((topic) => chip(`${topic.name} (${topic.exerciseCount})`, STATE.topic === topic.id, 'topic', { 'data-topic': topic.id }))
    ].join('');
  }

  function renderMetrics(list) {
    return [
      { value: list.length, label: 'Reactivos visibles' },
      { value: distinct(list, 'guideId'), label: 'Guías activas' },
      { value: distinct(list, 'topicId'), label: 'Temas activos' }
    ].map((item) => `<div><b>${esc(String(item.value))}</b><span>${esc(item.label)}</span></div>`).join('');
  }

  function render() {
    const list = matches();

    byId('topStats').textContent = `Visibles: ${list.length} | Guías: ${distinct(list, 'guideId')} | Temas: ${distinct(list, 'topicId')}`;
    byId('presetNav').innerHTML = renderPresetNav();
    byId('guideChips').innerHTML = renderGuideChips();
    byId('topicChips').innerHTML = renderTopicChips(list);
    byId('metrics').innerHTML = renderMetrics(list);

    if (!list.length) {
      byId('content').innerHTML = '';
      byId('empty').hidden = false;
      return;
    }

    byId('empty').hidden = true;

    if (STATE.view === 'temas') {
      const grouped = new Map();
      list.forEach((exercise) => {
        if (!grouped.has(exercise.topicId)) grouped.set(exercise.topicId, []);
        grouped.get(exercise.topicId).push(exercise);
      });

      byId('content').innerHTML = TOPICS.filter((topic) => grouped.has(topic.id))
        .map((topic) => topicSection(topic, grouped.get(topic.id)))
        .join('');
      return;
    }

    byId('content').innerHTML = GUIDES
      .map((guide) => guideSection(guide, list.filter((exercise) => exercise.guideId === guide.id)))
      .join('');
  }

  document.addEventListener('click', (event) => {
    const node = event.target.closest('[data-action]');
    if (!node) return;

    const action = node.dataset.action;

    if (action === 'view') {
      STATE.view = node.dataset.view || 'todos';
      if (STATE.view === 'guia-1') STATE.guide = 'guia-1';
      if (STATE.view === 'guia-2') STATE.guide = 'guia-2';
      render();
      return;
    }

    if (action === 'guide') {
      STATE.guide = node.dataset.guide || 'all';
      if (STATE.guide === 'guia-1' || STATE.guide === 'guia-2') STATE.view = STATE.guide;
      else if (STATE.view === 'guia-1' || STATE.view === 'guia-2') STATE.view = 'todos';
      render();
      return;
    }

    if (action === 'topic') {
      STATE.topic = node.dataset.topic || 'all';
      if (STATE.view !== 'temas') STATE.view = 'temas';
      render();
      return;
    }

    if (action === 'pick-option') {
      const exerciseId = node.dataset.id;
      const option = node.dataset.option || '';
      const exercise = EXERCISES.find((item) => item.id === exerciseId);

      if (!exerciseId || !option || !exercise) return;

      const state = cardState(exerciseId);
      if (state.status !== 'idle') return;

      state.selectedOption = option;
      state.status = option === exercise.correctOption?.label ? 'correct' : 'wrong';
      render();
      return;
    }

    if (action === 'retry-option') {
      const exerciseId = node.dataset.id;
      if (!exerciseId) return;

      const state = cardState(exerciseId);
      state.status = 'idle';
      state.selectedOption = '';
      render();
      return;
    }

    if (action === 'toggle-hint') {
      const exerciseId = node.dataset.id;
      if (!exerciseId) return;

      const state = cardState(exerciseId);
      state.hintOpen = !state.hintOpen;
      render();

      if (state.hintOpen) {
        window.requestAnimationFrame(() => {
          const cardNode = document.getElementById(`reactivo-${exerciseId}`);
          const supportNode = cardNode?.querySelector('.support.hint');
          supportNode?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
  });

  byId('searchInput').addEventListener('input', (event) => {
    STATE.query = event.target.value || '';
    render();
  });

  const toTop = byId('toTop');
  const syncTop = () => toTop.classList.toggle('show', window.scrollY > 260);

  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  window.addEventListener('scroll', syncTop, { passive: true });
  window.addEventListener('load', syncTop);

  render();
  syncTop();
})();
