# Материалы Atelier

Новые растровые материалы созданы для этого проекта встроенным инструментом imagegen. Они переведены в WebP без изменения композиции и служат иллюстрациями пространства и рецептов.

| Файл | Содержание |
| --- | --- |
| `assets/atelier-courtyard.webp` | Архитектурное пространство тишины |
| `assets/recipe-toast.webp` | Тост с авокадо и яйцом |
| `assets/recipe-bowl.webp` | Боул с лососем и киноа |
| `assets/recipe-yogurt.webp` | Йогурт с ягодами |
| `assets/recipe-chicken.webp` | Курица с гречкой |
| `assets/recipe-oats.webp` | Овсянка с бананом |
| `assets/recipe-lentils.webp` | Салат с чечевицей |
| `assets/logo.svg`, `assets/logo-light.svg` | Векторные логотипы |
| `assets/favicon.svg`, PNG-иконки | Знак-печать и иконки установки |

Монограмма создана в SVG. Буквы логотипа получены из контуров DejaVu Serif; шрифтовой файл в приложение не встроен. Пиктограммы адаптированы из Lucide; лицензия — `licenses/lucide-ISC.txt`.

## Архитектурная фотография: полный промпт

Use case: photorealistic-natural. Asset type: cinematic editorial hero photograph for RITUA ATELIER, a refined personal wellbeing digital atelier. Wide landscape photograph 1536x1024. A secluded Mediterranean modernist courtyard at quiet late afternoon, viewed from inside a shaded limestone arcade: weathered warm ivory travertine walls, a tall sculptural arch to the right, a still dark olive reflective plunge pool in the foreground, one mature olive tree in a raised stone planter at the far left, muted green foliage above the wall. Sun creates a precise diagonal beam and long architectural shadows on tactile sandstone. A folded natural linen towel on a low monolithic stone bench at lower right. Extremely understated, lived-in, expensive retreat, no opulent decoration. Composition: harmonious spacious architecture with dark shaded lower left and lower center where white UI copy will later overlay, bright sunlit upper right, no objects blocking lower left. Grounded architectural magazine photography, subtle analog film grain, natural stone imperfections, very realistic plants, still water reflections, soft atmospheric depth, muted olive and champagne limestone palette, deep natural shadows, slow contemplative mood. Avoid people, lettering, signage, logos, watermark, rendered interface, collage, neon, excessive orange, spa candles, generic stock-photo treatment. Single coherent premium photograph.

## Рецепты: промпты

Каждый рецепт создан отдельным вызовом. Первый шаблон:

Use case: photorealistic-natural. Asset type: premium recipe editorial photograph for the RITUA ATELIER wellbeing app, landscape 1536x1024. Subject: [SUBJECT]. Single complete dish, styled with restraint in a matte handmade ivory ceramic plate or bowl on pale warm travertine. Background has a lightly folded natural oat linen napkin and soft olive leaf shadows from off-frame. Shot 45 degrees from overhead, food centered with generous natural breathing room around it; entire plate visible, no hands, no cutlery overlapping food. Directional soft Mediterranean afternoon light from the upper left, tactile real ingredients and tiny natural imperfections. Elegant independent food magazine photography, muted olive greens, warm limestone, natural honest food colors, subtle analog grain, soft shadows. Cohesive restrained still life, no garnish not specified, no additional dishes, no people, no writing, no labels, no logos, no border, no collage, no watermark, no interface. Photorealistic, inviting, naturally premium.

Подстановки `[SUBJECT]`:

- Toast: A single thick slice of rustic wholegrain sourdough toast topped with naturally sliced avocado, a softly cooked whole egg with a beautiful golden yolk, and small ripe tomato pieces. Exact ingredients bread, avocado, egg and tomato only.
- Bowl: A sophisticated but natural lunch bowl: roasted salmon fillet with visible flaky texture, fluffy cooked quinoa, cucumber slices, avocado wedges and a few tender salad leaves. Exact ingredients salmon, quinoa, cucumber, avocado, salad leaves only.
- Yogurt: A small ceramic bowl of thick Greek yogurt topped with fresh blueberries and raspberries, coarsely chopped almonds and a fine drizzle of honey. Exact ingredients Greek yogurt, berries, almonds and honey only.

Второй шаблон:

Use case: photorealistic-natural. Asset type: premium recipe editorial photograph for the RITUA ATELIER wellbeing app, landscape 1536x1024. Subject: [SUBJECT]. Single complete dish, styled with restraint in a matte handmade ivory ceramic plate or bowl on pale warm travertine. Background has a lightly folded natural oat linen napkin to the right and soft olive branch shadows at upper left. Shot 45 degrees from overhead, food centered with natural breathing room around it; entire plate visible, no hands, no cutlery over food. Directional Mediterranean afternoon light from the upper left, tactile real ingredients and tiny imperfections. Elegant independent food magazine photography, muted olive greens and warm limestone, subtle analog grain, soft beautiful shadows. Natural honest food colors, understated premium quality. No garnish not specified, no additional dishes, no people, no writing, no labels, no logos, no borders, no collage, no watermark, no UI.

Подстановки:

- Chicken: A warm deep plate of cooked buckwheat topped with slices of fully cooked roasted chicken breast and steamed broccoli florets, a light sheen of olive oil. Exact food ingredients buckwheat, chicken breast, broccoli, olive oil only.
- Oats: A small ceramic bowl of creamy oatmeal cooked in milk, topped with naturally arranged banana slices and roughly broken walnut pieces. Exact ingredients oat flakes, milk, banana and walnuts only. No berries, no honey.
- Lentils: A rustic warm salad of cooked brown lentils, ripe tomato chunks, a few fresh mixed salad leaves, thin shavings of pale hard cheese and a light sheen of olive oil. Exact food ingredients lentils, tomato, salad leaves, hard cheese, olive oil only.

Унаследованный `assets/ritua-still-life.webp` сохранён как материал первой редакции. Основной интерфейс использует новую серию.
