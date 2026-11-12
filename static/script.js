/* =========================================================
   СЛОЙ — вся интерактивность сайта.
   Код специально разбит на небольшие блоки с комментариями.
   ========================================================= */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Товары из content.json передаются в HTML как JSON
const productsData = $("#products-data");
const products = productsData ? JSON.parse(productsData.textContent) : [];
const productById = new Map(products.map((product) => [product.id, product]));

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Форматирование ---------- */

function formatPrice(value) {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}

function plural(number, one, few, many) {
  const n = Math.abs(number) % 100;
  if (n >= 11 && n <= 19) return many;
  const last = n % 10;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function normalize(text) {
  return String(text).toLowerCase().replace(/ё/g, "е").trim();
}

/* ---------- Шапка и мобильное меню ---------- */

const header = $("#site-header");
const burger = $(".burger");
const mobileMenu = $("#mobile-menu");

function updateHeader() {
  if (!header) return;
  header.classList.toggle("is-scrolled", window.scrollY > 8);
}

window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

function setMenu(open) {
  if (!burger || !mobileMenu) return;
  burger.setAttribute("aria-expanded", String(open));
  burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  mobileMenu.classList.toggle("is-open", open);
  document.body.classList.toggle("menu-open", open);
}

burger?.addEventListener("click", () => {
  setMenu(burger.getAttribute("aria-expanded") !== "true");
});

$$("a, button", mobileMenu || document.createElement("div")).forEach((element) => {
  element.addEventListener("click", () => {
    if (element.closest("[data-open-custom]")) return; // сначала откроем заявку
    setMenu(false);
  });
});

/* ---------- Появление блоков при прокрутке ---------- */

const revealElements = $$(".reveal");

if (reduceMotion || !("IntersectionObserver" in window)) {
  revealElements.forEach((element) => element.classList.add("is-visible"));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -36px 0px" }
  );

  revealElements.forEach((element) => revealObserver.observe(element));
}

/* ---------- Лёгкий параллакс коллажа ---------- */

const heroVisual = $("#hero-visual");
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (heroVisual && canHover && !reduceMotion) {
  heroVisual.addEventListener("pointermove", (event) => {
    const rect = heroVisual.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    heroVisual.style.setProperty("--mx", `${(x * 22).toFixed(1)}px`);
    heroVisual.style.setProperty("--my", `${(y * 22).toFixed(1)}px`);
  });

  heroVisual.addEventListener("pointerleave", () => {
    heroVisual.style.setProperty("--mx", "0px");
    heroVisual.style.setProperty("--my", "0px");
  });
}

/* ---------- Счётчики в блоке цифр ---------- */

const counters = $$("[data-count]");

function animateCounter(element) {
  const target = Number(element.dataset.count);
  const decimals = Number(element.dataset.decimals || 0);

  if (reduceMotion) {
    element.textContent = target.toFixed(decimals).replace(".", ",");
    return;
  }

  const duration = 1200;
  const start = performance.now();

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = target * eased;
    element.textContent = value.toFixed(decimals).replace(".", ",");
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

if (counters.length) {
  if (!("IntersectionObserver" in window)) {
    counters.forEach(animateCounter);
  } else {
    const counterObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );

    counters.forEach((counter) => counterObserver.observe(counter));
  }
}

/* ---------- Модальные окна ---------- */

const productModal = $("#product-modal");
const orderModal = $("#order-modal");
const orderFormView = $("#order-form-view");
const orderSuccess = $("#order-success");
const orderForm = $("#order-form");
const orderError = $("#order-error");
const orderSubmit = $("#order-submit");

let currentProduct = null;

function openDialog(dialog) {
  if (!dialog || dialog.open) return;
  dialog.showModal();
  document.body.classList.add("modal-open");
}

function closeDialog(dialog) {
  if (dialog?.open) dialog.close();
}

function setBodyLock() {
  const hasOpenDialog = $$("dialog[open]").length > 0;
  document.body.classList.toggle("modal-open", hasOpenDialog);
}

[productModal, orderModal].forEach((dialog) => {
  dialog?.addEventListener("close", setBodyLock);
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog && dialog === productModal) closeDialog(dialog);
  });
});

function reviewsLabel(count) {
  return `${count} ${plural(count, "отзыв", "отзыва", "отзывов")}`;
}

function openProduct(productId) {
  const product = productById.get(productId);
  if (!product || !productModal) return;

  currentProduct = product;

  $("#modal-image").src = `/static/${product.image}`;
  $("#modal-image").alt = product.title;
  $("#product-modal-title").textContent = product.title;
  $("#modal-category").textContent = product.category;
  $("#modal-description").textContent = product.description;
  $("#modal-rating").textContent = String(product.rating).replace(".", ",");
  $("#modal-reviews").textContent = reviewsLabel(product.reviews);
  $("#modal-price").textContent = formatPrice(product.price);

  const oldPrice = $("#modal-old-price");
  oldPrice.textContent = product.old_price ? formatPrice(product.old_price) : "";
  oldPrice.hidden = !product.old_price;

  const badge = $("#modal-badge");
  const badgeText = product.new ? "Новинка" : product.popular ? "Хит" : product.badge;
  badge.hidden = !badgeText;
  badge.textContent = badgeText || "";
  badge.className = "badge modal__badge";
  if (badgeText) badge.classList.add(product.new ? "badge--new" : "badge--hit");

  const features = $("#modal-features");
  features.replaceChildren(
    ...(product.features || []).map((feature) => {
      const item = document.createElement("li");
      item.textContent = feature;
      return item;
    })
  );

  const specs = $("#modal-specs");
  specs.replaceChildren(
    ...Object.entries(product.specs || {}).map(([label, value]) => {
      const item = document.createElement("div");
      item.className = "spec-item";

      const name = document.createElement("span");
      name.textContent = label;

      const text = document.createElement("b");
      text.textContent = value;

      item.append(name, text);
      return item;
    })
  );

  const tags = $("#modal-tags");
  tags.replaceChildren(
    ...(product.tags || []).map((tag) => {
      const item = document.createElement("span");
      item.textContent = `#${tag}`;
      return item;
    })
  );

  const link = $("#modal-link");
  link.href = product.url || "#";

  productModal.querySelector(".modal__content").scrollTop = 0;
  openDialog(productModal);
}

function openOrder(product = null) {
  if (!orderModal) return;

  resetOrderForm();
  orderFormView.hidden = false;
  orderSuccess.hidden = true;

  const title = $("#order-title");
  const subtitle = $("#order-subtitle");
  const productBox = $("#order-product");
  const productInput = $("#order-product-input");

  if (product) {
    title.textContent = "Заказать изделие";
    subtitle.textContent = "Оставьте контакт — подтвердим цену, цвет и срок. Это не оплата.";
    productBox.hidden = false;
    $("#order-product-name").textContent = product.title;
    $("#order-product-price").textContent = formatPrice(product.price);
    productInput.value = product.title;
  } else {
    title.textContent = "Обсудим ваш проект";
    subtitle.textContent = "Расскажите, что нужно напечатать. Поможем с моделью, материалом и ценой.";
    productBox.hidden = true;
    productInput.value = "Своя идея";
  }

  openDialog(orderModal);
  window.setTimeout(() => orderForm?.querySelector('input[name="name"]')?.focus(), 120);
}

function resetOrderForm() {
  if (!orderForm) return;
  orderForm.reset();
  clearFieldErrors();
  orderError.hidden = true;
  orderError.textContent = "";
  orderSubmit.disabled = false;
  orderSubmit.classList.remove("is-loading");
  orderSubmit.innerHTML = `Отправить заявку
    <svg class="btn__arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

function showOrderError(message) {
  orderError.textContent = message;
  orderError.hidden = false;
}

function clearFieldError(fieldName) {
  if (!orderForm) return;
  const message = orderForm.querySelector(`[data-error-for="${fieldName}"]`);
  const input = orderForm.elements[fieldName];
  if (message) {
    message.textContent = "";
    message.hidden = true;
  }
  if (input) input.removeAttribute("aria-invalid");
}

function clearFieldErrors() {
  if (!orderForm) return;
  orderForm.querySelectorAll("[data-error-for]").forEach((message) => {
    message.textContent = "";
    message.hidden = true;
  });
  orderForm.querySelectorAll('[aria-invalid="true"]').forEach((input) => {
    input.removeAttribute("aria-invalid");
  });
}

function showFieldError(fieldName, message) {
  if (!orderForm) return;
  const messageEl = orderForm.querySelector(`[data-error-for="${fieldName}"]`);
  const input = orderForm.elements[fieldName];

  if (messageEl) {
    messageEl.textContent = message;
    messageEl.hidden = false;
  }
  if (input) {
    input.setAttribute("aria-invalid", "true");
    input.focus();
  }
}

// Как только поле заполняют, убираем ошибку именно у него
orderForm?.addEventListener("input", (event) => {
  if (event.target.name) clearFieldError(event.target.name);
});

orderForm?.addEventListener("change", (event) => {
  if (event.target.name) clearFieldError(event.target.name);
});

// Клики по кнопкам «Посмотреть подробно», «Заказать», «Своя идея»
document.addEventListener("click", (event) => {
  const productTrigger = event.target.closest("[data-open-product]");
  if (productTrigger) {
    event.preventDefault();
    openProduct(productTrigger.dataset.openProduct);
    return;
  }

  const customTrigger = event.target.closest("[data-open-custom]");
  if (customTrigger) {
    event.preventDefault();
    setMenu(false);
    openOrder(null);
    return;
  }

  const closeTrigger = event.target.closest("[data-close-modal]");
  if (closeTrigger) {
    closeDialog(closeTrigger.closest("dialog"));
  }
});

// Карточки-кнопки на первом экране работают и с клавиатуры
document.addEventListener("keydown", (event) => {
  const target = event.target;
  const isCardButton = target.matches?.('[role="button"][data-open-product]');

  if (isCardButton && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openProduct(target.dataset.openProduct);
  }

  if (event.key === "Escape") {
    setMenu(false);
  }
});

$("#modal-order")?.addEventListener("click", () => {
  const product = currentProduct;
  closeDialog(productModal);
  window.setTimeout(() => openOrder(product), 90);
});

// Отправка заявки на сервер
orderForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  orderError.hidden = true;
  clearFieldErrors();

  const formData = new FormData(orderForm);
  const name = String(formData.get("name") || "").trim();
  const contact = String(formData.get("contact") || "").trim();
  const comment = String(formData.get("comment") || "").trim();
  const consent = formData.get("consent");

  if (!name) {
    showFieldError("name", "Напишите, как к вам обращаться.");
    return;
  }

  if (!contact) {
    showFieldError("contact", "Оставьте телефон, Telegram или e-mail для связи.");
    return;
  }

  if (!consent) {
    showFieldError("consent", "Нужно согласие на обработку данных, чтобы мы могли ответить.");
    return;
  }

  orderSubmit.disabled = true;
  orderSubmit.classList.add("is-loading");
  orderSubmit.textContent = "Отправляем…";

  try {
    const response = await fetch("/api/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        contact,
        comment,
        product: formData.get("product"),
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Не получилось отправить заявку.");
    }

    orderFormView.hidden = true;
    orderSuccess.hidden = false;
    orderForm.reset();
  } catch (error) {
    showOrderError(
      `${error.message} Напишите нам в Telegram — ответим быстрее.`
    );
    orderSubmit.disabled = false;
    orderSubmit.classList.remove("is-loading");
    orderSubmit.textContent = "Отправить заявку";
  }
});

orderModal?.addEventListener("close", () => {
  window.setTimeout(() => {
    resetOrderForm();
    orderFormView.hidden = false;
    orderSuccess.hidden = true;
  }, 250);
});

/* ---------- Каталог: поиск, теги, сортировка ---------- */

const catalogGrid = $("#catalog-grid");
const catalogCards = catalogGrid ? $$(".product-card", catalogGrid) : [];
const searchInput = $("#search-input");
const searchClear = $("#search-clear");
const resultsCount = $("#results-count");
const emptyState = $("#empty-state");
const resetFilters = $("#reset-filters");
const catalogToolbar = $(".catalog-toolbar");
const sortRoot = $(".sort");
const sortTrigger = $("#sort-trigger");
const sortMenu = $("#sort-menu");
const sortValue = $("#sort-value");
const sortOptions = sortMenu ? $$('[role="option"]', sortMenu) : [];
const tabs = $$(".tab");
const chips = $$(".chip");

const filterState = {
  tab: "all",
  tag: "all",
  query: "",
  sort: "default",
};

function cardMatches(card, query) {
  const matchTab = filterState.tab === "all" || card.dataset[filterState.tab] === "1";
  const cardTags = (card.dataset.tags || "").split("|");
  const matchTag = filterState.tag === "all" || cardTags.includes(filterState.tag);
  const matchQuery = !query || normalize(card.dataset.search).includes(query);
  return matchTab && matchTag && matchQuery;
}

function sortCards() {
  if (!catalogGrid) return;

  const sorted = [...catalogCards].sort((a, b) => {
    if (filterState.sort === "new") {
      return (b.dataset.date || "").localeCompare(a.dataset.date || "");
    }
    if (filterState.sort === "price-asc") {
      return Number(a.dataset.price) - Number(b.dataset.price);
    }
    if (filterState.sort === "price-desc") {
      return Number(b.dataset.price) - Number(a.dataset.price);
    }
    return Number(a.dataset.rank) - Number(b.dataset.rank);
  });

  sorted.forEach((card) => catalogGrid.append(card));
}

function updateResults(visibleCount) {
  if (!resultsCount) return;
  resultsCount.textContent = `Показано ${visibleCount} из ${catalogCards.length} ${plural(
    catalogCards.length,
    "изделия",
    "изделий",
    "изделий"
  )}`;
}

function applyFilters() {
  if (!catalogGrid) return;

  const query = normalize(filterState.query || "");
  let visibleCount = 0;

  catalogCards.forEach((card) => {
    const isVisible = cardMatches(card, query);
    if (isVisible) visibleCount += 1;

    if (isVisible && card.hidden) {
      card.hidden = false;
      if (!reduceMotion) {
        card.animate(
          [
            { opacity: 0, transform: "translateY(10px) scale(.985)" },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
          { duration: 340, easing: "cubic-bezier(.22,1,.36,1)" }
        );
      }
    } else {
      card.hidden = !isVisible;
    }
  });

  sortCards();
  updateResults(visibleCount);

  if (emptyState) emptyState.hidden = visibleCount !== 0;

  const isFiltered =
    filterState.tab !== "all" ||
    filterState.tag !== "all" ||
    Boolean(filterState.query) ||
    filterState.sort !== "default";

  if (resetFilters) resetFilters.hidden = !isFiltered;
  if (searchClear) searchClear.hidden = !searchInput.value;

  searchInput?.closest(".search")?.classList.toggle("has-value", Boolean(searchInput.value));
}

function setTab(tabName) {
  filterState.tab = tabName;

  tabs.forEach((tab) => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  applyFilters();
}

function setTag(tagName) {
  filterState.tag = tagName;

  chips.forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.tag === tagName);
  });

  applyFilters();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => setTab(tab.dataset.tab));
});

chips.forEach((chip) => {
  chip.addEventListener("click", () => {
    const nextTag = chip.dataset.tag;
    setTag(filterState.tag === nextTag && nextTag !== "all" ? "all" : nextTag);
  });
});

searchInput?.addEventListener("input", () => {
  filterState.query = searchInput.value;
  applyFilters();
});

searchClear?.addEventListener("click", () => {
  searchInput.value = "";
  filterState.query = "";
  applyFilters();
  searchInput.focus();
});

function syncSortUI(value) {
  sortOptions.forEach((option) => {
    const active = option.dataset.value === value;
    option.setAttribute("aria-selected", String(active));
    if (active && sortValue) sortValue.textContent = option.textContent.trim();
  });
}

function setSortOpen(open, focusTarget) {
  if (!sortMenu || !sortTrigger) return;
  sortMenu.hidden = !open;
  sortTrigger.setAttribute("aria-expanded", String(open));
  if (!open) return;

  const target =
    focusTarget ||
    sortOptions.find((option) => option.getAttribute("aria-selected") === "true") ||
    sortOptions[0];
  target?.focus();
}

function chooseSort(value) {
  if (!value) return;
  filterState.sort = value;
  syncSortUI(value);
  applyFilters();
  setSortOpen(false);
  sortTrigger?.focus();
}

sortTrigger?.addEventListener("click", () => {
  setSortOpen(sortMenu.hidden);
});

sortTrigger?.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const target =
      event.key === "ArrowDown" ? sortOptions[0] : sortOptions[sortOptions.length - 1];
    setSortOpen(true, target);
  } else if (event.key === "Escape") {
    setSortOpen(false);
  }
});

sortMenu?.addEventListener("click", (event) => {
  const option = event.target.closest('[role="option"]');
  if (option) chooseSort(option.dataset.value);
});

sortMenu?.addEventListener("keydown", (event) => {
  if (!sortOptions.length) return;
  const index = sortOptions.indexOf(document.activeElement);
  const move = (nextIndex) => {
    event.preventDefault();
    sortOptions[(nextIndex + sortOptions.length) % sortOptions.length]?.focus();
  };

  switch (event.key) {
    case "ArrowDown":
      move(index < 0 ? 0 : index + 1);
      break;
    case "ArrowUp":
      move(index < 0 ? sortOptions.length - 1 : index - 1);
      break;
    case "Home":
      move(0);
      break;
    case "End":
      move(sortOptions.length - 1);
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      if (index >= 0) chooseSort(sortOptions[index].dataset.value);
      break;
    case "Escape":
      event.preventDefault();
      setSortOpen(false);
      sortTrigger?.focus();
      break;
    case "Tab":
      setSortOpen(false);
      break;
  }
});

document.addEventListener("click", (event) => {
  if (!sortMenu || sortMenu.hidden) return;
  if (sortRoot?.contains(event.target)) return;
  setSortOpen(false);
});

resetFilters?.addEventListener("click", resetAllFilters);
$("#empty-reset")?.addEventListener("click", resetAllFilters);

function resetAllFilters() {
  filterState.tab = "all";
  filterState.tag = "all";
  filterState.query = "";
  filterState.sort = "default";

  if (searchInput) searchInput.value = "";
  syncSortUI("default");
  setSortOpen(false);

  tabs.forEach((tab) => {
    const active = tab.dataset.tab === "all";
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });

  chips.forEach((chip) => {
    chip.classList.toggle("is-active", chip.dataset.tag === "all");
  });

  applyFilters();
}

// Быстрые ссылки из первого экрана: «Для дома», «В поход» и т. д.
$$("[data-jump-tag]").forEach((button) => {
  button.addEventListener("click", () => {
    setTab("all");
    setTag(button.dataset.jumpTag);

    $("#catalog")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });

    if (catalogToolbar && !reduceMotion) {
      catalogToolbar.animate(
        [
          { boxShadow: "0 0 0 0 rgba(255, 92, 53, 0)" },
          { boxShadow: "0 0 0 6px rgba(255, 92, 53, .16)" },
          { boxShadow: "0 0 0 0 rgba(255, 92, 53, 0)" },
        ],
        { duration: 900, easing: "ease-out" }
      );
    }
  });
});

// Горячие клавиши: «/» или Ctrl/Cmd + K фокусируют поиск
document.addEventListener("keydown", (event) => {
  const tag = event.target.tagName;
  const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  const isDialogOpen = $$("dialog[open]").length > 0;

  const isSearchShortcut =
    (!isTyping && event.key === "/" && !event.metaKey && !event.ctrlKey) ||
    ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k");

  if (!isSearchShortcut || isDialogOpen || !searchInput) return;

  event.preventDefault();
  $("#catalog")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  window.setTimeout(() => searchInput.focus(), reduceMotion ? 0 : 350);
});

/* ---------- Аккордеон вопросов ---------- */

const faqItems = $$(".faq-item");

faqItems.forEach((item, index) => {
  const button = $(".faq-item__question", item);
  const answer = $(".faq-item__answer", item);
  if (!button || !answer) return;

  answer.id = `faq-answer-${index + 1}`;
  button.setAttribute("aria-controls", answer.id);
  button.setAttribute("aria-expanded", "false");

  button.addEventListener("click", () => {
    const willOpen = !item.classList.contains("is-open");

    faqItems.forEach((other) => {
      if (other === item) return;
      other.classList.remove("is-open");
      const otherButton = $(".faq-item__question", other);
      const otherAnswer = $(".faq-item__answer", other);
      otherButton?.setAttribute("aria-expanded", "false");
      if (otherAnswer) otherAnswer.style.maxHeight = "0px";
    });

    item.classList.toggle("is-open", willOpen);
    button.setAttribute("aria-expanded", String(willOpen));
    answer.style.maxHeight = willOpen ? `${answer.scrollHeight}px` : "0px";
  });
});

window.addEventListener("resize", () => {
  const openAnswer = $(".faq-item.is-open .faq-item__answer");
  if (openAnswer) openAnswer.style.maxHeight = `${openAnswer.scrollHeight}px`;
});

/* ---------- Стрелки у ленты новинок ---------- */

const rail = $("#new-rail");
const railPrev = $("[data-rail-prev]");
const railNext = $("[data-rail-next]");

function scrollRail(direction) {
  if (!rail) return;
  const amount = Math.max(rail.clientWidth * 0.75, 280);
  rail.scrollBy({ left: direction * amount, behavior: reduceMotion ? "auto" : "smooth" });
}

railPrev?.addEventListener("click", () => scrollRail(-1));
railNext?.addEventListener("click", () => scrollRail(1));

/* ---------- Старт ---------- */

applyFilters();

// Если пользователь вернулся на страницу с уже выбранной сортировкой —
// просто синхронизируем кастомный список с состоянием (на будущее).
syncSortUI(filterState.sort);

// Закрываем мобильное меню при клике вне шапки
document.addEventListener("click", (event) => {
  if (!mobileMenu?.classList.contains("is-open")) return;
  if (event.target.closest(".site-header")) return;
  setMenu(false);
});
