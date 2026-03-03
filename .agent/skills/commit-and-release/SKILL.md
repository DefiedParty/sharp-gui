---
name: commit-and-release
description: Sharp GUI 项目的 Commit Message 和 Release Note 格式规范
---

# Commit Message & Release Note 规范

本 Skill 定义了 Sharp GUI 项目的 Git Commit Message 和 GitHub Release Note 的书写格式规范。当用户要求生成 commit message 或 release note 时，必须严格遵循以下规则。

---

## Commit Message 规范

### 格式

使用 **Conventional Commits** 格式，语言为 **中文**。

#### 标题行

```
type(scope): 简要描述
```

- **type**: `feat` | `fix` | `refactor` | `chore` | `docs` | `style` | `perf`
- **scope** (可选): 影响的模块，如 `install` | `update` | `run` | `app` | `frontend`
- 标题行不超过 72 字符
- 不以句号结尾

#### 正文 (大改动才需要)

- 用空行与标题分隔
- 按分类组织，分类名后接冒号
- 用 `-` 列表描述具体变更
- 二级细节用缩进 `  -`
- 简洁，不写废话

### 示例

**小改动** (单行即可):

```
fix: 赋予 update.sh 执行权限
```

**中等改动** (附简短说明):

```
fix: update.py 解压路径修复 - 移至 tools/ 后解压到了错误目录

get_script_dir() 返回 tools/ 而非项目根目录，导致 zip 被解压
到 tools/ 内而不是项目根目录。改为返回 tools/ 的父目录。
```

**大改动** (分类组织):

```
feat: 添加自动更新脚本 & 重构工具目录 & 修复 install.bat 闪退

新增功能:
- 添加 update.py/update.bat/update.sh 自动更新脚本
  - GitHub Release 版本检测 (无 API 限流)
  - 版本比较防止降级 (pre-release → 旧 stable)
- release.yml 自动写入 version.txt

目录重构:
- 工具脚本移至 tools/ 目录
  - detect_cuda.py, download_model.py, generate_cert.py, update.py
- 更新所有引用: install.bat/sh, release.yml, README.md 等

Bug 修复 (install.bat):
- 修复 CUDA 检测闪退: for /f 内联 Python 语法冲突
- 修复 nvcc 版本解析带尾部逗号 (12.4, → 12.4)
```

---

## Release Note 规范

### 定位

- **面向普通用户**，不展示过多技术实现细节
- **中英双语**，每行先中文后英文，用 `/` 分隔
- 语气简洁明了，突出用户能感知到的变化和价值
- 输出时使用 markdown 代码块包裹，方便用户直接复制

### 结构模板

```markdown
## 🚀 vX.Y.Z(-rc.N) (Pre-Release)

> ⚠️ 这是预发布版本，用于测试验证。正式版将在测试通过后发布。
>
> ⚠️ This is a pre-release for testing. Stable release coming after validation.

---

### 🎯 功能标题 / Feature Title

- **中文粗体关键词**: 中文描述 / English description
- **中文粗体关键词**: 中文描述 / English description

### 🐛 Bug 修复 / Bug Fixes

- **修复 xxx**: 中文描述 / English description

### 🔧 技术改进 / Technical Improvements

- 中文描述 / English description

---

### 📦 快速使用 / Quick Start

1. 下载 `sharp-gui-vX.Y.Z.zip` / Download the zip file
2. 解压后运行安装脚本 / Extract and run install script:
   - **Linux/macOS**: `./install.sh && ./run.sh`
   - **Windows**: `install.bat` 然后 `run.bat`
3. 浏览器访问 / Open browser: `https://127.0.0.1:5050`

### 🔄 从旧版本更新 / Update from Previous Version

- **Release 包用户**: 运行 `update.bat` 或 `./update.sh` / Run update script
- **Git 用户**: `git pull origin main` 后重跑 `install.bat` 或 `./install.sh` / Pull and re-run install

📖 **中文详细教程**: [查看 README](https://github.com/lueluelue12138/sharp-gui)

📖 **English Guide**: [View README.en.md](https://github.com/lueluelue12138/sharp-gui/blob/main/README.en.md)
```

### 规则

1. Pre-release 版本标题带 `Pre-Release`，正式版不带
2. Pre-release 需要顶部 `> ⚠️` 警告 blockquote，正式版不需要
3. 章节标题使用 emoji: 🆕🎮📥🐛🔧📁🔄 等，按内容选择合适的
4. 每个 bullet 格式: `- **粗体关键词**: 描述 / English desc`
5. 如有从旧版升级的说明，加 `### 🔄 从旧版本更新 / Update` 章节
6. 底部固定 Quick Start + README 链接
7. 不要写代码实现细节（如函数名、变量名），只写用户能感知的变化
8. 输出必须用 markdown 代码块包裹 (`markdown ... `)，方便用户复制
9. Pre-release 版本的更新指引中，`update.bat`/`update.sh` 必须加 `--pre` 参数（如 `update.bat --pre` 或 `./update.sh --pre`），正式版不需要
