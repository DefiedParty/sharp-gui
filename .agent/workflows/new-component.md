# 工作流：创建新 React 组件

## 前置条件

- 确定组件分类：`common/` | `gallery/` | `layout/` | `viewer/`
- 确定组件名称（PascalCase）

---

## 步骤

### 1. 创建组件目录与文件

在对应分类目录下创建三件套：

```
frontend/src/components/{category}/ComponentName/
├── ComponentName.tsx        # 组件实现
├── ComponentName.module.css # CSS Modules 样式
└── index.ts                 # 桶导出
```

### 2. 编写组件文件

**ComponentName.tsx**：

```typescript
import { useTranslation } from 'react-i18next';
import styles from './ComponentName.module.css';

interface ComponentNameProps {
  // 定义 Props
}

export function ComponentName({ ...props }: ComponentNameProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.container}>
      {/* 组件内容 */}
    </div>
  );
}
```

**关键要求**：
- 使用 `export function`（命名导出，不用 `export default` 或 `React.FC`）
- Props 使用 `interface ComponentNameProps` 定义
- 如需扩展原生 HTML 属性，`extends` 对应类型（如 `ButtonHTMLAttributes`）
- 使用 `@/` 路径别名导入
- 用户可见文本使用 `t('key')` 国际化

### 3. 编写样式文件

**ComponentName.module.css**：

```css
.container {
  /* 使用设计系统 Token */
  padding: var(--space-md);
  border-radius: var(--radius-md);
  transition: all var(--transition-normal);
}
```

**关键要求**：
- class 名使用 camelCase
- 使用 `variables.css` 中定义的 CSS 变量
- 间距用 `--space-*`，圆角用 `--radius-*`，过渡用 `--transition-*`

### 4. 编写桶导出

**index.ts**：

```typescript
export { ComponentName } from './ComponentName';
```

### 5. 在父级桶导出中注册

如果该分类目录有 `index.ts`（如 `components/common/index.ts`），需要添加：

```typescript
export { ComponentName } from './ComponentName';
```

### 6. 添加国际化文本

如果组件包含用户可见文本，同时在两个文件中添加：

**frontend/src/i18n/en.json**：
```json
{ "componentNameTitle": "My Component" }
```

**frontend/src/i18n/zh.json**：
```json
{ "componentNameTitle": "我的组件" }
```

---

## 检查清单

- [ ] 组件目录位于正确的分类下（common/gallery/layout/viewer）
- [ ] 使用 PascalCase 命名
- [ ] 三件套完整：`.tsx` + `.module.css` + `index.ts`
- [ ] 使用命名导出 `export function`
- [ ] Props 使用 `interface` 定义
- [ ] 导入使用 `@/` 路径别名
- [ ] 样式使用 CSS Variables Token
- [ ] 在父级 `index.ts` 中注册
- [ ] 用户可见文本已国际化（en.json + zh.json 同步）
- [ ] 纯类型导入使用 `import type`
