const data = window.TOOLBOX_DATA;

const state = {
  query: "",
  favoritesOnly: false,
  favorites: new Set(JSON.parse(localStorage.getItem("toolbox-favorites") || "[]")),
  theme: localStorage.getItem("toolbox-theme") || "light",
};

const runtime = {
  cleanups: [],
};

const dom = {
  body: document.body,
  sidebar: document.getElementById("sidebar"),
  categoryNav: document.getElementById("categoryNav"),
  summaryTags: document.getElementById("summaryTags"),
  featuredStrip: document.getElementById("featuredStrip"),
  toolSections: document.getElementById("toolSections"),
  toolSearch: document.getElementById("toolSearch"),
  favoritesToggle: document.getElementById("favoritesToggle"),
  themeToggle: document.getElementById("themeToggle"),
  openFeatured: document.getElementById("openFeatured"),
  menuButton: document.getElementById("menuButton"),
  toolCount: document.getElementById("toolCount"),
  categoryCount: document.getElementById("categoryCount"),
  favoriteCount: document.getElementById("favoriteCount"),
  implementedCount: document.getElementById("implementedCount"),
  bjTime: document.getElementById("bjTime"),
  bjDate: document.getElementById("bjDate"),
  resultsTitle: document.getElementById("resultsTitle"),
  resultsMeta: document.getElementById("resultsMeta"),
  toolModal: document.getElementById("toolModal"),
  modalContent: document.getElementById("modalContent"),
  modalClose: document.getElementById("modalClose"),
};

const categoryMap = new Map(data.categories.map((category) => [category.id, category]));
const toolMap = new Map(data.tools.map((tool) => [tool.id, tool]));

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function persistFavorites() {
  localStorage.setItem("toolbox-favorites", JSON.stringify([...state.favorites]));
}

function saveTheme() {
  localStorage.setItem("toolbox-theme", state.theme);
}

function registerCleanup(fn) {
  runtime.cleanups.push(fn);
}

function clearRuntime() {
  while (runtime.cleanups.length) {
    const cleanup = runtime.cleanups.pop();
    try {
      cleanup();
    } catch (error) {
      console.error(error);
    }
  }
}

function formatDateTime(date, options) {
  return new Intl.DateTimeFormat("zh-CN", options).format(date);
}

function formatShanghaiClock() {
  const now = new Date();
  dom.bjTime.textContent = formatDateTime(now, {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  dom.bjDate.textContent = formatDateTime(now, {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

function getCategoryTools(categoryId, source = data.tools) {
  return source.filter((tool) => tool.category === categoryId);
}

function matchesQuery(tool, query) {
  if (!query) return true;
  const normalized = query.trim().toLowerCase();
  const haystack = [tool.title, tool.description, ...(tool.tags || [])].join(" ").toLowerCase();
  return haystack.includes(normalized);
}

function getFilteredTools() {
  return data.tools.filter((tool) => {
    const matchQuery = matchesQuery(tool, state.query);
    const matchFavorites = !state.favoritesOnly || state.favorites.has(tool.id);
    return matchQuery && matchFavorites;
  });
}

function renderSummary() {
  dom.summaryTags.innerHTML = data.summary
    .map((item) => `<span class="pill">${escapeHtml(item)}</span>`)
    .join("");
}

function renderSidebar(filteredTools) {
  dom.categoryNav.innerHTML = data.categories
    .map((category) => {
      const count = getCategoryTools(category.id, filteredTools).length;
      return `
        <a class="category-link" href="#section-${category.id}" data-category-link="${category.id}">
          <span>
            <span class="category-icon">${escapeHtml(category.icon)}</span>
            ${escapeHtml(category.name)}
          </span>
          <strong>${count}</strong>
        </a>
      `;
    })
    .join("");
}

function renderFeatured(filteredTools) {
  const featuredTools = data.featuredToolIds
    .map((id) => toolMap.get(id))
    .filter(Boolean)
    .filter((tool) => filteredTools.includes(tool));

  dom.featuredStrip.innerHTML = featuredTools
    .map((tool) => {
      const category = categoryMap.get(tool.category);
      return `
        <article class="featured-card">
          <p class="tool-card-category">${escapeHtml(category?.name || "工具")}</p>
          <h3>${escapeHtml(tool.title)}</h3>
          <p>${escapeHtml(tool.description)}</p>
          <button class="tool-action primary" data-open-tool="${tool.id}">打开工具</button>
        </article>
      `;
    })
    .join("");
}

function renderSections(filteredTools) {
  const sections = data.categories
    .map((category) => {
      const tools = getCategoryTools(category.id, filteredTools);
      if (!tools.length) return "";

      const cards = tools
        .map((tool) => {
          const isFavorite = state.favorites.has(tool.id);
          return `
            <article class="tool-card">
              <div class="tool-card-top">
                <span class="tool-card-category">${escapeHtml(category.name)}</span>
                <button
                  class="favorite-button ${isFavorite ? "active" : ""}"
                  data-favorite-tool="${tool.id}"
                  aria-label="${isFavorite ? "取消收藏" : "收藏工具"}"
                >
                  ★
                </button>
              </div>
              <div>
                <h3>${escapeHtml(tool.title)}</h3>
                <p>${escapeHtml(tool.description)}</p>
              </div>
              <div class="tool-tags">
                ${(tool.tags || [])
                  .map((tag) => `<span class="tool-tag">${escapeHtml(tag)}</span>`)
                  .join("")}
              </div>
              <div class="tool-card-bottom">
                <span class="tool-meta">${tool.implemented ? "可立即使用" : "扩展位保留"}</span>
                <button class="tool-action ${tool.implemented ? "primary" : ""}" data-open-tool="${tool.id}">
                  ${tool.implemented ? "打开工具" : "查看规划"}
                </button>
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <section class="tool-section" id="section-${category.id}">
          <div class="section-heading">
            <div>
              <p class="summary-label">${escapeHtml(category.icon)}</p>
              <h3>${escapeHtml(category.name)}</h3>
              <p class="section-subtitle">${escapeHtml(category.description)}</p>
            </div>
            <span class="pill">${tools.length} 个工具</span>
          </div>
          <div class="tool-grid">${cards}</div>
        </section>
      `;
    })
    .join("");

  dom.toolSections.innerHTML = sections || `<div class="tool-card-empty">当前筛选条件下没有匹配工具。</div>`;
}

function updateStats(filteredTools) {
  dom.toolCount.textContent = String(data.tools.length);
  dom.categoryCount.textContent = String(data.categories.length);
  dom.favoriteCount.textContent = String(state.favorites.size);
  dom.implementedCount.textContent = String(data.tools.filter((tool) => tool.implemented).length);

  dom.resultsTitle.textContent = state.query
    ? `搜索结果：${state.query}`
    : state.favoritesOnly
      ? "收藏工具"
      : "全部工具";

  dom.resultsMeta.textContent = `当前显示 ${filteredTools.length} / ${data.tools.length} 个工具${state.favoritesOnly ? "，已启用收藏筛选" : ""}。`;
  dom.favoritesToggle.textContent = state.favoritesOnly ? "显示全部" : "只看收藏";
  dom.themeToggle.textContent = state.theme === "dark" ? "浅色模式" : "深色模式";
}

function render() {
  const filteredTools = getFilteredTools();
  renderSidebar(filteredTools);
  renderFeatured(filteredTools);
  renderSections(filteredTools);
  updateStats(filteredTools);
}

function setTheme(theme) {
  state.theme = theme;
  dom.body.dataset.theme = theme;
  saveTheme();
  updateStats(getFilteredTools());
}

function closeModal() {
  clearRuntime();
  dom.toolModal.classList.add("hidden");
  dom.modalContent.innerHTML = "";
}

function setOutput(root, selector, value) {
  const target = root.querySelector(selector);
  if (target) target.textContent = value;
}

function setHtml(root, selector, value) {
  const target = root.querySelector(selector);
  if (target) target.innerHTML = value;
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(base64) {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function safeParseExpression(input) {
  const sanitized = input.replace(/\s+/g, "").replace(/%/g, "/100");
  if (!/^[0-9+\-*/()./]+$/.test(sanitized)) {
    throw new Error("只支持数字和 + - * / % ()");
  }
  // eslint-disable-next-line no-new-func
  return Function(`return (${sanitized})`)();
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function parseHexColor(hex) {
  const clean = hex.trim().replace("#", "");
  if (!/^[\da-fA-F]{6}$/.test(clean)) return null;
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Number(value) || 0)).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function luminance({ r, g, b }) {
  const normalize = (value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * normalize(r) + 0.7152 * normalize(g) + 0.0722 * normalize(b);
}

function contrastRatio(colorA, colorB) {
  const lighter = Math.max(luminance(colorA), luminance(colorB));
  const darker = Math.min(luminance(colorA), luminance(colorB));
  return (lighter + 0.05) / (darker + 0.05);
}

function datetimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function shaDigest(text, algorithm) {
  const dataBuffer = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest(algorithm, dataBuffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const answers = [
  "是的，先开始再优化。",
  "今天更适合稳一点。",
  "值得一试，但记得留后手。",
  "把目标拆小以后再做决定。",
  "现在不必追求完美。",
  "先休息十分钟，你会更清楚。",
  "答案偏向肯定。",
  "换个时间再问一次也没关系。",
];

const toolDefinitions = {
  calculator: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>输入表达式</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>例如：128*(1+15%)-36/3</label>
                <input data-field="expression" placeholder="请输入表达式" value="128*(1+15%)-36/3" />
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="calculate">立即计算</button>
                <button class="tool-action" data-action="clear">清空</button>
              </div>
              <div class="tool-output" data-output="result">等待计算…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>适用场景</h4>
            <ul>
              <li>日常快速计算</li>
              <li>带括号的表达式推演</li>
              <li>百分比近似换算</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const expression = root.querySelector('[data-field="expression"]');
      const output = root.querySelector('[data-output="result"]');
      root.querySelector('[data-action="calculate"]').addEventListener("click", () => {
        try {
          const result = safeParseExpression(expression.value);
          output.textContent = `结果：${Number(result).toLocaleString("zh-CN", { maximumFractionDigits: 8 })}`;
        } catch (error) {
          output.textContent = `计算失败：${error.message}`;
        }
      });
      root.querySelector('[data-action="clear"]').addEventListener("click", () => {
        expression.value = "";
        output.textContent = "已清空。";
      });
    },
  },
  pomodoro: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>专注设置</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>专注时长（分钟）</label>
                  <input data-field="work" type="number" min="1" value="25" />
                </div>
                <div class="field-stack">
                  <label>休息时长（分钟）</label>
                  <input data-field="rest" type="number" min="1" value="5" />
                </div>
              </div>
              <div class="big-display" data-output="timer">25:00</div>
              <div class="progress-bar"><span data-output="progress"></span></div>
              <div class="split-note">
                <span data-output="status">当前状态：专注</span>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="start">开始</button>
                <button class="tool-action" data-action="pause">暂停</button>
                <button class="tool-action" data-action="reset">重置</button>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>建议节奏</h4>
            <ul>
              <li>25 分钟专注 + 5 分钟休息</li>
              <li>完成 4 轮后安排一次长休息</li>
              <li>适合写作、编码、复习等场景</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const workInput = root.querySelector('[data-field="work"]');
      const restInput = root.querySelector('[data-field="rest"]');
      const timer = root.querySelector('[data-output="timer"]');
      const status = root.querySelector('[data-output="status"]');
      const progress = root.querySelector('[data-output="progress"]');
      let phase = "work";
      let totalSeconds = Number(workInput.value) * 60;
      let remaining = totalSeconds;
      let intervalId = null;

      const syncDisplay = () => {
        const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
        const ss = String(remaining % 60).padStart(2, "0");
        timer.textContent = `${mm}:${ss}`;
        progress.style.width = `${((totalSeconds - remaining) / Math.max(totalSeconds, 1)) * 100}%`;
        status.textContent = `当前状态：${phase === "work" ? "专注" : "休息"}`;
      };

      const resetWithPhase = (nextPhase = "work") => {
        phase = nextPhase;
        totalSeconds = Number(nextPhase === "work" ? workInput.value : restInput.value) * 60;
        remaining = totalSeconds;
        syncDisplay();
      };

      const stop = () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };

      root.querySelector('[data-action="start"]').addEventListener("click", () => {
        if (intervalId) return;
        intervalId = window.setInterval(() => {
          remaining -= 1;
          if (remaining < 0) {
            phase = phase === "work" ? "rest" : "work";
            totalSeconds = Number(phase === "work" ? workInput.value : restInput.value) * 60;
            remaining = totalSeconds;
          }
          syncDisplay();
        }, 1000);
      });

      root.querySelector('[data-action="pause"]').addEventListener("click", stop);
      root.querySelector('[data-action="reset"]').addEventListener("click", () => {
        stop();
        resetWithPhase("work");
      });

      registerCleanup(stop);
      syncDisplay();
    },
  },
  password: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>密码参数</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>长度</label>
                  <input data-field="length" type="number" min="6" max="64" value="16" />
                </div>
                <div class="field-stack">
                  <label>字符类型</label>
                  <select data-field="preset">
                    <option value="all">数字 + 大小写 + 符号</option>
                    <option value="safe">数字 + 大小写</option>
                    <option value="pin">仅数字</option>
                  </select>
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="generate">生成密码</button>
                <button class="tool-action" data-action="copy">复制结果</button>
              </div>
              <div class="tool-output" data-output="password">点击“生成密码”开始。</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>安全建议</h4>
            <ul>
              <li>重要账号优先使用 16 位以上长度</li>
              <li>不要在多个网站复用同一个密码</li>
              <li>建议配合密码管理器使用</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const lengthInput = root.querySelector('[data-field="length"]');
      const presetInput = root.querySelector('[data-field="preset"]');
      const output = root.querySelector('[data-output="password"]');

      const pools = {
        all: "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*()_-+=<>?",
        safe: "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789",
        pin: "0123456789",
      };

      const generate = () => {
        const length = Math.max(6, Math.min(64, Number(lengthInput.value) || 16));
        const pool = pools[presetInput.value] || pools.all;
        const bytes = new Uint32Array(length);
        crypto.getRandomValues(bytes);
        const password = [...bytes].map((value) => pool[value % pool.length]).join("");
        output.textContent = password;
      };

      root.querySelector('[data-action="generate"]').addEventListener("click", generate);
      root.querySelector('[data-action="copy"]').addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(output.textContent);
          output.textContent += "\n\n已复制到剪贴板。";
        } catch {
          output.textContent += "\n\n当前浏览器环境不支持自动复制。";
        }
      });
      generate();
    },
  },
  countdown: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>目标时间</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>选择未来时间</label>
                <input data-field="target" type="datetime-local" />
              </div>
              <div class="big-display" data-output="main">00 天 00:00:00</div>
              <div class="tool-output" data-output="detail">设置目标时间后开始倒计时。</div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="start">开始倒计时</button>
                <button class="tool-action" data-action="clear">清空</button>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>适用场景</h4>
            <ul>
              <li>节假日、考试、出差、发版节点</li>
              <li>可快速看到剩余总天数和秒数</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const target = root.querySelector('[data-field="target"]');
      const main = root.querySelector('[data-output="main"]');
      const detail = root.querySelector('[data-output="detail"]');
      target.value = datetimeLocalValue(new Date(Date.now() + 3 * 24 * 3600 * 1000));
      let intervalId = null;

      const stop = () => {
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };

      const update = () => {
        const targetTime = new Date(target.value).getTime();
        const diff = targetTime - Date.now();
        if (Number.isNaN(targetTime)) {
          main.textContent = "无效时间";
          detail.textContent = "请重新选择日期时间。";
          return;
        }
        if (diff <= 0) {
          main.textContent = "时间已到";
          detail.textContent = "目标时间已经到达或已经过去。";
          stop();
          return;
        }
        const days = Math.floor(diff / (24 * 3600 * 1000));
        const rest = diff % (24 * 3600 * 1000);
        main.textContent = `${String(days).padStart(2, "0")} 天 ${formatDuration(rest)}`;
        detail.textContent = `距离目标还剩 ${(diff / 1000).toFixed(0)} 秒。`;
      };

      root.querySelector('[data-action="start"]').addEventListener("click", () => {
        stop();
        update();
        intervalId = window.setInterval(update, 1000);
      });
      root.querySelector('[data-action="clear"]').addEventListener("click", () => {
        stop();
        main.textContent = "00 天 00:00:00";
        detail.textContent = "已清空。";
      });

      registerCleanup(stop);
    },
  },
  bmi: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>BMI 计算</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>身高（厘米）</label>
                  <input data-field="height" type="number" min="80" value="170" />
                </div>
                <div class="field-stack">
                  <label>体重（公斤）</label>
                  <input data-field="weight" type="number" min="20" value="60" />
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="calculate">计算 BMI</button>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>BMI</span><strong data-output="bmi">--</strong></article>
                <article class="metric-card"><span>区间</span><strong data-output="range">--</strong></article>
              </div>
              <div class="tool-output" data-output="tips">输入数值后点击计算。</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>参考区间</h4>
            <ul>
              <li>小于 18.5：偏瘦</li>
              <li>18.5 - 23.9：正常</li>
              <li>24 - 27.9：超重</li>
              <li>28 及以上：肥胖</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="calculate"]').addEventListener("click", () => {
        const height = Number(root.querySelector('[data-field="height"]').value) / 100;
        const weight = Number(root.querySelector('[data-field="weight"]').value);
        const bmi = weight / (height * height);
        let range = "正常";
        if (bmi < 18.5) range = "偏瘦";
        else if (bmi >= 24 && bmi < 28) range = "超重";
        else if (bmi >= 28) range = "肥胖";
        root.querySelector('[data-output="bmi"]').textContent = bmi.toFixed(1);
        root.querySelector('[data-output="range"]').textContent = range;
        root.querySelector('[data-output="tips"]').textContent = `你的 BMI 为 ${bmi.toFixed(1)}，当前属于“${range}”区间。`;
      });
    },
  },
  stopwatch: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>秒表</h4>
            <div class="tool-form">
              <div class="big-display" data-output="time">00:00:00</div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="start">开始</button>
                <button class="tool-action" data-action="pause">暂停</button>
                <button class="tool-action" data-action="lap">记录分段</button>
                <button class="tool-action" data-action="reset">复位</button>
              </div>
              <div class="tool-output" data-output="laps">暂无分段记录。</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>使用说明</h4>
            <ul>
              <li>适合训练、演示和会议计时</li>
              <li>分段记录会保留当前时间快照</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const display = root.querySelector('[data-output="time"]');
      const laps = root.querySelector('[data-output="laps"]');
      let intervalId = null;
      let elapsed = 0;
      let startedAt = 0;
      const lapRecords = [];

      const paint = () => {
        const current = intervalId ? elapsed + (Date.now() - startedAt) : elapsed;
        display.textContent = formatDuration(current);
      };

      const stop = () => {
        if (intervalId) {
          clearInterval(intervalId);
          elapsed += Date.now() - startedAt;
          intervalId = null;
        }
        paint();
      };

      root.querySelector('[data-action="start"]').addEventListener("click", () => {
        if (intervalId) return;
        startedAt = Date.now();
        intervalId = window.setInterval(paint, 200);
      });
      root.querySelector('[data-action="pause"]').addEventListener("click", stop);
      root.querySelector('[data-action="lap"]').addEventListener("click", () => {
        paint();
        lapRecords.unshift(display.textContent);
        laps.textContent = lapRecords.map((item, index) => `#${lapRecords.length - index}  ${item}`).join("\n");
      });
      root.querySelector('[data-action="reset"]').addEventListener("click", () => {
        stop();
        elapsed = 0;
        lapRecords.length = 0;
        laps.textContent = "暂无分段记录。";
        paint();
      });
      registerCleanup(stop);
      paint();
    },
  },
  ageCalculator: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>生日信息</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>出生日期</label>
                <input data-field="birth" type="date" />
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="calculate">计算年龄</button>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>年龄</span><strong data-output="years">--</strong></article>
                <article class="metric-card"><span>总天数</span><strong data-output="days">--</strong></article>
              </div>
              <div class="tool-output" data-output="detail">请选择出生日期。</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>结果包含</h4>
            <ul>
              <li>整岁年龄</li>
              <li>出生至今累计天数</li>
              <li>下一个生日还有多少天</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-field="birth"]').value = "1998-01-01";
      root.querySelector('[data-action="calculate"]').addEventListener("click", () => {
        const birth = new Date(root.querySelector('[data-field="birth"]').value);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const hasBirthdayPassed =
          today.getMonth() > birth.getMonth() ||
          (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
        if (!hasBirthdayPassed) age -= 1;
        const diffDays = Math.floor((today - birth) / (24 * 3600 * 1000));
        const nextBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
        if (nextBirthday < today) nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
        const untilBirthday = Math.ceil((nextBirthday - today) / (24 * 3600 * 1000));
        setOutput(root, '[data-output="years"]', `${age} 岁`);
        setOutput(root, '[data-output="days"]', `${diffDays} 天`);
        setOutput(root, '[data-output="detail"]', `距离下一个生日还有 ${untilBirthday} 天。`);
      });
    },
  },
  dateDiff: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>日期差</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>开始日期</label>
                  <input data-field="start" type="date" />
                </div>
                <div class="field-stack">
                  <label>结束日期</label>
                  <input data-field="end" type="date" />
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="calculate">计算</button>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>相差天数</span><strong data-output="days">--</strong></article>
                <article class="metric-card"><span>相差周数</span><strong data-output="weeks">--</strong></article>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>常见用途</h4>
            <ul>
              <li>项目排期</li>
              <li>假期倒排</li>
              <li>纪念日统计</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const today = new Date();
      root.querySelector('[data-field="start"]').value = datetimeLocalValue(today).slice(0, 10);
      root.querySelector('[data-field="end"]').value = datetimeLocalValue(new Date(today.getTime() + 7 * 24 * 3600 * 1000)).slice(0, 10);
      root.querySelector('[data-action="calculate"]').addEventListener("click", () => {
        const start = new Date(root.querySelector('[data-field="start"]').value);
        const end = new Date(root.querySelector('[data-field="end"]').value);
        const days = Math.abs(Math.round((end - start) / (24 * 3600 * 1000)));
        setOutput(root, '[data-output="days"]', `${days} 天`);
        setOutput(root, '[data-output="weeks"]', `${(days / 7).toFixed(1)} 周`);
      });
    },
  },
  salaryConverter: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>薪资拆解</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>月薪（元）</label>
                  <input data-field="salary" type="number" value="12000" />
                </div>
                <div class="field-stack">
                  <label>每月工作天数</label>
                  <input data-field="days" type="number" value="22" />
                </div>
              </div>
              <div class="field-stack">
                <label>每天工作小时数</label>
                <input data-field="hours" type="number" value="8" />
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="calculate">换算</button>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>日薪</span><strong data-output="day">--</strong></article>
                <article class="metric-card"><span>时薪</span><strong data-output="hour">--</strong></article>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>提示</h4>
            <ul>
              <li>适合比较单双休岗位的真实时薪</li>
              <li>这里只做基础换算，不含五险一金和税费</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="calculate"]').addEventListener("click", () => {
        const salary = Number(root.querySelector('[data-field="salary"]').value);
        const days = Number(root.querySelector('[data-field="days"]').value);
        const hours = Number(root.querySelector('[data-field="hours"]').value);
        setOutput(root, '[data-output="day"]', `${(salary / days).toFixed(2)} 元`);
        setOutput(root, '[data-output="hour"]', `${(salary / days / hours).toFixed(2)} 元`);
      });
    },
  },
  notepad: {
    render() {
      const cached = localStorage.getItem("toolbox-notepad") || "";
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>临时笔记</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>内容会自动保存到当前浏览器本地</label>
                <textarea data-field="note" rows="14" placeholder="输入待办、草稿或临时记录…">${escapeHtml(cached)}</textarea>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="save">立即保存</button>
                <button class="tool-action" data-action="clear">清空内容</button>
              </div>
              <div class="tool-output" data-output="status">当前内容将自动保存在浏览器本地。</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>说明</h4>
            <ul>
              <li>适合临时记事和文本中转</li>
              <li>数据仅存在当前浏览器本地</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const note = root.querySelector('[data-field="note"]');
      const save = () => {
        localStorage.setItem("toolbox-notepad", note.value);
        setOutput(root, '[data-output="status"]', `已保存 ${note.value.length} 个字符。`);
      };
      note.addEventListener("input", save);
      root.querySelector('[data-action="save"]').addEventListener("click", save);
      root.querySelector('[data-action="clear"]').addEventListener("click", () => {
        note.value = "";
        save();
      });
    },
  },
  shaGenerator: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>SHA 摘要</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>算法</label>
                <select data-field="algorithm">
                  <option>SHA-1</option>
                  <option selected>SHA-256</option>
                  <option>SHA-384</option>
                  <option>SHA-512</option>
                </select>
              </div>
              <div class="field-stack">
                <label>输入文本</label>
                <textarea data-field="text" rows="10" placeholder="请输入待生成摘要的文本"></textarea>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="hash">生成摘要</button>
              </div>
              <div class="tool-output" data-output="hash">等待生成…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>适用说明</h4>
            <ul>
              <li>适合校验内容是否发生变化</li>
              <li>摘要不可逆，不能解密还原</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="hash"]').addEventListener("click", async () => {
        const text = root.querySelector('[data-field="text"]').value;
        const algorithm = root.querySelector('[data-field="algorithm"]').value;
        const result = await shaDigest(text, algorithm);
        setOutput(root, '[data-output="hash"]', result);
      });
    },
  },
  base64Tool: {
    render() {
      return basicConvertLayout("Base64 编码解码");
    },
    init(root) {
      wireBasicConverter(root, {
        encode: (value) => toBase64(value),
        decode: (value) => fromBase64(value),
      });
    },
  },
  urlTool: {
    render() {
      return basicConvertLayout("URL 编码解码");
    },
    init(root) {
      wireBasicConverter(root, {
        encode: (value) => encodeURIComponent(value),
        decode: (value) => decodeURIComponent(value),
      });
    },
  },
  passwordStrength: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>密码强度评估</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>输入密码</label>
                <input data-field="password" type="text" placeholder="输入待检测密码" />
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>评分</span><strong data-output="score">0 / 100</strong></article>
                <article class="metric-card"><span>等级</span><strong data-output="level">弱</strong></article>
              </div>
              <div class="tool-output" data-output="detail">输入后自动分析长度、字符类型与复杂度。</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>评分逻辑</h4>
            <ul>
              <li>长度越长得分越高</li>
              <li>包含数字、大小写、符号会加分</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const input = root.querySelector('[data-field="password"]');
      const update = () => {
        const value = input.value;
        let score = Math.min(40, value.length * 4);
        if (/[a-z]/.test(value)) score += 15;
        if (/[A-Z]/.test(value)) score += 15;
        if (/\d/.test(value)) score += 15;
        if (/[^A-Za-z0-9]/.test(value)) score += 15;
        score = Math.min(100, score);
        let level = "弱";
        if (score >= 80) level = "强";
        else if (score >= 55) level = "中";
        setOutput(root, '[data-output="score"]', `${score} / 100`);
        setOutput(root, '[data-output="level"]', level);
        setOutput(root, '[data-output="detail"]', `长度 ${value.length}，复杂度评估为“${level}”。`);
      };
      input.addEventListener("input", update);
    },
  },
  timestampTool: {
    render() {
      const now = new Date();
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>时间戳互转</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>时间戳（秒）</label>
                  <input data-field="stamp" type="number" value="${Math.floor(now.getTime() / 1000)}" />
                </div>
                <div class="field-stack">
                  <label>日期时间</label>
                  <input data-field="datetime" type="datetime-local" value="${datetimeLocalValue(now)}" />
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="fromStamp">时间戳转时间</button>
                <button class="tool-action" data-action="fromDate">时间转时间戳</button>
              </div>
              <div class="tool-output" data-output="result">选择转换方向。</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>说明</h4>
            <ul>
              <li>默认使用本地浏览器时区显示</li>
              <li>适合前后端调试和接口联调</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="fromStamp"]').addEventListener("click", () => {
        const value = Number(root.querySelector('[data-field="stamp"]').value) * 1000;
        const date = new Date(value);
        setOutput(root, '[data-output="result"]', `${date.toLocaleString("zh-CN")} (${date.toISOString()})`);
      });
      root.querySelector('[data-action="fromDate"]').addEventListener("click", () => {
        const value = new Date(root.querySelector('[data-field="datetime"]').value);
        setOutput(root, '[data-output="result"]', `${Math.floor(value.getTime() / 1000)} 秒`);
      });
    },
  },
  unicodeTool: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>Unicode 查看</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>输入文本</label>
                <textarea data-field="text" rows="8" placeholder="例如：工具箱"></textarea>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="convert">查看编码点</button>
              </div>
              <div class="tool-output" data-output="result">等待输入…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>用途</h4>
            <ul>
              <li>查看字符对应编码点</li>
              <li>排查编码兼容问题</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="convert"]').addEventListener("click", () => {
        const text = root.querySelector('[data-field="text"]').value;
        const result = [...text].map((char) => `${char}  U+${char.codePointAt(0).toString(16).toUpperCase()}`).join("\n");
        setOutput(root, '[data-output="result"]', result || "没有可显示的字符。");
      });
    },
  },
  jsonFormatter: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>JSON 内容</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>粘贴 JSON</label>
                <textarea data-field="json" rows="14" placeholder='{"name":"toolbox","count":12}'></textarea>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="format">格式化</button>
                <button class="tool-action" data-action="minify">压缩</button>
                <button class="tool-action" data-action="validate">校验</button>
              </div>
              <div class="tool-output" data-output="result">等待输入 JSON…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>适用场景</h4>
            <ul>
              <li>调试接口返回值</li>
              <li>整理配置文件</li>
              <li>校验语法是否正确</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const input = root.querySelector('[data-field="json"]');
      const output = root.querySelector('[data-output="result"]');
      const parse = () => JSON.parse(input.value);
      root.querySelector('[data-action="format"]').addEventListener("click", () => {
        try {
          output.textContent = JSON.stringify(parse(), null, 2);
        } catch (error) {
          output.textContent = `JSON 无效：${error.message}`;
        }
      });
      root.querySelector('[data-action="minify"]').addEventListener("click", () => {
        try {
          output.textContent = JSON.stringify(parse());
        } catch (error) {
          output.textContent = `JSON 无效：${error.message}`;
        }
      });
      root.querySelector('[data-action="validate"]').addEventListener("click", () => {
        try {
          parse();
          output.textContent = "JSON 校验通过。";
        } catch (error) {
          output.textContent = `JSON 无效：${error.message}`;
        }
      });
    },
  },
  textCleaner: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>文本清洗</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>原始文本</label>
                <textarea data-field="text" rows="12" placeholder="每行一段内容"></textarea>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="trim">去空行并裁剪空格</button>
                <button class="tool-action" data-action="dedupe">去重</button>
              </div>
              <div class="tool-output" data-output="result">等待处理…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>说明</h4>
            <ul>
              <li>清理复制粘贴后的杂乱文本</li>
              <li>快速去掉重复行</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const input = root.querySelector('[data-field="text"]');
      const output = root.querySelector('[data-output="result"]');
      root.querySelector('[data-action="trim"]').addEventListener("click", () => {
        output.textContent = input.value
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .join("\n");
      });
      root.querySelector('[data-action="dedupe"]').addEventListener("click", () => {
        const lines = input.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        output.textContent = [...new Set(lines)].join("\n");
      });
    },
  },
  textCounter: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>字数统计</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>输入文本</label>
                <textarea data-field="text" rows="12" placeholder="输入后自动统计…"></textarea>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>字符数</span><strong data-output="chars">0</strong></article>
                <article class="metric-card"><span>词数</span><strong data-output="words">0</strong></article>
                <article class="metric-card"><span>行数</span><strong data-output="lines">0</strong></article>
                <article class="metric-card"><span>段落</span><strong data-output="paragraphs">0</strong></article>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>适合</h4>
            <ul>
              <li>文案、文章、脚本长度统计</li>
              <li>快速查看内容密度</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const input = root.querySelector('[data-field="text"]');
      const update = () => {
        const text = input.value;
        const lines = text ? text.split(/\r?\n/).length : 0;
        const paragraphs = text.trim() ? text.trim().split(/\n\s*\n/).length : 0;
        const words = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
        setOutput(root, '[data-output="chars"]', String(text.length));
        setOutput(root, '[data-output="words"]', String(words));
        setOutput(root, '[data-output="lines"]', String(lines));
        setOutput(root, '[data-output="paragraphs"]', String(paragraphs));
      };
      input.addEventListener("input", update);
      update();
    },
  },
  caseConverter: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>大小写转换</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>输入文本</label>
                <textarea data-field="text" rows="10" placeholder="hello toolbox"></textarea>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-mode="upper">全部大写</button>
                <button class="tool-action" data-mode="lower">全部小写</button>
                <button class="tool-action" data-mode="title">标题格式</button>
                <button class="tool-action" data-mode="sentence">句首大写</button>
              </div>
              <div class="tool-output" data-output="result">等待转换…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>场景</h4>
            <ul>
              <li>英文标题整理</li>
              <li>变量名和文案快速处理</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelectorAll("[data-mode]").forEach((button) => {
        button.addEventListener("click", () => {
          const text = root.querySelector('[data-field="text"]').value;
          const mode = button.dataset.mode;
          let result = text;
          if (mode === "upper") result = text.toUpperCase();
          if (mode === "lower") result = text.toLowerCase();
          if (mode === "title") result = text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
          if (mode === "sentence") result = text.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (char) => char.toUpperCase());
          setOutput(root, '[data-output="result"]', result);
        });
      });
    },
  },
  randomPicker: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>随机点名</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>抽取人数</label>
                  <input data-field="count" type="number" min="1" value="1" />
                </div>
                <div class="field-stack">
                  <label>名单（每行一个）</label>
                  <textarea data-field="items" rows="8">小王
小李
小张
小周</textarea>
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="pick">开始抽取</button>
              </div>
              <div class="tool-output" data-output="result">等待抽取…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>说明</h4>
            <ul>
              <li>抽取结果默认为不重复</li>
              <li>适合课堂、会议和小游戏</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="pick"]').addEventListener("click", () => {
        const items = root
          .querySelector('[data-field="items"]')
          .value.split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean);
        const count = Math.min(Number(root.querySelector('[data-field="count"]').value) || 1, items.length);
        const pool = [...items];
        const selected = [];
        for (let index = 0; index < count; index += 1) {
          const randomIndex = Math.floor(Math.random() * pool.length);
          selected.push(pool.splice(randomIndex, 1)[0]);
        }
        setOutput(root, '[data-output="result"]', selected.join("\n") || "没有可抽取的项目。");
      });
    },
  },
  regexTester: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>正则测试</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>正则表达式</label>
                  <input data-field="pattern" placeholder="\\d+" value="\\d+" />
                </div>
                <div class="field-stack">
                  <label>Flags</label>
                  <input data-field="flags" placeholder="gim" value="g" />
                </div>
              </div>
              <div class="field-stack">
                <label>测试文本</label>
                <textarea data-field="text" rows="10">订单号 A129，数量 42，价格 99。</textarea>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="test">执行匹配</button>
              </div>
              <div class="tool-output" data-output="result">等待测试…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>结果说明</h4>
            <ul>
              <li>显示所有匹配片段和数量</li>
              <li>适合快速验证表达式是否生效</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="test"]').addEventListener("click", () => {
        try {
          const pattern = root.querySelector('[data-field="pattern"]').value;
          const flags = root.querySelector('[data-field="flags"]').value;
          const text = root.querySelector('[data-field="text"]').value;
          const regex = new RegExp(pattern, flags);
          const matches = [...text.matchAll(regex)].map((item) => item[0]);
          setOutput(root, '[data-output="result"]', matches.length ? `共 ${matches.length} 个匹配：\n${matches.join("\n")}` : "没有匹配结果。");
        } catch (error) {
          setOutput(root, '[data-output="result"]', `表达式无效：${error.message}`);
        }
      });
    },
  },
  loanCalculator: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>贷款月供</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>本金（元）</label>
                  <input data-field="principal" type="number" value="300000" />
                </div>
                <div class="field-stack">
                  <label>年化利率（%）</label>
                  <input data-field="rate" type="number" step="0.01" value="3.2" />
                </div>
              </div>
              <div class="field-stack">
                <label>贷款年限（年）</label>
                <input data-field="years" type="number" value="20" />
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="calculate">计算月供</button>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>月供</span><strong data-output="payment">--</strong></article>
                <article class="metric-card"><span>总利息</span><strong data-output="interest">--</strong></article>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>备注</h4>
            <ul>
              <li>采用等额本息近似计算</li>
              <li>适合做快速预算</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="calculate"]').addEventListener("click", () => {
        const principal = Number(root.querySelector('[data-field="principal"]').value);
        const monthlyRate = Number(root.querySelector('[data-field="rate"]').value) / 100 / 12;
        const months = Number(root.querySelector('[data-field="years"]').value) * 12;
        const payment = principal * monthlyRate * (1 + monthlyRate) ** months / ((1 + monthlyRate) ** months - 1);
        const total = payment * months;
        setOutput(root, '[data-output="payment"]', `${payment.toFixed(2)} 元`);
        setOutput(root, '[data-output="interest"]', `${(total - principal).toFixed(2)} 元`);
      });
    },
  },
  unitConverter: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>单位换算</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>类别</label>
                  <select data-field="type">
                    <option value="length">长度</option>
                    <option value="weight">重量</option>
                    <option value="temp">温度</option>
                  </select>
                </div>
                <div class="field-stack">
                  <label>数值</label>
                  <input data-field="value" type="number" value="1" />
                </div>
              </div>
              <div class="field-grid">
                <div class="field-stack">
                  <label>从</label>
                  <select data-field="from"></select>
                </div>
                <div class="field-stack">
                  <label>到</label>
                  <select data-field="to"></select>
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="convert">换算</button>
              </div>
              <div class="tool-output" data-output="result">等待换算…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>支持类别</h4>
            <ul>
              <li>长度：米 / 千米 / 英里 / 英尺</li>
              <li>重量：千克 / 克 / 斤 / 磅</li>
              <li>温度：摄氏 / 华氏</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const type = root.querySelector('[data-field="type"]');
      const from = root.querySelector('[data-field="from"]');
      const to = root.querySelector('[data-field="to"]');
      const defs = {
        length: {
          options: { m: "米", km: "千米", mile: "英里", ft: "英尺" },
          toBase: { m: 1, km: 1000, mile: 1609.344, ft: 0.3048 },
        },
        weight: {
          options: { kg: "千克", g: "克", jin: "斤", lb: "磅" },
          toBase: { kg: 1, g: 0.001, jin: 0.5, lb: 0.45359237 },
        },
        temp: {
          options: { c: "摄氏度", f: "华氏度" },
        },
      };

      const syncOptions = () => {
        const selected = defs[type.value];
        const options = Object.entries(selected.options)
          .map(([value, label]) => `<option value="${value}">${label}</option>`)
          .join("");
        from.innerHTML = options;
        to.innerHTML = options;
        to.selectedIndex = 1;
      };

      root.querySelector('[data-action="convert"]').addEventListener("click", () => {
        const value = Number(root.querySelector('[data-field="value"]').value);
        if (type.value === "temp") {
          let result = value;
          if (from.value === "c" && to.value === "f") result = value * 1.8 + 32;
          if (from.value === "f" && to.value === "c") result = (value - 32) / 1.8;
          setOutput(root, '[data-output="result"]', `${value} ${defs.temp.options[from.value]} = ${result.toFixed(2)} ${defs.temp.options[to.value]}`);
          return;
        }
        const toBaseMap = defs[type.value].toBase;
        const result = (value * toBaseMap[from.value]) / toBaseMap[to.value];
        setOutput(root, '[data-output="result"]', `${value} ${defs[type.value].options[from.value]} = ${result.toFixed(4)} ${defs[type.value].options[to.value]}`);
      });

      type.addEventListener("change", syncOptions);
      syncOptions();
    },
  },
  tipCalculator: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>消费分摊</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>消费金额（元）</label>
                  <input data-field="amount" type="number" value="286" />
                </div>
                <div class="field-stack">
                  <label>小费比例（%）</label>
                  <input data-field="tip" type="number" value="10" />
                </div>
              </div>
              <div class="field-stack">
                <label>分摊人数</label>
                <input data-field="people" type="number" min="1" value="4" />
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="calculate">计算</button>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>总金额</span><strong data-output="total">--</strong></article>
                <article class="metric-card"><span>人均</span><strong data-output="per">--</strong></article>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>适合</h4>
            <ul>
              <li>聚餐 AA</li>
              <li>咖啡拼单</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="calculate"]').addEventListener("click", () => {
        const amount = Number(root.querySelector('[data-field="amount"]').value);
        const tip = Number(root.querySelector('[data-field="tip"]').value) / 100;
        const people = Math.max(1, Number(root.querySelector('[data-field="people"]').value));
        const total = amount * (1 + tip);
        setOutput(root, '[data-output="total"]', `${total.toFixed(2)} 元`);
        setOutput(root, '[data-output="per"]', `${(total / people).toFixed(2)} 元`);
      });
    },
  },
  waterIntake: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>饮水推荐</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>体重（公斤）</label>
                  <input data-field="weight" type="number" value="60" />
                </div>
                <div class="field-stack">
                  <label>活动量</label>
                  <select data-field="activity">
                    <option value="0">轻度活动</option>
                    <option value="300">中等活动</option>
                    <option value="600">高强度活动</option>
                  </select>
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="calculate">计算推荐饮水量</button>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>每日推荐</span><strong data-output="ml">--</strong></article>
                <article class="metric-card"><span>约等于</span><strong data-output="cups">--</strong></article>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>备注</h4>
            <ul>
              <li>公式仅作日常参考</li>
              <li>特殊人群请遵医嘱</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="calculate"]').addEventListener("click", () => {
        const weight = Number(root.querySelector('[data-field="weight"]').value);
        const activity = Number(root.querySelector('[data-field="activity"]').value);
        const ml = weight * 35 + activity;
        setOutput(root, '[data-output="ml"]', `${Math.round(ml)} ml`);
        setOutput(root, '[data-output="cups"]', `${(ml / 250).toFixed(1)} 杯`);
      });
    },
  },
  bmrCalculator: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>BMR 计算</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>性别</label>
                  <select data-field="gender">
                    <option value="male">男</option>
                    <option value="female">女</option>
                  </select>
                </div>
                <div class="field-stack">
                  <label>年龄</label>
                  <input data-field="age" type="number" value="28" />
                </div>
              </div>
              <div class="field-grid">
                <div class="field-stack">
                  <label>身高（厘米）</label>
                  <input data-field="height" type="number" value="175" />
                </div>
                <div class="field-stack">
                  <label>体重（公斤）</label>
                  <input data-field="weight" type="number" value="68" />
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="calculate">计算 BMR</button>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>基础代谢</span><strong data-output="bmr">--</strong></article>
                <article class="metric-card"><span>轻度活动参考</span><strong data-output="daily">--</strong></article>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>算法</h4>
            <ul>
              <li>采用 Mifflin-St Jeor 公式估算</li>
              <li>结果适合作为营养规划参考</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="calculate"]').addEventListener("click", () => {
        const gender = root.querySelector('[data-field="gender"]').value;
        const age = Number(root.querySelector('[data-field="age"]').value);
        const height = Number(root.querySelector('[data-field="height"]').value);
        const weight = Number(root.querySelector('[data-field="weight"]').value);
        const base = 10 * weight + 6.25 * height - 5 * age + (gender === "male" ? 5 : -161);
        setOutput(root, '[data-output="bmr"]', `${base.toFixed(0)} kcal`);
        setOutput(root, '[data-output="daily"]', `${(base * 1.375).toFixed(0)} kcal`);
      });
    },
  },
  paceCalculator: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>配速计算</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>距离（公里）</label>
                  <input data-field="distance" type="number" step="0.1" value="10" />
                </div>
                <div class="field-stack">
                  <label>总用时（分钟）</label>
                  <input data-field="minutes" type="number" value="56" />
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="calculate">计算配速</button>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>每公里配速</span><strong data-output="pace">--</strong></article>
                <article class="metric-card"><span>平均时速</span><strong data-output="speed">--</strong></article>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>场景</h4>
            <ul>
              <li>跑步训练</li>
              <li>比赛复盘</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="calculate"]').addEventListener("click", () => {
        const distance = Number(root.querySelector('[data-field="distance"]').value);
        const minutes = Number(root.querySelector('[data-field="minutes"]').value);
        const paceMinutes = minutes / distance;
        const mm = Math.floor(paceMinutes);
        const ss = Math.round((paceMinutes - mm) * 60);
        setOutput(root, '[data-output="pace"]', `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")} /km`);
        setOutput(root, '[data-output="speed"]', `${(distance / (minutes / 60)).toFixed(2)} km/h`);
      });
    },
  },
  colorConverter: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>颜色转换</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>HEX</label>
                  <input data-field="hex" value="#FF9C53" />
                </div>
                <div class="field-stack">
                  <label>RGB（逗号分隔）</label>
                  <input data-field="rgb" value="255,156,83" />
                </div>
              </div>
              <div class="swatch" data-output="swatch"></div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="fromHex">HEX 转 RGB</button>
                <button class="tool-action" data-action="fromRgb">RGB 转 HEX</button>
              </div>
              <div class="tool-output" data-output="result">等待转换…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>适用场景</h4>
            <ul>
              <li>设计稿颜色提取</li>
              <li>CSS 变量整理</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const swatch = root.querySelector('[data-output="swatch"]');
      root.querySelector('[data-action="fromHex"]').addEventListener("click", () => {
        const color = parseHexColor(root.querySelector('[data-field="hex"]').value);
        if (!color) {
          setOutput(root, '[data-output="result"]', "HEX 格式错误，请输入 6 位十六进制颜色。");
          return;
        }
        root.querySelector('[data-field="rgb"]').value = `${color.r},${color.g},${color.b}`;
        swatch.style.background = rgbToHex(color.r, color.g, color.b);
        setOutput(root, '[data-output="result"]', `RGB(${color.r}, ${color.g}, ${color.b})`);
      });
      root.querySelector('[data-action="fromRgb"]').addEventListener("click", () => {
        const [r, g, b] = root
          .querySelector('[data-field="rgb"]')
          .value.split(",")
          .map((item) => Number(item.trim()));
        const hex = rgbToHex(r, g, b);
        root.querySelector('[data-field="hex"]').value = hex;
        swatch.style.background = hex;
        setOutput(root, '[data-output="result"]', hex);
      });
      swatch.style.background = "#FF9C53";
    },
  },
  contrastChecker: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>颜色对比度</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>前景色</label>
                  <input data-field="fg" value="#1F1F1F" />
                </div>
                <div class="field-stack">
                  <label>背景色</label>
                  <input data-field="bg" value="#FFFFFF" />
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="check">检查对比度</button>
              </div>
              <div class="metric-grid">
                <article class="metric-card"><span>对比度</span><strong data-output="ratio">--</strong></article>
                <article class="metric-card"><span>等级</span><strong data-output="level">--</strong></article>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>参考</h4>
            <ul>
              <li>普通文字建议至少 4.5:1</li>
              <li>大字号建议至少 3:1</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="check"]').addEventListener("click", () => {
        const fg = parseHexColor(root.querySelector('[data-field="fg"]').value);
        const bg = parseHexColor(root.querySelector('[data-field="bg"]').value);
        if (!fg || !bg) {
          setOutput(root, '[data-output="ratio"]', "无效");
          setOutput(root, '[data-output="level"]', "请输入正确的颜色值");
          return;
        }
        const ratio = contrastRatio(fg, bg);
        let level = "未通过";
        if (ratio >= 7) level = "AAA";
        else if (ratio >= 4.5) level = "AA";
        else if (ratio >= 3) level = "大字号可用";
        setOutput(root, '[data-output="ratio"]', `${ratio.toFixed(2)} : 1`);
        setOutput(root, '[data-output="level"]', level);
      });
    },
  },
  speakerCleaner: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>扬声器清灰音</h4>
            <div class="tool-form">
              <div class="field-grid">
                <div class="field-stack">
                  <label>频率（Hz）</label>
                  <input data-field="freq" type="number" value="165" />
                </div>
                <div class="field-stack">
                  <label>时长（秒）</label>
                  <input data-field="seconds" type="number" value="20" />
                </div>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="play">播放</button>
                <button class="tool-action" data-action="stop">停止</button>
              </div>
              <div class="tool-output" data-output="status">点击播放后会生成高频正弦波。</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>注意</h4>
            <ul>
              <li>建议先调低音量再播放</li>
              <li>仅作为演示和辅助用途</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      let audioContext = null;
      let oscillator = null;
      let timeoutId = null;
      const stop = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (oscillator) oscillator.stop();
        if (audioContext) audioContext.close();
        oscillator = null;
        audioContext = null;
        timeoutId = null;
        setOutput(root, '[data-output="status"]', "已停止播放。");
      };

      root.querySelector('[data-action="play"]').addEventListener("click", async () => {
        stop();
        const freq = Number(root.querySelector('[data-field="freq"]').value);
        const seconds = Number(root.querySelector('[data-field="seconds"]').value);
        audioContext = new AudioContext();
        oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        gain.gain.value = 0.04;
        oscillator.type = "sine";
        oscillator.frequency.value = freq;
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        timeoutId = window.setTimeout(stop, seconds * 1000);
        setOutput(root, '[data-output="status"]', `正在播放 ${freq}Hz，计划 ${seconds} 秒后停止。`);
      });
      root.querySelector('[data-action="stop"]').addEventListener("click", stop);
      registerCleanup(stop);
    },
  },
  scoreBoard: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>在线记分板</h4>
            <div class="tool-form">
              <div class="metric-grid">
                <article class="metric-card"><span>红队</span><strong data-output="a">0</strong></article>
                <article class="metric-card"><span>蓝队</span><strong data-output="b">0</strong></article>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="a-plus">红队 +1</button>
                <button class="tool-action" data-action="a-minus">红队 -1</button>
                <button class="tool-action primary" data-action="b-plus">蓝队 +1</button>
                <button class="tool-action" data-action="b-minus">蓝队 -1</button>
                <button class="tool-action" data-action="reset">比分清零</button>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>适合</h4>
            <ul>
              <li>小比赛、桌游、活动打分</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      let scoreA = 0;
      let scoreB = 0;
      const paint = () => {
        setOutput(root, '[data-output="a"]', String(scoreA));
        setOutput(root, '[data-output="b"]', String(scoreB));
      };
      root.querySelector('[data-action="a-plus"]').addEventListener("click", () => { scoreA += 1; paint(); });
      root.querySelector('[data-action="a-minus"]').addEventListener("click", () => { scoreA = Math.max(0, scoreA - 1); paint(); });
      root.querySelector('[data-action="b-plus"]').addEventListener("click", () => { scoreB += 1; paint(); });
      root.querySelector('[data-action="b-minus"]').addEventListener("click", () => { scoreB = Math.max(0, scoreB - 1); paint(); });
      root.querySelector('[data-action="reset"]').addEventListener("click", () => { scoreA = 0; scoreB = 0; paint(); });
      paint();
    },
  },
  reactionTest: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>反应速度测试</h4>
            <div class="tool-form">
              <div class="result-highlight" data-output="pad" style="min-height:220px;display:grid;place-items:center;border-radius:22px;border:1px solid var(--line);">
                点击下方按钮开始测试
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="start">开始测试</button>
              </div>
              <div class="tool-output" data-output="result">平均人类视觉反应通常在 200ms - 300ms 左右。</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>玩法</h4>
            <ul>
              <li>开始后等待颜色变化</li>
              <li>变色瞬间点击测试区域</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      const pad = root.querySelector('[data-output="pad"]');
      const result = root.querySelector('[data-output="result"]');
      let startTime = 0;
      let timeoutId = null;
      let ready = false;

      const reset = () => {
        ready = false;
        pad.textContent = "等待随机开始…";
        pad.style.background = "var(--panel)";
      };

      root.querySelector('[data-action="start"]').addEventListener("click", () => {
        reset();
        clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => {
          ready = true;
          startTime = performance.now();
          pad.textContent = "现在点击";
          pad.style.background = "rgba(59, 201, 138, 0.22)";
        }, 1200 + Math.random() * 2200);
      });

      pad.addEventListener("click", () => {
        if (!ready) {
          result.textContent = "太早了，再试一次。";
          return;
        }
        const delay = performance.now() - startTime;
        result.textContent = `你的反应速度是 ${delay.toFixed(0)} ms。`;
        ready = false;
        pad.textContent = "测试结束";
      });

      registerCleanup(() => clearTimeout(timeoutId));
    },
  },
  coinDice: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>抛硬币与骰子</h4>
            <div class="tool-form">
              <div class="metric-grid">
                <article class="metric-card"><span>硬币结果</span><strong data-output="coin">--</strong></article>
                <article class="metric-card"><span>骰子结果</span><strong data-output="dice">--</strong></article>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="coin">抛一次硬币</button>
                <button class="tool-action" data-action="dice">投一次骰子</button>
              </div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>用途</h4>
            <ul>
              <li>快速随机决策</li>
              <li>小游戏辅助</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="coin"]').addEventListener("click", () => {
        setOutput(root, '[data-output="coin"]', Math.random() > 0.5 ? "正面" : "反面");
      });
      root.querySelector('[data-action="dice"]').addEventListener("click", () => {
        setOutput(root, '[data-output="dice"]', String(Math.floor(Math.random() * 6) + 1));
      });
    },
  },
  answerBook: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>答案之书</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>输入你的问题</label>
                <input data-field="question" placeholder="例如：我应该现在开始这个项目吗？" />
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="answer">抽取答案</button>
              </div>
              <div class="tool-output" data-output="result">等待提问…</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>说明</h4>
            <ul>
              <li>偏娱乐向的随机回答</li>
              <li>适合放松心情，不代替真实决策</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="answer"]').addEventListener("click", () => {
        const question = root.querySelector('[data-field="question"]').value.trim();
        const answer = answers[Math.floor(Math.random() * answers.length)];
        setOutput(root, '[data-output="result"]', `${question ? `问题：${question}\n` : ""}答案：${answer}`);
      });
    },
  },
  mealPicker: {
    render() {
      return `
        <div class="tool-body">
          <section class="tool-panel">
            <h4>今天吃什么</h4>
            <div class="tool-form">
              <div class="field-stack">
                <label>候选菜单（每行一个）</label>
                <textarea data-field="items" rows="10">盖饭
米线
汉堡
轻食
火锅
面条</textarea>
              </div>
              <div class="tool-actions">
                <button class="tool-action primary" data-action="pick">帮我决定</button>
              </div>
              <div class="tool-output" data-output="result">点击按钮随机选一项。</div>
            </div>
          </section>
          <aside class="tool-side">
            <h4>小建议</h4>
            <ul>
              <li>提前把常吃的选项保存好</li>
              <li>纠结时交给概率学</li>
            </ul>
          </aside>
        </div>
      `;
    },
    init(root) {
      root.querySelector('[data-action="pick"]').addEventListener("click", () => {
        const items = root
          .querySelector('[data-field="items"]')
          .value.split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean);
        const selected = items[Math.floor(Math.random() * items.length)];
        setOutput(root, '[data-output="result"]', selected ? `今天就吃：${selected}` : "先输入几项候选菜单吧。");
      });
    },
  },
};

function basicConvertLayout(title) {
  return `
    <div class="tool-body">
      <section class="tool-panel">
        <h4>${title}</h4>
        <div class="tool-form">
          <div class="field-stack">
            <label>输入内容</label>
            <textarea data-field="input" rows="10" placeholder="请输入待转换内容"></textarea>
          </div>
          <div class="tool-actions">
            <button class="tool-action primary" data-action="encode">编码</button>
            <button class="tool-action" data-action="decode">解码</button>
          </div>
          <div class="tool-output" data-output="result">等待输入…</div>
        </div>
      </section>
      <aside class="tool-side">
        <h4>说明</h4>
        <ul>
          <li>可用于调试、接口联调和日常文本处理</li>
        </ul>
      </aside>
    </div>
  `;
}

function wireBasicConverter(root, handlers) {
  const input = root.querySelector('[data-field="input"]');
  const output = root.querySelector('[data-output="result"]');
  root.querySelector('[data-action="encode"]').addEventListener("click", () => {
    try {
      output.textContent = handlers.encode(input.value);
    } catch (error) {
      output.textContent = `转换失败：${error.message}`;
    }
  });
  root.querySelector('[data-action="decode"]').addEventListener("click", () => {
    try {
      output.textContent = handlers.decode(input.value);
    } catch (error) {
      output.textContent = `转换失败：${error.message}`;
    }
  });
}

function openTool(toolId) {
  const tool = toolMap.get(toolId);
  if (!tool) return;

  clearRuntime();
  const category = categoryMap.get(tool.category);
  const renderer = tool.tool ? toolDefinitions[tool.tool] : null;
  const body = renderer
    ? renderer.render(tool)
    : `
      <div class="tool-body">
        <section class="tool-panel">
          <h4>规划说明</h4>
          <p class="tool-intro">当前卡片已经接入站点架构，但详细功能仍保留为后续扩展位。</p>
          <div class="tool-output">
            你可以继续沿用当前站点的数据结构和弹层系统，后续新增 PDF、站长工具、在线白板等更复杂模块，而不需要重写主页。
          </div>
        </section>
        <aside class="tool-side">
          <h4>当前状态</h4>
          <ul>
            <li>分类入口已完成</li>
            <li>卡片展示已完成</li>
            <li>具体工具逻辑待扩展</li>
          </ul>
        </aside>
      </div>
    `;

  dom.modalContent.innerHTML = `
    <div class="tool-header">
      <p class="summary-label">${escapeHtml(category?.name || "工具")}</p>
      <h2>${escapeHtml(tool.title)}</h2>
      <p class="tool-intro">${escapeHtml(tool.description)}</p>
      <div class="badge-row">
        ${(tool.tags || []).map((tag) => `<span class="status-badge">${escapeHtml(tag)}</span>`).join("")}
        <span class="status-badge">${tool.implemented ? "可立即使用" : "规划占位"}</span>
      </div>
    </div>
    ${body}
  `;
  dom.toolModal.classList.remove("hidden");
  if (renderer?.init) renderer.init(dom.modalContent, tool);
}

function toggleFavorite(toolId) {
  if (state.favorites.has(toolId)) state.favorites.delete(toolId);
  else state.favorites.add(toolId);
  persistFavorites();
  render();
}

function bindEvents() {
  dom.toolSearch.addEventListener("input", (event) => {
    state.query = event.target.value.trim();
    render();
  });

  dom.favoritesToggle.addEventListener("click", () => {
    state.favoritesOnly = !state.favoritesOnly;
    render();
  });

  dom.themeToggle.addEventListener("click", () => {
    setTheme(state.theme === "dark" ? "light" : "dark");
  });

  dom.menuButton.addEventListener("click", () => {
    dom.sidebar.classList.toggle("is-open");
  });

  dom.openFeatured.addEventListener("click", () => openTool(data.featuredToolIds[0]));

  dom.featuredStrip.addEventListener("click", (event) => {
    const button = event.target.closest("[data-open-tool]");
    if (button) openTool(button.dataset.openTool);
  });

  dom.toolSections.addEventListener("click", (event) => {
    const favoriteButton = event.target.closest("[data-favorite-tool]");
    if (favoriteButton) {
      toggleFavorite(favoriteButton.dataset.favoriteTool);
      return;
    }

    const openButton = event.target.closest("[data-open-tool]");
    if (openButton) {
      openTool(openButton.dataset.openTool);
    }
  });

  dom.categoryNav.addEventListener("click", (event) => {
    const link = event.target.closest("[data-category-link]");
    if (!link) return;
    dom.sidebar.classList.remove("is-open");
    dom.categoryNav.querySelectorAll(".category-link").forEach((item) => item.classList.remove("active"));
    link.classList.add("active");
  });

  dom.modalClose.addEventListener("click", closeModal);
  dom.toolModal.addEventListener("click", (event) => {
    if (event.target === dom.toolModal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
}

function init() {
  setTheme(state.theme);
  renderSummary();
  render();
  bindEvents();
  formatShanghaiClock();
  window.setInterval(formatShanghaiClock, 1000);
}

init();
