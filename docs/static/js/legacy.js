import { FIRECRAWL_API, USE_LOCAL_PROXY, API_BASE, LOADERS, MAX_SEARCH_QUERY, MAX_SEARCH_LIMIT } from './config.js';
import { getApiKey, getOpenAiKey, saveApiKey, saveOpenAiKey, loadApiKey, loadOpenAiKey } from './storage.js';
import { apiPost, firecrawlRequest, firecrawlGet, firecrawlCrawlStart, extractApiError } from './api.js';

const PRACTICE_COLUMNS = [
  'Наименование организации', 'Отрасль', 'Регион', 'Название программы или практики',
  'Дата публикации', 'Ссылка на источник', 'Целевая аудитория', 'Исходная проблема',
  'Потребности целевой аудитории', 'Цель программы', 'Используемая модель или подход',
  'Этапы пути сотрудника', 'Инструменты адаптации', 'Наличие единого окна или координатора',
  'Наличие личного куратора или наставника', 'Работа с непосредственными руководителями',
  'Обучение HR и руководителей', 'Подготовка трудового коллектива', 'Работа с семьями',
  'Волонтёрские или ветеранские сообщества', 'Каналы коммуникации',
  'Портал, горячая линия или другой цифровой сервис', 'Психологическое сопровождение',
  'Профессиональное обучение и переобучение', 'Количество участников программы',
  'Количество трудоустроенных', 'Текучесть или отток до запуска программы',
  'Текучесть или отток после запуска программы', 'Другие количественные результаты',
  'Период измерения результатов', 'Отзывы участников', 'Выявленные сложности',
  'Рекомендации другим работодателям', 'Нормативное основание',
  'Возможные субсидии и меры государственной поддержки', 'Оценка доказательности информации'
];

const HR_RESEARCH_BRIEF = `Собери публичную информацию о лучших HR-практиках российских работодателей: адаптация и onboarding, вовлечённость, удержание, обучение и развитие, оценка эффективности, HR-аналитика, employer brand, удалённая и гибридная работа.

Период публикаций: с 1 января 2023 года по текущую дату.

Приоритетные сайты:
* \`hrtimes.ru\`
* \`hh.ru\`
* \`mintrud.gov.ru\`
* \`consultant.ru\`
* \`hr-portal.ru\`
* \`trudvsem.ru\`

Используй ключевые слова:
«адаптация новых сотрудников», «onboarding», «текучесть персонала», «employee engagement», «удержание сотрудников», «performance review», «HR analytics», «обучение и развитие персонала», «корпоративная культура», «employer brand», «гибридный формат работы», «eNPS», «наставничество», «карьерные треки», «система грейдов».`;

const HR_RESEARCH_KEYWORDS = `адаптация новых сотрудников
onboarding
текучесть персонала
employee engagement
удержание сотрудников
performance review
HR analytics
обучение и развитие персонала
корпоративная культура
employer brand
гибридный формат работы
eNPS
наставничество
карьерные треки
система грейдов`;

const HR_RESEARCH_DOMAINS = `hrtimes.ru hh.ru mintrud.gov.ru consultant.ru hr-portal.ru trudvsem.ru`;

const SVO_RESEARCH_BRIEF = `Собери публичную информацию о практиках российских работодателей по трудоустройству, возвращению на прежнее рабочее место, профессиональной и социальной адаптации, сопровождению и удержанию ветеранов боевых действий и участников СВО.

Период публикаций: с 1 января 2023 года по текущую дату.

Приоритетные сайты:
* \`consultant.ru\`
* \`normativ.kontur.ru\`
* \`bp.mintrud.gov.ru\`
* \`mintrud.gov.ru\`
* \`trudvsem.ru\`
* \`sfr.gov.ru\`
* \`fzo.info\`

Используй следующие поисковые слова:
«участники СВО», «ветераны боевых действий», «трудоустройство участников СВО», «возвращение на работу», «адаптация участников СВО», «реинтеграция работников», «сопровождение ветеранов», «корпоративная программа поддержки», «единое окно», «личный куратор», «группа заботы», «наставничество», «психологическая поддержка», «социальное сопровождение», «поддержка семей», «обучение руководителей», «подготовка трудового коллектива», «корпоративная культура», «внутренние коммуникации», «карта адаптации», «путь сотрудника», «employee journey», «CJM», «сообщество ветеранов», «волонтёрская программа», «удержание сотрудников», «текучесть», «отток», «субсидия работодателю», «профессиональное переобучение».`;

let lastPayload = null;
let lastAiReport = '';







function setAiTabVisible(show, pulse = false) {
  const tab = document.getElementById('tabAiBtn');
  tab.classList.toggle('tab-hidden', !show);
  tab.classList.toggle('tab-new', show && pulse);
}

function updateResultsViewForTab(tabName) {
  const isAi = tabName === 'ai';
  document.getElementById('resultsList').style.display = isAi ? 'none' : '';
  document.getElementById('aiResultsArea').style.display = isAi ? 'block' : 'none';
  document.getElementById('kpiRow').style.display = isAi ? 'none' : '';
  document.querySelector('.export-hint').style.display = isAi ? 'none' : '';
  if (isAi && !lastAiReport) {
    document.getElementById('aiResultsArea').innerHTML = `<div class="ai-placeholder">
      <p><strong>AI-анализ ещё не выполнен.</strong></p>
      <p>Нажмите «Провести AI-анализ» слева. ИИ изучит ${lastPayload?.items?.length || 0} собранных источников и подготовит рекомендации.</p>
      <p>Нет ключа OpenAI? Используйте «Скопировать промпт для ChatGPT».</p>
    </div>`;
  }
}

function simpleMdToHtml(md) {
  return esc(md)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '')
    .replace(/^/, '<p>').replace(/$/, '</p>');
}

function renderAiReport(text) {
  lastAiReport = text;
  document.getElementById('placeholder').style.display = 'none';
  document.getElementById('resultsArea').style.display = 'block';
  document.getElementById('resultsTitle').textContent = 'AI-анализ и рекомендации';
  document.getElementById('aiResultsArea').innerHTML = simpleMdToHtml(text);
  updateResultsViewForTab('ai');
}

function buildResearchContextForAi(useMarkdown) {
  const items = lastPayload?.items || [];
  const maxItems = 30;
  const mdLimit = 900;
  let total = 0;
  const maxTotal = 14000;
  const blocks = [];

  for (const it of items.slice(0, maxItems)) {
    let chunk = `### ${it.title || 'Без названия'}\nURL: ${it.url || it.sourceURL || '—'}\n`;
    if (it.searchKeyword) chunk += `Ключ: ${it.searchKeyword}\n`;
    if (it.description || it.snippet) chunk += `Описание: ${it.description || it.snippet}\n`;
    if (useMarkdown && (it.markdown || it.content)) {
      chunk += `\nТекст:\n${String(it.markdown || it.content).slice(0, mdLimit)}\n`;
    }
    if (total + chunk.length > maxTotal) break;
    blocks.push(chunk);
    total += chunk.length;
  }

  return {
    text: blocks.join('\n---\n'),
    used: blocks.length,
    total: items.length
  };
}

function buildAiPrompt() {
  const brief = lastPayload?.meta?.researchBrief
    || document.getElementById('researchBrief').value.trim()
    || 'Анализ собранных материалов из интернета';
  const focus = document.getElementById('aiFocus').value.trim();
  const useMd = document.getElementById('aiUseMarkdown').checked;
  const ctx = buildResearchContextForAi(useMd);
  const keywords = [...new Set((lastPayload?.items || []).map(i => i.searchKeyword).filter(Boolean))];

  const userPrompt = `Техническое задание исследования:
${brief}

${focus ? `Дополнительный фокус анализа:\n${focus}\n\n` : ''}Статистика сбора:
- Всего источников: ${ctx.total}
- Передано в анализ: ${ctx.used}
${keywords.length ? `- Ключевые запросы: ${keywords.slice(0, 15).join('; ')}${keywords.length > 15 ? '…' : ''}\n` : ''}
Материалы (заголовок, URL, фрагмент текста):
${ctx.text}

Инструкция:
1. Прочитай техническое задание — именно оно задаёт тему, цели и нужную структуру отчёта (HR, рынок, продукт, право и т.д.).
2. Если в задании уже перечислены разделы, таблицы, KPI или вопросы — используй их как оглавление отчёта.
3. Если структура не задана — предложи универсальную:
   - краткая сводка;
   - ключевые находки с URL;
   - паттерны и противоречия;
   - пробелы в данных;
   - рекомендации и следующие шаги.
4. Опирайся только на переданные материалы. Не выдумывай факты.
5. Если данных нет — пиши «нет данных». Отделяй факты от планов и заявлений.
6. Ответ — на русском, в markdown.`;

  return {
    system: 'Ты аналитик открытых источников. Синтезируй материалы в отчёт строго по целям технического задания пользователя, без привязки к конкретной отрасли.',
    user: userPrompt
  };
}

async function callOpenAiAnalysis(prompt) {
  saveOpenAiKey();
  const payload = {
    openaiKey: getOpenAiKey() || undefined,
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ]
  };

  if (USE_LOCAL_PROXY) {
    const res = await fetch(`${API_BASE}/api/ai/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || extractApiError(json, res.status));
    return json.content || json.text || '';
  }

  const apiKey = getOpenAiKey();
  if (!apiKey) throw new Error('Укажите ключ OpenAI (sk-…) или запустите python server.py с OPENAI_API_KEY');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: payload.model,
      messages: payload.messages,
      temperature: 0.3
    })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || extractApiError(json, res.status));
  return json.choices?.[0]?.message?.content || '';
}

function setAiProgress(text) {
  const el = document.getElementById('aiProgress');
  el.textContent = text;
  el.classList.add('visible');
}

function hideAiProgress() {
  document.getElementById('aiProgress').classList.remove('visible');
}

async function doAiAnalyze() {
  if (!lastPayload?.items?.length || lastPayload.meta?.mode !== 'research') {
    alert('Сначала выполните исследование и соберите ссылки');
    return;
  }

  const btn = document.getElementById('btnAiAnalyze');
  btn.disabled = true;
  hideError();

  runLoader('ai', async () => {
    try {
      setAiProgress('Формирование промпта…');
      const prompt = buildAiPrompt();
      setAiProgress('Отправка в GPT-4o-mini…');
      const report = await callOpenAiAnalysis(prompt);
      if (!report.trim()) throw new Error('ИИ вернул пустой ответ');
      renderAiReport(report);
      document.getElementById('tabAiBtn').click();
      showToast('AI-анализ готов');
    } catch (e) {
      showError(e.message || String(e));
      showToast('Ошибка AI-анализа — попробуйте «Скопировать промпт для ChatGPT»');
    } finally {
      hideLoader('ai');
      hideAiProgress();
      btn.disabled = false;
    }
  });
}

async function copyAiPrompt() {
  if (!lastPayload?.items?.length) {
    showToast('Нет данных исследования');
    return;
  }
  const prompt = buildAiPrompt();
  const full = `${prompt.system}\n\n---\n\n${prompt.user}`;
  try {
    await navigator.clipboard.writeText(full);
    showToast('Промпт скопирован — вставьте в ChatGPT');
  } catch {
    showToast('Не удалось скопировать');
  }
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}







function runLoader(id, done) {
  const el = document.getElementById('loader-' + id);
  el.innerHTML = LOADERS[id].map((t,i)=>`<div class="loader-step" data-i="${i}">${esc(t)}</div>`).join('');
  el.classList.add('visible');
  const steps = el.querySelectorAll('.loader-step');
  let i = 0;
  (function tick(){
    steps.forEach((s,idx)=>{ s.classList.toggle('active',idx===i); s.classList.toggle('done',idx<i); });
    if (i++ >= steps.length) { setTimeout(done, 250); return; }
    setTimeout(tick, 450);
  })();
}

function hideLoader(id) {
  document.getElementById('loader-' + id).classList.remove('visible');
}

function normalizeItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  const items = [];
  for (const key of ['web', 'news', 'images']) {
    if (Array.isArray(data[key])) items.push(...data[key]);
  }
  return items;
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.classList.add('visible');
}

function hideError() {
  document.getElementById('errorBox').classList.remove('visible');
}

function renderResults(title, items, meta = {}) {
  document.getElementById('placeholder').style.display = 'none';
  const area = document.getElementById('resultsArea');
  area.style.display = 'block';
  document.getElementById('resultsTitle').textContent = title;
  hideError();

  const withMd = items.filter(i => i.markdown || i.content).length;
  let kpiCols;
  if (meta.mode === 'crawl') {
    kpiCols = `
    <div class="kpi"><div class="kpi-val">${items.length}</div><div class="kpi-label">Страниц</div></div>
    <div class="kpi"><div class="kpi-val">${meta.platesCount ?? 0}</div><div class="kpi-label">Номеров</div></div>
    <div class="kpi"><div class="kpi-val">${withMd}</div><div class="kpi-label">С markdown</div></div>
    <div class="kpi"><div class="kpi-val">${meta.ms ?? '—'}</div><div class="kpi-label">мс</div></div>`;
  } else if (meta.queriesRun != null) {
    kpiCols = `
    <div class="kpi"><div class="kpi-val">${items.length}</div><div class="kpi-label">Уник. ссылок</div></div>
    <div class="kpi"><div class="kpi-val">${meta.keywordsUsed ?? '—'}</div><div class="kpi-label">Ключ. слов</div></div>
    <div class="kpi"><div class="kpi-val">${meta.queriesRun ?? '—'}</div><div class="kpi-label">Запросов API</div></div>
    <div class="kpi"><div class="kpi-val">${meta.ms ?? '—'}</div><div class="kpi-label">мс</div></div>`;
  } else {
    kpiCols = `
    <div class="kpi"><div class="kpi-val">${items.length}</div><div class="kpi-label">Результатов</div></div>
    <div class="kpi"><div class="kpi-val">${withMd}</div><div class="kpi-label">С markdown</div></div>
    <div class="kpi"><div class="kpi-val">${meta.ms ?? '—'}</div><div class="kpi-label">мс</div></div>
    <div class="kpi"><div class="kpi-val">${meta.limit ?? '—'}</div><div class="kpi-label">Лимит</div></div>`;
  }
  document.getElementById('kpiRow').innerHTML = kpiCols;

  const list = document.getElementById('resultsList');
  if (!items.length) {
    const hints = [];
    if (meta.mode === 'crawl') {
      hints.push('Проверьте URL каталога, глубину ссылок и фильтры путей.');
      hints.push('1 страница = 1 кредит API. Начните с лимита 25–50.');
    } else if (meta.queryLen > MAX_SEARCH_QUERY) {
      hints.push(`Запрос ${meta.queryLen} символов — лимит API ${MAX_SEARCH_QUERY}. Сократите до ключевых слов.`);
    } else if (meta.queryLen > 120) {
      hints.push('Запрос слишком длинный для поиска — оставьте 5–15 ключевых слов.');
    }
    if (meta.domainsCount) {
      hints.push(`Фильтр по ${meta.domainsCount} доменам — убедитесь, что они указаны верно.`);
    }
    if (meta.scrape) {
      hints.push('Попробуйте снять «Загрузить полный текст» — иногда так быстрее находятся ссылки.');
    }
    hints.push('Поиск находит страницы в интернете, а не заполняет таблицы по инструкции.');
    list.innerHTML = `<p style="padding:1rem;color:var(--text-muted)">Ничего не найдено.</p>
      <ul style="padding:0 1.25rem 1rem;color:var(--text-muted);font-size:.82rem;line-height:1.6">
        ${hints.map(h => `<li>${esc(h)}</li>`).join('')}
      </ul>`;
    return;
  }

  list.innerHTML = items.map((item, idx) => {
    const md = item.markdown || item.content || '';
    return `<article class="result-item${idx === 0 ? ' open' : ''}" data-idx="${idx}">
      <div class="result-item-head">
        <div class="result-item-title">${esc(item.title || 'Без названия')}</div>
        <div class="result-item-url">${esc(item.url || item.sourceURL || '')}</div>
        ${item.searchKeyword ? `<div class="result-item-desc">Ключ: ${esc(item.searchKeyword)}</div>` : ''}
        ${item.description || item.snippet ? `<div class="result-item-desc">${esc(item.description || item.snippet)}</div>` : ''}
      </div>
      <div class="result-item-body">
        ${md ? `<pre>${esc(md)}</pre>` : '<p style="color:var(--text-muted);font-size:.82rem;margin-top:.75rem">Markdown не загружен. Включите «Загрузить полный текст» или откройте URL.</p>'}
      </div>
    </article>`;
  }).join('');

  list.querySelectorAll('.result-item-head').forEach(head => {
    head.addEventListener('click', () => head.parentElement.classList.toggle('open'));
  });

  lastPayload = { title, items, meta };

  if (meta.mode === 'research' && items.length > 0) {
    setAiTabVisible(true, true);
    showToast(`Исследование готово (${items.length} источников). Доступен AI-анализ →`);
  }
}

async 

function normalizeDomain(d) {
  return String(d).trim().replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
}

function parseDomainsInput(value) {
  return String(value || '')
    .split(/[\s,;]+/)
    .map(normalizeDomain)
    .filter(Boolean);
}





async 

async 

function parsePathPatterns(text) {
  return String(text || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
}

function buildCrawlPayload(body) {
  const payload = {
    url: body.url,
    limit: Math.max(1, Math.min(parseInt(body.limit, 10) || 50, 500)),
    maxDiscoveryDepth: Math.max(1, parseInt(body.maxDiscoveryDepth, 10) || 3),
    crawlEntireDomain: !!body.crawlEntireDomain
  };
  if (body.includePaths?.length) payload.includePaths = body.includePaths;
  if (body.excludePaths?.length) payload.excludePaths = body.excludePaths;
  if (body.scrape) payload.scrapeOptions = { formats: ['markdown'] };
  return payload;
}

async 

function normalizeCrawlPage(page) {
  const meta = page.metadata || {};
  return {
    title: meta.title || page.title || 'Без названия',
    url: meta.sourceURL || meta.url || page.url || '',
    description: meta.description || '',
    markdown: page.markdown || page.content || ''
  };
}

const PLATE_RX = /[ABEKMHOPCTYXАВЕКМНОРСТУХ]\d{3}[ABEKMHOPCTYXАВЕКМНОРСТУХ]{2}\d{2,3}/gi;

function extractPlateNumbers(text) {
  const found = new Set();
  const src = String(text || '');
  let m;
  const rx = new RegExp(PLATE_RX.source, PLATE_RX.flags);
  while ((m = rx.exec(src))) {
    found.add(m[0].toUpperCase().replace(/\s+/g, ''));
  }
  return [...found];
}

function collectPlatesFromItems(items) {
  const rows = [];
  const seen = new Set();
  for (const it of items) {
    const plates = extractPlateNumbers(`${it.title || ''}\n${it.markdown || ''}\n${it.description || ''}`);
    for (const plate of plates) {
      const key = `${plate}|${it.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ plate, url: it.url, title: it.title });
    }
  }
  return rows;
}

function setCrawlProgress(text) {
  const el = document.getElementById('crawlProgress');
  el.textContent = text;
  el.classList.add('visible');
}

function hideCrawlProgress() {
  document.getElementById('crawlProgress').classList.remove('visible');
}

async function waitForCrawl(jobId, onProgress) {
  const pages = [];
  let pollTarget = `/crawl/${jobId}`;
  let stagnant = 0;

  for (let i = 0; i < 240; i++) {
    const json = await firecrawlGet(pollTarget);
    if (Array.isArray(json.data)) pages.push(...json.data);

    const status = json.status || 'unknown';
    const completed = json.completed ?? pages.length;
    const total = json.total ?? json.limit ?? '?';
    onProgress?.(`Статус: ${status} · страниц ${completed}/${total}`);

    if (json.next) {
      pollTarget = json.next;
      stagnant = 0;
      continue;
    }

    if (status === 'completed') break;
    if (status === 'failed') throw new Error(json.error || 'Обход завершился с ошибкой');

    stagnant++;
    if (stagnant > 180) throw new Error('Превышено время ожидания обхода (9 мин)');

    pollTarget = `/crawl/${jobId}`;
    await new Promise(r => setTimeout(r, 3000));
  }

  return pages;
}

function loadCrawlPresetAuto() {
  document.getElementById('crawlUrl').value = 'https://auto-nomera.ru/';
  document.getElementById('crawlLimit').value = '50';
  document.getElementById('crawlDepth').value = '4';
  document.getElementById('crawlIncludePaths').value = '';
  document.getElementById('crawlExcludePaths').value = '';
  document.getElementById('crawlEntireDomain').checked = true;
  document.getElementById('crawlScrape').checked = true;
  document.getElementById('crawlExtractPlates').checked = true;
  document.querySelector('[data-tab="crawl"]').click();
}

async function doCrawl() {
  const url = document.getElementById('crawlUrl').value.trim();
  if (!url) { alert('Укажите URL каталога'); return; }
  if (!getApiKey()) { alert('Укажите API-ключ'); return; }

  const btn = document.getElementById('btnCrawl');
  btn.disabled = true;
  hideError();

  const body = {
    url,
    limit: Number(document.getElementById('crawlLimit').value),
    maxDiscoveryDepth: Number(document.getElementById('crawlDepth').value),
    crawlEntireDomain: document.getElementById('crawlEntireDomain').checked,
    scrape: document.getElementById('crawlScrape').checked,
    includePaths: parsePathPatterns(document.getElementById('crawlIncludePaths').value),
    excludePaths: parsePathPatterns(document.getElementById('crawlExcludePaths').value)
  };
  const extractPlates = document.getElementById('crawlExtractPlates').checked;

  runLoader('crawl', async () => {
    try {
      const t0 = performance.now();
      setCrawlProgress('Запуск обхода…');
      const started = await firecrawlCrawlStart(body);
      const jobId = started.id || started.jobId;
      if (!jobId) throw new Error('Не получен ID задачи обхода');

      const pages = await waitForCrawl(jobId, setCrawlProgress);
      const items = pages.map(normalizeCrawlPage).filter(it => it.url);
      const plateRows = extractPlates ? collectPlatesFromItems(items) : [];

      renderResults(`Обход: ${url}`, items, {
        ms: Math.round(performance.now() - t0),
        mode: 'crawl',
        limit: body.limit,
        platesCount: plateRows.length,
        plateRows
      });

      if (!items.length) {
        showError('Страницы не найдены. Увеличьте глубину, включите «Весь домен» или уберите фильтр путей.');
      } else if (extractPlates && !plateRows.length) {
        showError('Страницы собраны, но госномера в тексте не распознаны. Проверьте markdown или URL карточек объявлений.');
      }
    } catch (e) {
      showError(e.message || String(e));
      document.getElementById('resultsArea').style.display = 'block';
      document.getElementById('placeholder').style.display = 'none';
    } finally {
      hideLoader('crawl');
      hideCrawlProgress();
      btn.disabled = false;
    }
  });
}

function parseKeywordInput(value) {
  const out = [];
  for (const line of String(value || '').split(/\n+/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const cleaned = trimmed.replace(/^[-*•\d.)]+\s*/, '');
    if (/[,;]/.test(cleaned)) {
      cleaned.split(/[,;]+/).forEach(part => {
        const p = part.trim().replace(/^[-*•\d.)]+\s*/, '').replace(/^[«"']|[»"']$/g, '');
        if (p.length >= 2) out.push(p);
      });
    } else {
      const p = cleaned.replace(/^[«"']|[»"']$/g, '');
      if (p.length >= 2) out.push(p);
    }
  }
  return [...new Set(out)];
}

function extractKeywordsFromBrief(text) {
  const found = [];
  const re = /[«"']([^»"']{2,120})[»"']/g;
  let m;
  while ((m = re.exec(text))) found.push(m[1].trim());

  const section = text.match(/(?:ключевые\s+слова|поисковые\s+слова|теги|tags)\s*[:—]?\s*([\s\S]*?)(?:\n\s*\n|\n(?:период|приоритет|используй|домен|сайт)|$)/i);
  if (section) parseKeywordInput(section[1]).forEach(k => found.push(k));

  for (const line of text.split('\n')) {
    const bullet = line.match(/^[\s*\-•]+\s*(.+)$/);
    if (bullet) {
      const item = bullet[1].trim().replace(/^[`'«"]|[`'»"]$/g, '');
      if (item.length >= 2 && item.length <= 120 && !/\b[a-z0-9.-]+\.(?:ru|com|org|info)\b/i.test(item)) {
        parseKeywordInput(item).forEach(k => found.push(k));
      }
    }
  }
  return [...new Set(found)];
}

function extractCityFromBrief(text) {
  const patterns = [
    /(?:город[еу]?\s+|г\.\s*|в\s+)([а-яё\-]+(?:\s+[а-яё\-]+)?)/i,
    /(?:город[еу]?\s+|г\.\s*|в\s+)([A-Za-z\-]+)/i
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1].trim();
  }
  return '';
}

function generateSearchQueriesFromBrief(text) {
  const brief = String(text || '').trim();
  if (!brief) return [];

  const queries = [];
  const city = extractCityFromBrief(brief);
  const cityPart = city ? ` ${city}` : '';

  if (/аренд|квартир|снять|жил(?:ой|ого|ом)|недвижим/i.test(brief)) {
    const rooms = brief.match(/(?:не\s+)?(?:менее|от)\s*(\d+)\s*[-–]?\s*комнат/i) || brief.match(/(\d+)\s*[-–]?\s*комнат/i);
    const price = brief.match(/(?:не\s+)?(?:более|до|max)\s*([\d\s]{4,})\s*руб/i);
    const floor = brief.match(/(?:не\s+)?выше\s*(\d+)\s*этаж/i);

    const base = `аренда квартира${cityPart}`.trim();
    queries.push(base);
    if (rooms) queries.push(`аренда ${rooms[1]} комнатная квартира${cityPart}`.trim());
    if (/новый|новострой|новостройк/i.test(brief)) queries.push(`аренда квартира новостройка${cityPart}`.trim());
    if (price) queries.push(`снять квартиру${cityPart} до ${price[1].replace(/\s/g, '')}`.trim());
    if (floor) queries.push(`аренда квартира${cityPart} ${floor[1]} этаж`.trim());
    queries.push(`снять квартиру${cityPart}`.trim());
  } else if (/ваканс|работ|трудоустр|hr|персонал|сотрудник/i.test(brief)) {
    queries.push(`HR практики${cityPart}`.trim());
    if (/адаптац/i.test(brief)) queries.push(`адаптация сотрудников${cityPart}`.trim());
    if (/текучест/i.test(brief)) queries.push(`текучесть персонала${cityPart}`.trim());
  } else if (/ветеран|сво|участник/i.test(brief)) {
    queries.push(`трудоустройство ветеранов${cityPart}`.trim());
    queries.push(`адаптация участников СВО${cityPart}`.trim());
  }

  const stripped = brief
    .replace(/^(?:изучи|собери|найди|проанализируй|исследуй)\s+(?:вопрос\s+)?(?:с\s+)?/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (stripped.length >= 20 && stripped.length <= MAX_SEARCH_QUERY) {
    queries.push(stripped);
  } else if (stripped.length > MAX_SEARCH_QUERY) {
    brief.split(/[,;.\n]+/).map(s => s.trim()).filter(s => s.length >= 15 && s.length <= MAX_SEARCH_QUERY)
      .slice(0, 6)
      .forEach(s => queries.push(s.replace(/^(?:изучи|собери|найди)\s+/i, '')));
  }

  return [...new Set(queries.map(q => q.replace(/\s+/g, ' ').trim()).filter(q => {
    const words = q.split(/\s+/).filter(Boolean);
    return q.length >= 12 && words.length >= 2 && q.length <= MAX_SEARCH_QUERY;
  }))];
}

function buildKeywordsFromBrief(text) {
  const quoted = extractKeywordsFromBrief(text);
  const generated = generateSearchQueriesFromBrief(text);
  const merged = [...quoted];
  for (const q of generated) {
    if (!merged.some(k => k.toLowerCase() === q.toLowerCase())) merged.push(q);
  }
  return merged.filter(q => q.split(/\s+/).length >= 2 || q.length >= 15);
}

function isRealEstateBrief(text) {
  return /аренд|квартир|недвижим|снять\s+квар|жил(?:ой|ого)/i.test(text);
}

function urlMatchesBriefTopic(item, brief) {
  if (!brief || !isRealEstateBrief(brief)) return true;
  const blob = `${item.url || ''} ${item.title || ''} ${item.description || ''} ${item.snippet || ''}`.toLowerCase();
  if (/\/rabota|\/vakansii|\/resume|\/job|\/employer|ваканс|работа и ваканс|сборщик заказов|склад wildberries/i.test(blob)) {
    return false;
  }
  return /квартир|аренд|nedvizhimost|\/kvartiry|\/sdam|\/snimu|realty|недвижим|снять|комнат|жил/i.test(blob);
}

function extractDomainsFromBrief(text) {
  const found = new Set();
  const reList = [
    /`([a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:\.[a-z]{2,})?)`/gi,
    /\b([a-z0-9][a-z0-9.-]*\.(?:ru|com|info|org|gov\.ru))\b/gi
  ];
  for (const re of reList) {
    let m;
    const rx = new RegExp(re.source, re.flags);
    while ((m = rx.exec(text))) {
      const d = normalizeDomain(m[1]);
      if (d && !/\s/.test(d)) found.add(d);
    }
  }
  if (/ржд|rzd/i.test(text)) found.add('rzd.ru');
  if (/ростех|rostec/i.test(text)) found.add('rostec.ru');
  if (/россет/i.test(text)) found.add('rosseti.ru');
  return [...found];
}

function updateResearchKeywordCount() {
  const n = parseKeywordInput(document.getElementById('researchKeywords').value).length;
  const el = document.getElementById('researchKeywordCount');
  if (el) el.textContent = `В списке: ${n} ключевых слов`;
}

function initResearchKeywordCount() {
  const ta = document.getElementById('researchKeywords');
  ta.addEventListener('input', updateResearchKeywordCount);
  updateResearchKeywordCount();
}

function parseBriefFields(force = true) {
  const brief = document.getElementById('researchBrief').value;
  const kwEl = document.getElementById('researchKeywords');
  const domEl = document.getElementById('researchDomains');
  const keywords = buildKeywordsFromBrief(brief);
  const domains = extractDomainsFromBrief(brief);

  if (force || !kwEl.value.trim()) {
    if (keywords.length) kwEl.value = keywords.join('\n');
  }
  if (force || !domEl.value.trim()) {
    if (domains.length) domEl.value = domains.join(' ');
  }
  updateResearchKeywordCount();
  return { keywords, domains };
}

function normalizeHost(host) {
  return String(host || '').toLowerCase().replace(/^www\./, '');
}

function urlMatchesDomains(url, domains) {
  if (!url || !domains.length) return true;
  try {
    const host = normalizeHost(new URL(String(url).startsWith('http') ? url : `https://${url}`).hostname);
    return domains.some(d => {
      const dom = normalizeHost(normalizeDomain(d));
      return host === dom || host.endsWith(`.${dom}`);
    });
  } catch {
    return false;
  }
}

function buildResearchJobs(keywords, domains, broad) {
  const jobs = [];
  for (const kw of keywords) {
    if (domains.length) {
      jobs.push({
        query: kw,
        includeDomains: domains,
        label: `${kw} [${domains.slice(0, 3).join(', ')}${domains.length > 3 ? '…' : ''}]`,
        domainOnly: true
      });
    }
    if (broad || !domains.length) {
      jobs.push({
        query: kw,
        includeDomains: [],
        label: domains.length ? `${kw} (весь web)` : kw,
        domainOnly: false
      });
    }
  }
  return jobs;
}

function itemUrlKey(it) {
  return String(it.url || it.sourceURL || '').toLowerCase().replace(/\/+$/, '');
}

function mergeSearchItems(bucket, items, keyword) {
  const seen = new Set(bucket.map(itemUrlKey));
  for (const it of items) {
    const key = itemUrlKey(it);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    bucket.push({ ...it, searchKeyword: keyword });
  }
  return bucket;
}

function buildDateTbs(dateFromValue) {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const yyyy = today.getFullYear();
  let cdMin = '01/01/2023';
  if (dateFromValue) {
    const [y, m, d] = dateFromValue.split('-');
    if (y && m && d) cdMin = `${m}/${d}/${y}`;
  }
  return `cdr:1,cd_min:${cdMin},cd_max:${mm}/${dd}/${yyyy}`;
}

function syncResearchDateFilter() {
  const enabled = document.getElementById('researchDateFilter').checked;
  document.getElementById('researchDateFrom').disabled = !enabled;
}

function initResearchDatePicker() {
  const input = document.getElementById('researchDateFrom');
  input.max = new Date().toISOString().slice(0, 10);
  document.getElementById('researchDateFilter').addEventListener('change', syncResearchDateFilter);
  syncResearchDateFilter();
}

function setResearchProgress(text) {
  const el = document.getElementById('researchProgress');
  el.textContent = text;
  el.classList.add('visible');
}

function hideResearchProgress() {
  document.getElementById('researchProgress').classList.remove('visible');
}

async function doResearch() {
  if (!getApiKey()) {
    alert('Укажите API-ключ');
    return;
  }

  const brief = document.getElementById('researchBrief').value.trim();
  let keywords = parseKeywordInput(document.getElementById('researchKeywords').value);
  const domains = parseDomainsInput(document.getElementById('researchDomains').value);
  const limit = Number(document.getElementById('researchLimit').value);
  const maxQueriesRaw = Number(document.getElementById('researchMaxQueries').value);
  const scrape = document.getElementById('researchScrape').checked;
  const dateFilter = document.getElementById('researchDateFilter').checked;
  const dateFrom = document.getElementById('researchDateFrom').value;
  const broad = document.getElementById('researchBroad').checked;

  if (!keywords.length && brief) {
    keywords = buildKeywordsFromBrief(brief);
    if (keywords.length) {
      document.getElementById('researchKeywords').value = keywords.join('\n');
      updateResearchKeywordCount();
    }
  }

  if (!keywords.length) {
    alert('Не найдены ключевые слова. Нажмите «Сформировать запросы» или заполните список вручную.');
    return;
  }

  const weakOnly = keywords.every(k => k.split(/\s+/).length < 2);
  if (weakOnly && brief) {
    keywords = buildKeywordsFromBrief(brief);
    document.getElementById('researchKeywords').value = keywords.join('\n');
    updateResearchKeywordCount();
  }

  const maxQueries = maxQueriesRaw > 0 ? maxQueriesRaw : keywords.length;

  const kwSlice = keywords.slice(0, maxQueries);
  const jobs = buildResearchJobs(kwSlice, domains, broad);

  if (!jobs.length) {
    alert('Нет запросов для запуска. Добавьте ключевые слова или домены.');
    return;
  }

  const domainNote = domains.length && !broad
    ? `\nТолько домены: ${domains.slice(0, 8).join(', ')}${domains.length > 8 ? '…' : ''}`
    : domains.length && broad
      ? '\n⚠ Включён доп. поиск по всему интернету — будут и другие сайты'
      : '\nПоиск по всему интернету';

  if (kwSlice.length > 20 || jobs.length > 25) {
    const ok = confirm(
      `Запуск исследования:\n• Ключевых слов: ${kwSlice.length} из ${keywords.length}\n• API-запросов: ${jobs.length}${domainNote}\n\nЭто займёт несколько минут. Продолжить?`
    );
    if (!ok) return;
  } else if (domains.length && broad) {
    const ok = confirm(
      `Включён «Доп. поиск без фильтра доменов» — часть результатов будет с других сайтов, не только: ${domains.slice(0, 5).join(', ')}${domains.length > 5 ? '…' : ''}.\n\nПродолжить?`
    );
    if (!ok) return;
  }
  const btn = document.getElementById('btnResearch');
  btn.disabled = true;
  hideError();
  const allItems = [];
  let queriesRun = 0;
  let errors = 0;
  const t0 = performance.now();

  runLoader('research', async () => {
    try {
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        setResearchProgress(`Запрос ${i + 1} из ${jobs.length}: «${job.label.slice(0, 60)}»…`);
        try {
          const body = {
            query: job.query.slice(0, MAX_SEARCH_QUERY),
            limit,
            scrape,
            lang: 'ru',
            sources: ['web'],
            tbs: dateFilter ? buildDateTbs(dateFrom) : undefined
          };
          if (job.includeDomains.length) body.includeDomains = job.includeDomains;
          const json = await firecrawlRequest('search', body);
          let items = normalizeItems(json.data);
          if (job.domainOnly && job.includeDomains.length) {
            items = items.filter(it => urlMatchesDomains(it.url || it.sourceURL, job.includeDomains));
          }
          mergeSearchItems(allItems, items, job.label);
          queriesRun++;
        } catch (e) {
          errors++;
          console.warn('Search failed:', job.label, e);
        }
        if (i < jobs.length - 1) await new Promise(r => setTimeout(r, 350));
      }

      let finalItems = allItems;
      let filteredOut = 0;
      if (domains.length && !broad) {
        const before = finalItems.length;
        finalItems = finalItems.filter(it => urlMatchesDomains(it.url || it.sourceURL, domains));
        filteredOut += before - finalItems.length;
      }
      if (brief) {
        const beforeTopic = finalItems.length;
        finalItems = finalItems.filter(it => urlMatchesBriefTopic(it, brief));
        filteredOut += beforeTopic - finalItems.length;
      }

      renderResults(`Исследование: ${kwSlice.length} из ${keywords.length} ключевых слов`, finalItems, {
        ms: Math.round(performance.now() - t0),
        queriesRun,
        errors,
        limit,
        mode: 'research',
        keywordsUsed: kwSlice.length,
        keywordsTotal: keywords.length,
        domains: domains.length ? domains.join(', ') : 'весь web',
        domainsStrict: domains.length > 0 && !broad,
        filteredOut,
        researchBrief: document.getElementById('researchBrief').value.trim()
      });

      if (filteredOut > 0) {
        showError(`Отфильтровано ${filteredOut} нерелевантных ссылок (чужие домены или не по теме задания).`);
      }
      if (errors) {
        showError(`Часть запросов завершилась с ошибкой: ${errors} из ${jobs.length}. Проверьте баланс кредитов API.`);
      }
      if (!finalItems.length) {
        showError('Ссылки не найдены. Попробуйте снять фильтр доменов или отключить фильтр по дате.');
      }
    } catch (e) {
      showError(e.message || String(e));
      document.getElementById('resultsArea').style.display = 'block';
      document.getElementById('placeholder').style.display = 'none';
    } finally {
      hideLoader('research');
      hideResearchProgress();
      btn.disabled = false;
    }
  });
}

function loadHrTemplate(switchTab = false) {
  document.getElementById('researchBrief').value = HR_RESEARCH_BRIEF;
  document.getElementById('researchKeywords').value = HR_RESEARCH_KEYWORDS;
  document.getElementById('researchDomains').value = HR_RESEARCH_DOMAINS;
  document.getElementById('researchMaxQueries').value = '0';
  document.getElementById('researchBroad').checked = false;
  updateResearchKeywordCount();
  if (switchTab) document.querySelector('[data-tab="research"]').click();
}

function loadSvoTemplate(switchTab = true) {
  document.getElementById('researchBrief').value = SVO_RESEARCH_BRIEF;
  parseBriefFields(true);
  document.getElementById('researchMaxQueries').value = '0';
  document.getElementById('researchBroad').checked = false;
  updateResearchKeywordCount();
  if (switchTab) document.querySelector('[data-tab="research"]').click();
}

async function doSearch() {
  const query = document.getElementById('searchQuery').value.trim();
  if (!query) { alert('Введите поисковый запрос'); return; }
  if (query.length > MAX_SEARCH_QUERY) {
    showError(`Запрос ${query.length} символов — лимит API ${MAX_SEARCH_QUERY}. Перейдите на вкладку «Исследование» для длинных заданий.`);
    document.getElementById('resultsArea').style.display = 'block';
    document.getElementById('placeholder').style.display = 'none';
    document.querySelector('[data-tab="research"]').click();
    return;
  }

  const btn = document.getElementById('btnSearch');
  btn.disabled = true;
  hideError();

  const sources = [];
  if (document.getElementById('srcWeb').checked) sources.push('web');
  if (document.getElementById('srcNews').checked) sources.push('news');

  const body = {
    query,
    limit: Number(document.getElementById('searchLimit').value),
    scrape: document.getElementById('searchScrape').checked,
    lang: document.getElementById('searchLang').value || undefined,
    sources: sources.length ? sources : ['web']
  };
  const domains = parseDomainsInput(document.getElementById('includeDomains').value);
  if (domains.length) body.includeDomains = domains;

  runLoader('search', async () => {
    try {
      const t0 = performance.now();
      const json = await firecrawlRequest('search', body);
      const items = normalizeItems(json.data);
      renderResults(`Поиск: «${query.slice(0, 80)}${query.length > 80 ? '…' : ''}»`, items, {
        ms: Math.round(performance.now() - t0),
        queryLen: query.length,
        domainsCount: domains.length,
        scrape: body.scrape,
        limit: body.limit
      });
    } catch (e) {
      showError(e.message || String(e));
      document.getElementById('resultsArea').style.display = 'block';
      document.getElementById('placeholder').style.display = 'none';
    } finally {
      hideLoader('search');
      btn.disabled = false;
    }
  });
}

async function doScrape() {
  const url = document.getElementById('scrapeUrl').value.trim();
  if (!url) { alert('Введите URL'); return; }

  const formats = [];
  if (document.getElementById('fmtMarkdown').checked) formats.push('markdown');
  if (document.getElementById('fmtLinks').checked) formats.push('links');
  if (document.getElementById('fmtHtml').checked) formats.push('html');
  if (!formats.length) formats.push('markdown');

  const btn = document.getElementById('btnScrape');
  btn.disabled = true;
  hideError();

  runLoader('scrape', async () => {
    try {
      const t0 = performance.now();
      const json = await firecrawlRequest('scrape', { url, formats });
      const doc = json.data || {};
      const items = [{
        title: doc.metadata?.title || url,
        url: doc.metadata?.sourceURL || url,
        description: doc.metadata?.description || '',
        markdown: doc.markdown || '',
        links: doc.links || []
      }];
      renderResults(`Страница: ${url}`, items, { ms: Math.round(performance.now() - t0) });
    } catch (e) {
      showError(e.message || String(e));
      document.getElementById('resultsArea').style.display = 'block';
      document.getElementById('placeholder').style.display = 'none';
    } finally {
      hideLoader('scrape');
      btn.disabled = false;
    }
  });
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    btn.classList.remove('tab-new');
    updateResultsViewForTab(btn.dataset.tab);
    if (btn.dataset.tab !== 'ai') {
      document.getElementById('resultsTitle').textContent = lastPayload?.title || 'Результаты';
    }
  });
});

document.getElementById('btnAiAnalyze').addEventListener('click', doAiAnalyze);
document.getElementById('btnAiCopyPrompt').addEventListener('click', copyAiPrompt);
document.getElementById('openaiKey').addEventListener('change', saveOpenAiKey);

document.getElementById('btnSearch').addEventListener('click', doSearch);
document.getElementById('btnResearch').addEventListener('click', doResearch);
document.getElementById('btnCrawl').addEventListener('click', doCrawl);
document.getElementById('btnCrawlPresetAuto').addEventListener('click', loadCrawlPresetAuto);
document.getElementById('btnLoadHrTemplate').addEventListener('click', () => loadHrTemplate(true));
document.getElementById('btnLoadSvoTemplate').addEventListener('click', () => loadSvoTemplate(true));
document.getElementById('btnParseBriefFields').addEventListener('click', () => {
  const { keywords, domains } = parseBriefFields(true);
  if (!keywords.length && !domains.length) {
    alert('Не удалось собрать запросы из задания. Добавьте ключевые слова вручную (фразы из 2+ слов).');
  } else if (keywords.length) {
    showToast(`Сформировано ${keywords.length} поисковых запросов`);
  }
});
document.getElementById('btnScrape').addEventListener('click', doScrape);
document.getElementById('apiKey').addEventListener('change', saveApiKey);

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), 2800);
}

function flashButton(btn) {
  btn.classList.add('flash-ok');
  setTimeout(() => btn.classList.remove('flash-ok'), 1200);
}

function buildMarkdownExport() {
  if (!lastPayload?.items?.length) return '';
  return lastPayload.items.map((it, i) =>
    `# ${i + 1}. ${it.title || it.url || 'Без названия'}\n${it.url || it.sourceURL || ''}\n\n${it.markdown || it.content || it.description || '_нет текста_'}`
  ).join('\n\n---\n\n');
}

function downloadTextFile(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

document.getElementById('btnCopyJson').addEventListener('click', async () => {
  if (!lastPayload?.items?.length) {
    showToast('Нет данных — сначала выполните поиск или обход');
    return;
  }
  const btn = document.getElementById('btnCopyJson');
  try {
    await navigator.clipboard.writeText(JSON.stringify(lastPayload, null, 2));
    flashButton(btn);
    showToast('JSON скопирован в буфер обмена');
  } catch {
    showToast('Не удалось скопировать — разрешите доступ к буферу');
  }
});

document.getElementById('btnCopyMd').addEventListener('click', () => {
  if (document.getElementById('tabAiBtn').classList.contains('active') && lastAiReport) {
    downloadTextFile(lastAiReport, `AI_анализ_${new Date().toISOString().slice(0, 10)}.md`);
    flashButton(document.getElementById('btnCopyMd'));
    showToast('Отчёт AI-анализа скачан');
    return;
  }
  if (!lastPayload?.items?.length) {
    showToast('Нет данных — сначала выполните поиск или обход');
    return;
  }
  const md = buildMarkdownExport();
  const hasText = lastPayload.items.some(i => String(i.markdown || i.content || '').trim().length > 0);
  if (!hasText) {
    showToast('Markdown пуст — включите «Markdown каждой страницы» при обходе');
    return;
  }
  const safeName = (lastPayload.title || 'firecrawl')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 40);
  downloadTextFile(md, `${safeName}_${new Date().toISOString().slice(0, 10)}.md`);
  flashButton(document.getElementById('btnCopyMd'));
  showToast(`Файл .md скачан (${lastPayload.items.length} стр.)`);
});

function cellText(value, max = 32000) {
  const text = String(value ?? '');
  return text.length > max ? text.slice(0, max) + '… [обрезано для Excel]' : text;
}

function exportToExcel() {
  if (!lastPayload?.items?.length) {
    alert('Нет данных для экспорта. Сначала выполните поиск или парсинг.');
    return;
  }
  if (typeof XLSX === 'undefined') {
    alert('Библиотека Excel не загрузилась. Проверьте интернет и обновите страницу.');
    return;
  }

  const exportedAt = new Date().toLocaleString('ru-RU');
  const isCrawl = lastPayload.meta?.mode === 'crawl';

  const rows = isCrawl
    ? [
        ['№', 'Госномер', 'Заголовок', 'URL', 'Описание', 'Текст (markdown)', 'Дата выгрузки'],
        ...lastPayload.items.map((it, i) => [
          i + 1,
          cellText((it.plates || extractPlateNumbers(`${it.title}\n${it.markdown}`)).join(', '), 100),
          cellText(it.title || 'Без названия', 500),
          cellText(it.url || it.sourceURL || '', 2000),
          cellText(it.description || it.snippet || '', 2000),
          cellText(it.markdown || it.content || '', 32000),
          exportedAt
        ])
      ]
    : [
        ['№', 'Ключевой запрос', 'Заголовок', 'URL', 'Описание', 'Текст (markdown)', 'Дата выгрузки'],
        ...lastPayload.items.map((it, i) => [
          i + 1,
          cellText(it.searchKeyword || '', 200),
          cellText(it.title || 'Без названия', 500),
          cellText(it.url || it.sourceURL || '', 2000),
          cellText(it.description || it.snippet || '', 2000),
          cellText(it.markdown || it.content || '', 32000),
          exportedAt
        ])
      ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = isCrawl
    ? [{ wch: 5 }, { wch: 14 }, { wch: 42 }, { wch: 48 }, { wch: 50 }, { wch: 90 }, { wch: 18 }]
    : [{ wch: 5 }, { wch: 28 }, { wch: 42 }, { wch: 48 }, { wch: 50 }, { wch: 90 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isCrawl ? 'Страницы' : 'Ссылки');

  if (isCrawl && lastPayload.meta?.plateRows?.length) {
    const plateSheet = [
      ['№', 'Госномер', 'URL', 'Заголовок страницы'],
      ...lastPayload.meta.plateRows.map((row, i) => [i + 1, row.plate, row.url, row.title || ''])
    ];
    const wsPlates = XLSX.utils.aoa_to_sheet(plateSheet);
    wsPlates['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 52 }, { wch: 42 }];
    XLSX.utils.book_append_sheet(wb, wsPlates, 'Номера');
  }

  if (!isCrawl) {
    const templateHeader = ['№', ...PRACTICE_COLUMNS];
    const templateRows = [templateHeader];
    lastPayload.items.forEach((it, i) => {
      const row = new Array(templateHeader.length).fill('');
      row[0] = i + 1;
      row[4] = it.title || '';
      row[6] = it.url || it.sourceURL || '';
      templateRows.push(row);
    });
    const wsTemplate = XLSX.utils.aoa_to_sheet(templateRows);
    wsTemplate['!cols'] = [{ wch: 4 }, ...PRACTICE_COLUMNS.map(() => ({ wch: 22 }))];
    XLSX.utils.book_append_sheet(wb, wsTemplate, 'Практики_36_колонок');
  }

  const infoRows = [
    ['Параметр', 'Значение'],
    ['Источник запроса', lastPayload.title || ''],
    ['Количество записей', lastPayload.items.length],
    ['С markdown', lastPayload.items.filter(i => i.markdown || i.content).length],
    ['Номеров (уник.)', lastPayload.meta?.platesCount ?? ''],
    ['Запросов API', lastPayload.meta?.queriesRun ?? ''],
    ['Лимит страниц', lastPayload.meta?.limit ?? ''],
    ['Время ответа, мс', lastPayload.meta?.ms ?? ''],
    ['Дата выгрузки', exportedAt],
    ['Примечание', isCrawl ? 'Обход каталога по ссылкам' : 'Колонки 1–36 заполняются вручную или через AI']
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(infoRows);
  wsInfo['!cols'] = [{ wch: 22 }, { wch: 60 }];

  XLSX.utils.book_append_sheet(wb, wsInfo, 'Сводка');

  const safeName = (lastPayload.title || 'firecrawl')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 40);
  const fileName = `${safeName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  flashButton(document.getElementById('btnExportExcel'));
  showToast(`Excel сохранён: ${fileName}`);
}

document.getElementById('btnExportExcel').addEventListener('click', exportToExcel);

async function checkServer() {
  const status = document.getElementById('serverStatus');
  const banner = document.getElementById('serverBanner');

  if (USE_LOCAL_PROXY) {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { cache: 'no-store' });
      if (!res.ok) throw new Error('offline');
      const data = await res.json();
      status.innerHTML = '<span class="dot ok"></span>Локальный сервер';
      banner.classList.add('ok');
      banner.innerHTML = `Локальный режим. Ключ — в поле слева или в <code>FIRECRAWL_API_KEY</code>.`;
    } catch {
      status.innerHTML = '<span class="dot"></span>Сервер не найден';
    }
    return;
  }

  status.innerHTML = '<span class="dot ok"></span>Онлайн-режим';
  banner.classList.add('ok');
  banner.innerHTML = `Введите API-ключ слева и нажмите «Найти» или «Распарсить». Экспорт в Excel — кнопкой справа над результатами.`;
}

loadOpenAiKey();
initResearchDatePicker();
initResearchKeywordCount();
checkServer();
