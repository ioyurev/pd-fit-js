## Usage

```bash
$ npm install # or pnpm install or yarn install
```

### Learn more on the [Solid Website](https://solidjs.com) and come chat with us on our [Discord](https://discord.com/invite/solidjs)

## Available Scripts

In the project directory, you can run:

### `npm run dev`

Runs the app in the development mode.<br>
Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

### `npm run build`

Builds the app for production to the `dist` folder.<br>
It correctly bundles Solid in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br>
Your app is ready to be deployed!

## Deployment

Learn more about deploying your application with the [documentations](https://vite.dev/guide/static-deploy.html)

---

## Архитектурные инварианты

Проект обязан неукоснительно соблюдать принципы **SRP**, **DRY** и **SSOT**. Это не рекомендация, а обязательное инженерное правило.

### SRP — Single Responsibility Principle
Каждый модуль должен иметь одну причину для изменения.

Обязательные правила:
- UI-компоненты отвечают только за отображение и пользовательские события.
- Компоненты не содержат термодинамические расчёты, экспорт, сериализацию или парсинг схемы параметров.
- Store отвечает только за хранение состояния и orchestration state transitions.
- Численные методы, физико-химические формулы, экспорт, форматирование и URL persistence вынесены в отдельные модули.
- Worker не содержит бизнес-логики, а только изолирует тяжёлые вычисления.

### DRY — Don't Repeat Yourself
Любое доменное знание должно быть реализовано в одном месте.

Обязательные правила:
- Схема имён параметров, их метаданные, units, bounds, defaults и правила группировки описываются только в `parameterSchema`.
- Правила отображения ветвей описываются только в одном модуле представления ветвей.
- Правила chart theme описываются только в одном модуле.
- Правила численного дифференцирования описываются только в одном модуле numerics.
- Дублирование regex, `startsWith`, `endsWith`, строковых шаблонов параметров и branch labels в разных файлах запрещено.

### SSOT — Single Source of Truth
Каждая сущность должна иметь один канонический источник правды.

Обязательные правила:
- В state хранятся только канонические входные данные.
- Производные величины не хранятся как самостоятельное редактируемое состояние.
- `weight` не хранится отдельно, а вычисляется только из `sigma`.
- Метрики подгонки (`calcT`, residuals, chiSq, Rwp, RMSE, R²) являются derived data.
- `corrMatrix` и `corrWarnings` выводятся из `covMatrix`, а не хранятся отдельно.
- Схема параметров и branch metadata имеют единый источник правды.

### Запрещённые практики
- Доменные вычисления внутри UI-компонентов.
- Повторный парсинг имён параметров в нескольких модулях.
- Хранение одной и той же физической величины в двух полях состояния.
- Копирование chart options/theme logic между компонентами.
- Экспорт CSV/XLSX/Markdown прямо внутри UI-компонентов.

### Definition of Done
Изменение считается завершённым только если:
- не нарушает SRP;
- не создаёт дублирование знаний;
- не создаёт вторую копию истины;
- проходит review по архитектурному checklist.
