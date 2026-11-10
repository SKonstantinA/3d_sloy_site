"""
СЛОЙ — сайт-презентация изделий на 3D-принтере.

Запуск:
    python app.py

Все карточки товаров лежат в content.json — их можно добавлять
и редактировать без изменения кода.
"""

import json
from collections import Counter
from datetime import datetime
from pathlib import Path

from flask import Flask, jsonify, render_template, request

# Папка, в которой находится app.py (работает из любого места запуска)
BASE_DIR = Path(__file__).resolve().parent
CONTENT_FILE = BASE_DIR / "content.json"
ORDERS_FILE = BASE_DIR / "orders.json"

app = Flask(__name__)


def load_content():
    """Читаем content.json и возвращаем словарь с настройками и товарами."""
    with open(CONTENT_FILE, "r", encoding="utf-8") as file:
        content = json.load(file)

    if not content.get("products"):
        raise ValueError("В content.json нет списка products с карточками.")

    return content


def get_tag_counts(products):
    """Считаем, сколько карточек у каждого тега. Сортируем по популярности."""
    counter = Counter()
    for product in products:
        for tag in product.get("tags", []):
            counter[tag] += 1

    return [
        {"name": tag, "count": count}
        for tag, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


@app.template_filter("price")
def format_price(value):
    """1690 -> '1 690 ₽'."""
    if value is None:
        return ""
    return f"{int(value):,}".replace(",", " ") + " ₽"


@app.template_filter("plural")
def plural(number, one, few, many):
    """Русское склонение: 1 отзыв, 2 отзыва, 5 отзывов."""
    number = abs(int(number)) % 100
    if 11 <= number <= 19:
        return many
    number = number % 10
    if number == 1:
        return one
    if 2 <= number <= 4:
        return few
    return many


@app.route("/")
def index():
    content = load_content()
    products = content["products"]
    products_by_id = {product["id"]: product for product in products}

    def pick(product_id, fallback_index):
        """Берём товар для обложки, но не падаем, если его удалили."""
        return products_by_id.get(product_id) or products[fallback_index % len(products)]

    popular = [product for product in products if product.get("popular")][:3]
    new_products = [product for product in products if product.get("new")][:6]

    return render_template(
        "index.html",
        content=content,
        site=content.get("site", {}),
        products=products,
        products_json=products,
        tags=get_tag_counts(products),
        popular=popular,
        new_products=new_products,
        popular_count=sum(1 for product in products if product.get("popular")),
        new_count=sum(1 for product in products if product.get("new")),
        hero_main=pick("mushroom-lamp", 0),
        hero_secondary=pick("self-watering-planter", 1),
        hero_tertiary=pick("key-holder", 2),
    )


@app.post("/api/order")
def create_order():
    """Принимаем заявку с сайта и сохраняем её в orders.json."""
    data = request.get_json(silent=True) or {}

    # Ограничиваем длину, чтобы в файл не попал огромный текст
    name = str(data.get("name", "")).strip()[:120]
    contact = str(data.get("contact", "")).strip()[:200]
    product = str(data.get("product", "")).strip()[:200]
    comment = str(data.get("comment", "")).strip()[:2000]

    if not name or not contact:
        return jsonify({"ok": False, "error": "Укажите имя и контакт для связи."}), 400

    order = {
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "name": name,
        "contact": contact,
        "product": product or "Своя идея",
        "comment": comment,
    }

    # Если файла ещё нет или он повреждён — начинаем список заново
    orders = []
    if ORDERS_FILE.exists():
        try:
            with open(ORDERS_FILE, "r", encoding="utf-8") as file:
                orders = json.load(file)
            if not isinstance(orders, list):
                orders = []
        except (json.JSONDecodeError, OSError):
            orders = []

    orders.append(order)
    with open(ORDERS_FILE, "w", encoding="utf-8") as file:
        json.dump(orders, file, ensure_ascii=False, indent=2)

    return jsonify({
        "ok": True,
        "message": "Заявка сохранена. Свяжемся с вами в течение рабочего дня.",
    })


if __name__ == "__main__":
    # debug=True удобен для разработки: сайт сам перезагружается после правок.
    app.run(debug=True, host="127.0.0.1", port=5000)
