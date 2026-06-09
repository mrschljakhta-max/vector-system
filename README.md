# VECTOR — стартовий репозиторій

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
vector-system/
├── index.html
├── assets/
│   ├── bg-light.png
│   ├── bg-dark.png
│   ├── logo-dark.png
│   └── logo-light.png
├── official/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── admin/
    ├── index.html
    ├── styles.css
    └── app.js
```
