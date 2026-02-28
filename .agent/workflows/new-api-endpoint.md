# 工作流：添加新 API 端点

## 概述

添加一个新的 API 端点需要同时修改 **后端（Flask）** 和 **前端（React）** 的多个文件。

---

## 步骤

### 1. 后端：在 app.py 中添加路由

```python
@app.route('/api/my-endpoint', methods=['POST'])
def api_my_endpoint():
    """端点功能描述（中文）"""
    try:
        data = request.get_json()
        # 业务逻辑
        result = process_data(data)
        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
```

**规则**：
- 路由必须以 `/api/` 开头
- 函数名使用 `api_` 前缀 + `snake_case`
- 返回 JSON（`jsonify()`）
- 错误返回 `{"error": "msg"}` + 对应状态码
- 添加中文 docstring
- 如需限制仅本机访问，检查 `request.remote_addr`

### 2. 前端：定义类型

在 `frontend/src/types/` 对应文件中添加（或创建新文件）：

```typescript
// types/myFeature.ts （新文件）
export interface MyRequest {
  param1: string;
  param2: number;
}

export interface MyResponse {
  success: boolean;
  data: MyData;
}
```

如创建了新的类型文件，需在 `types/index.ts` 中添加：

```typescript
export type { MyRequest, MyResponse } from './myFeature';
```

### 3. 前端：添加 API 调用函数

在 `frontend/src/api/` 对应模块中添加（或创建新模块文件）：

```typescript
// api/myFeature.ts （新文件或追加到现有模块）
import { apiPost } from './client';
import type { MyRequest, MyResponse } from '@/types';

export async function myEndpoint(data: MyRequest): Promise<MyResponse> {
  return apiPost<MyResponse>('/api/my-endpoint', data);
}
```

**使用正确的 HTTP 方法对应函数**：
| 后端方法 | 前端函数 |
|----------|----------|
| GET | `apiGet<T>()` |
| POST (JSON) | `apiPost<T>()` |
| POST (文件) | `apiPostFormData<T>()` |
| DELETE | `apiDelete<T>()` |

如创建了新的 API 模块文件，需在 `api/index.ts` 中添加：

```typescript
export * from './myFeature';
```

### 4. 前端：在组件/Hook中调用

```typescript
import { myEndpoint } from '@/api';
import type { MyRequest } from '@/types';

// 在组件或 Hook 中
const handleSubmit = async () => {
  try {
    const result = await myEndpoint({ param1: 'value', param2: 42 });
    // 处理结果
  } catch (error) {
    // 错误处理
  }
};
```

---

## 检查清单

- [ ] 后端路由以 `/api/` 开头
- [ ] 后端函数有中文 docstring
- [ ] 后端返回统一的 JSON 格式
- [ ] 后端错误处理使用 `try/except`
- [ ] 前端类型定义在 `types/` 中，并在 `index.ts` 中导出
- [ ] 前端 API 函数使用 `client.ts` 的封装方法
- [ ] 前端 API 函数在 `api/index.ts` 中导出
- [ ] 使用 `import type` 导入纯类型
- [ ] 如有用户可见的错误/提示文本，已添加 i18n

---

## 现有端点参考

| 方法 | 路径 | 前端函数 | 类型 |
|------|------|----------|------|
| GET | `/api/gallery` | `fetchGallery()` | `GalleryListResponse` |
| POST | `/api/generate` | `generateFromImages()` | `GenerateResponse` |
| GET | `/api/tasks` | `fetchTasks()` | `TasksResponse` |
| POST | `/api/task/<id>/cancel` | `cancelTask()` | — |
| DELETE | `/api/delete/<id>` | `deleteGalleryItem()` | — |
| GET | `/api/download/<id>` | `downloadModel()` | Blob |
| GET | `/api/export/<id>` | `exportModel()` | Blob |
| GET | `/api/settings` | `fetchSettings()` | `SettingsData` |
| POST | `/api/settings` | `saveSettings()` | — |
| POST | `/api/browse-folder` | `browseFolder()` | `{ path }` |
| POST | `/api/restart` | `restartServer()` | — |
