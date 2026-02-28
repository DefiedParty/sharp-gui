# 工作流：添加国际化文本

## 核心原则

**所有用户可见的文本都必须通过 i18n 处理**，禁止在组件中硬编码文字。

---

## 步骤

### 1. 确定 i18n key

使用 `camelCase` 命名，按功能模块组织：

```
{模块}{描述}
```

示例：
- `galleryEmpty` — 图库模块，空状态
- `taskProgress` — 任务模块，进度
- `settingsWorkspace` — 设置模块，工作区
- `viewerFullscreen` — 查看器模块，全屏

### 2. 在两个语言文件中同时添加

**frontend/src/i18n/en.json**：
```json
{
  "existingKey": "existing value",
  "myNewKey": "English text"
}
```

**frontend/src/i18n/zh.json**：
```json
{
  "existingKey": "已有值",
  "myNewKey": "中文文本"
}
```

> ⚠️ **两个文件必须同时添加，不可遗漏任何一个。**

### 3. 在组件中使用

```typescript
import { useTranslation } from 'react-i18next';

export function MyComponent() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('myNewKey')}</h1>
    </div>
  );
}
```

### 4. 带参数插值

**语言文件**：
```json
// en.json
{ "fileSize": "File size: {{size}}" }

// zh.json
{ "fileSize": "文件大小：{{size}}" }
```

**组件中**：
```typescript
t('fileSize', { size: '2.3 MB' })
```

---

## 快速参考

| 操作 | 代码 |
|------|------|
| 引入 hook | `import { useTranslation } from 'react-i18next'` |
| 获取翻译函数 | `const { t } = useTranslation()` |
| 基本翻译 | `t('myKey')` |
| 带参数 | `t('myKey', { count: 5 })` |
| 切换语言 | `import { toggleLanguage } from '@/i18n'` → `toggleLanguage()` |

## 语言文件位置

```
frontend/src/i18n/
├── index.ts     # 初始化配置 + toggleLanguage()
├── en.json      # 英文
└── zh.json      # 中文
```

## 检查清单

- [ ] key 使用 `camelCase`（不用 `snake_case`）
- [ ] `en.json` 已添加
- [ ] `zh.json` 已添加
- [ ] 两个文件的 key 完全一致
- [ ] 翻译内容准确自然
- [ ] 组件中使用 `t('key')` 而非硬编码
