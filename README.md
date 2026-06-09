# ВЕКТОР — стартовий репозиторій

Один репозиторій містить два статичні сайти:

- `/official/` — офіційний сайт аналітичної системи
- `/admin/` — адмін-сайт для керування доступом

## GitHub Pages

Після публікації репозиторію увімкни GitHub Pages:

`Settings → Pages → Deploy from branch → main → /root`

Після цього сторінки будуть доступні за шляхами:

- `https://<username>.github.io/<repo>/official/`
- `https://<username>.github.io/<repo>/admin/`

## Структура

```text
peleng-reb-starter/
├── index.html
├── assets/
│   └── login-bg.png
├── official/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── admin/
    ├── index.html
    ├── styles.css
    └── app.js
```
