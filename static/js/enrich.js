import { USE_LOCAL_PROXY } from './config.js';
import { scrapeSmart } from './api.js';
import { getLastPayload, setLastPayload } from './state.js';
import { esc, showToast } from './ui.js';
import { getApiKey } from './storage.js';

function emptyMarkdownHint(mode) {
  if (mode === 'research') {
    return {
      text: 'Текст страницы не загружен. В исследовании слева включите галочку «Загрузить markdown» и запустите снова — или догрузите одну страницу кнопкой ниже.',
      checkbox: 'Загрузить markdown (медленнее, больше кредитов)'
    };
  }
  if (mode === 'crawl') {
    return {
      text: 'Текст страницы не загружен. Во вкладке «Обход каталога» включите галочку «Markdown каждой страницы» или догрузите страницу кнопкой ниже.',
      checkbox: 'Markdown каждой страницы'
    };
  }
  return {
    text: 'Текст страницы не загружен. Это не отдельная кнопка: во вкладке «Поиск» слева есть галочка «Загрузить полный текст (markdown)». Либо догрузите только эту страницу:',
    checkbox: 'Загрузить полный текст (markdown)'
  };
}

export function markdownPlaceholderHtml(mode) {
  const hint = emptyMarkdownHint(mode);
  const canLoad = USE_LOCAL_PROXY || !!getApiKey();
  return `<div class="md-missing">
    <p>${esc(hint.text)}</p>
    <p class="hint">Ищите галочку: «${esc(hint.checkbox)}»</p>
    ${
      canLoad
        ? `<button type="button" class="btn-sm btn-load-md" data-tip="Скачает markdown только для этой ссылки (Firecrawl → curl_cffi → браузер)">Догрузить текст этой страницы</button>`
        : `<p class="hint">Чтобы догрузить здесь: укажите API-ключ или запустите python server.py</p>`
    }
  </div>`;
}

export async function enrichItemMarkdown(idx, btn) {
  const payload = getLastPayload();
  if (!payload?.items?.[idx]) {
    showToast('Нет данных результата');
    return;
  }
  const item = payload.items[idx];
  const url = item.url || item.sourceURL;
  if (!url) {
    showToast('У результата нет URL');
    return;
  }

  const label = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Загрузка…';
  }

  try {
    const json = await scrapeSmart(url, ['markdown', 'html', 'links']);
    const doc = json.data || {};
    const md = doc.markdown || '';
    if (!md.trim()) throw new Error('Движки вернули пустой текст');

    payload.items[idx] = {
      ...item,
      title: doc.metadata?.title || item.title,
      url: doc.metadata?.sourceURL || url,
      markdown: md,
      links: doc.links || item.links || [],
      enrichedEngine: json._meta?.engine
    };
    setLastPayload({ ...payload, items: [...payload.items] });

    const article = document.querySelector(`.result-item[data-idx="${idx}"]`);
    const body = article?.querySelector('.result-item-body');
    if (body) {
      const engine = json._meta?.engine || 'scrape';
      body.innerHTML = `<p class="hint">Догружено через ${esc(engine)}</p><pre>${esc(md)}</pre>`;
    }
    article?.classList.add('open');
    showToast(`Текст загружен (${json._meta?.engine || 'ok'})`);
  } catch (e) {
    showToast(e.message || String(e));
    if (btn) {
      btn.disabled = false;
      btn.textContent = label || 'Догрузить текст этой страницы';
    }
  }
}

export function bindEnrichButtons(listEl) {
  listEl.querySelectorAll('.btn-load-md').forEach((btn) => {
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const article = btn.closest('.result-item');
      const idx = Number(article?.dataset?.idx);
      if (Number.isNaN(idx)) return;
      enrichItemMarkdown(idx, btn);
    });
  });
}
