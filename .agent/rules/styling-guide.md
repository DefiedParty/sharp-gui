# 样式规范

## 样式方案概述

项目采用 **CSS Modules + CSS Variables 设计系统**，风格遵循 Apple Human Interface Guidelines（毛玻璃效果 / 精细动画 / SF Pro 字体）。

**不使用**：CSS-in-JS、Tailwind、Sass/Less。

> 🎨 **进行 UI 设计或界面改进时**，可调用 Skill：[.agent/skills/ui-ux-pro-max/SKILL.md](../.agent/skills/ui-ux-pro-max/SKILL.md) 获取设计系统推荐（配色、字体、布局模式等）。

---

## CSS Modules

每个组件的样式使用 `.module.css` 文件，class 名自动 hash 化：

```css
/* Button.module.css */
.button {
  display: inline-flex;
  align-items: center;
  gap: var(--space-sm);
  border-radius: var(--radius-md);
  transition: all var(--transition-normal);
}

.primary {
  background: var(--accent-blue);
  color: white;
}
```

```typescript
// Button.tsx
import styles from './Button.module.css';

<button className={styles.button}>...</button>
```

### class 命名约定

| 范围 | 规范 | 示例 |
|------|------|------|
| CSS Modules class | camelCase | `.actionBtn`, `.sectionTitle`, `.statusIcon` |
| 全局 CSS class（App.css, global.css） | kebab-case | `.boot-screen`, `.empty-state` |
| CSS 变量 | kebab-case, `--` 前缀 | `--accent-blue`, `--glass-bg` |

---

## 设计系统 Token

所有设计 Token 定义在 `frontend/src/styles/variables.css`。新增变量 **必须** 定义在此文件中。

> **⚠️ 注意**：`index.css` 中存在部分重复的 CSS 变量定义（历史遗留），新变量一律添加到 `variables.css`。

### 色彩

```css
:root {
  --bg-color: #f5f5f7;
  --text-primary: #1d1d1f;
  --text-secondary: #666;
  --text-muted: #888;
  --accent-blue: #0071e3;
  --accent-blue-hover: #0077ed;
  --success-color: #34c759;
  --warning-color: #f0ad4e;
  --danger-color: #dc3545;
  --error-color: #ff3b30;
}
```

### 间距（4px 递增系统）

```css
:root {
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 20px;
  --space-2xl: 24px;
}
```

### 圆角（6 档）

```css
:root {
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --radius-2xl: 24px;
  --radius-full: 50%;
}
```

### 过渡（3 级速度 + 弹性）

```css
:root {
  --transition-fast: 0.15s ease;
  --transition-normal: 0.2s ease;
  --transition-slow: 0.3s ease;
  --transition-bounce: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 毛玻璃效果

```css
:root {
  --glass-bg: rgba(255, 255, 255, 0.65);
  --glass-bg-light: rgba(255, 255, 255, 0.5);
  --glass-border: rgba(255, 255, 255, 0.6);
  --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07);
  --glass-blur: blur(30px) saturate(180%);
}
```

使用毛玻璃效果的标准写法：

```css
.panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow);
}
```

### 布局

```css
:root {
  --sidebar-width: 280px;
  --controls-height: 60px;
}
```

---

## 字体

使用 Apple 系统字体栈：

```css
font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
             "Helvetica Neue", Arial, sans-serif;
```

---

## 动画

全局动画关键帧定义在 `frontend/src/styles/animations.css`，新增全局动画应添加到此文件。

常用动画模式：
- 使用 `cubic-bezier` 缓动曲线（非线性 `ease`）
- 交互反馈动画时长：0.15s~0.3s
- 加载/骨架屏动画：使用 `@keyframes` + `infinite`
- 列表项删除：平滑滑出动画

---

## 响应式设计

项目适配三种设备：

| 设备 | 断点 | 布局 |
|------|------|------|
| 桌面 | ≥1024px | 侧边栏 + 预览区并排 |
| 平板 | 768px~1023px | 分栏布局 |
| 手机 | <768px | 抽屉式侧边栏 |

### 暗色模式

通过 `@media (prefers-color-scheme: dark)` 自动适配系统偏好。

---

## 规则总结

1. **组件样式**用 CSS Modules（`.module.css`）
2. **设计 Token** 必须使用 `variables.css` 中定义的 CSS 变量
3. **新增 CSS 变量**统一添加到 `variables.css`
4. **间距**使用 `--space-*` token，不要硬编码像素值
5. **圆角**使用 `--radius-*` token
6. **过渡**使用 `--transition-*` token
7. **毛玻璃效果**使用 `--glass-*` 系列变量
8. **不引入** CSS-in-JS、Tailwind、Sass/Less
