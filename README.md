# 优耐特施部门知识问答 · Netlify 正式版

这是部门问答站的 **Netlify Functions + Blobs** 版本，保留原站的全部核心功能：

- 首页、分类浏览、关键词搜索、分页、排序
- 问题详情、回答、采纳最佳回答
- 访客可提交问题和回答，**提交后进入待审核队列**
- 管理员登录后台，审核问题/回答、编辑、删除、标记解决、清除示例
- JSON / CSV 导出
- 数据存 Netlify Blobs，不再是单台电脑上的 JSON 文件

> 重要：这个版本 **不能直接拖进 Netlify Drop**。  
> Netlify 的拖拽部署只发布静态文件，不会部署 Functions；本站的共享数据和管理员审核都依赖 Functions。请用 GitHub 连接或 Netlify CLI 部署（二选一，见下文）。

---

## 1. 目录结构

```text
dept-qa-netlify/
├─ netlify.toml
├─ package.json
├─ public/
│  ├─ index.html
│  ├─ _headers
│  └─ assets/
│     ├─ app.js
│     ├─ styles.css
│     └─ favicon.svg
├─ netlify/
│  ├─ functions/
│  │  └─ api.mjs          # /api/* 入口
│  └─ lib/
│     ├─ handler.mjs      # 全部 API
│     ├─ core.mjs         # 校验、摘要、统计、种子
│     ├─ store.mjs        # Netlify Blobs 读写
│     └─ seed.mjs         # 首次启动的 10 条示例
└─ scripts/
   ├─ netlify-test.mjs    # 无网络 API 测试
   └─ dev-server.mjs      # 本地预览
```

---

## 2. 部署前准备

1. 注册/登录 [Netlify](https://app.netlify.com/)。
2. 准备一个 Netlify 能访问的 Git 仓库（GitHub/GitLab/Bitbucket），或安装 Netlify CLI。
3. 想好两个环境变量：
   - `QA_ADMIN_PASSWORD`：管理员密码，至少 16 位，建议随机生成。
   - `QA_SESSION_SECRET`：登录 Cookie 签名密钥，至少 32 位随机字符串。
4. 不要把真实密码写进仓库，也不要把密码发给别人。

生成随机值（本机有 Node 时）：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

---

## 3. 方式 A：GitHub + Netlify 网页部署（推荐给非技术同事）

1. 新建一个 GitHub 仓库，把本目录全部文件上传（不要上传 `node_modules`、`.netlify`）。
2. Netlify 控制台 → **Add new site** → **Import an existing project** → 选择 GitHub 仓库。
3. 构建设置：
   - **Build command**：留空（或填 `npm install`）
   - **Publish directory**：`public`
   - **Functions directory**：`netlify/functions`
4. 在 **Site configuration → Environment variables** 添加：
   - `QA_ADMIN_PASSWORD` = 你的强密码
   - `QA_SESSION_SECRET` = 你的随机密钥
   - 可选：`QA_PUBLIC_ORIGIN` = `https://你的站点.netlify.app`（绑定自定义域名后改成正式域名）
5. 点击 **Deploy site**，等待 Functions 和静态资源部署完成。
6. 打开站点，首次访问会自动把 10 条示例写入 Netlify Blobs。

> 绑定自定义域名：**Domain management → Add a domain**。Netlify 会自动签发 HTTPS 证书。  
> 如果域名在中国大陆备案，且服务器在境外（Netlify），通常不需要大陆 ICP 接入；具体以域名注册商/合规要求为准。

---

## 4. 方式 B：Netlify CLI 部署

在本目录执行：

```bash
# 安装依赖（本地测试可选；部署时 Netlify 会安装）
npm install

# 登录并关联站点
npx netlify-cli login
npx netlify-cli init

# 设置环境变量（按提示输入值）
npx netlify-cli env:set QA_ADMIN_PASSWORD
npx netlify-cli env:set QA_SESSION_SECRET

# 部署到生产
npx netlify-cli deploy --prod
```

部署完成后，CLI 会输出站点地址。首次打开会自动写入示例数据。

> 如果你只想先看效果，可用 `npx netlify-cli dev` 本地预览；本地预览的管理员密码默认是 `netlify-local-test`，仅用于本机。

---

## 5. 首次上线检查

1. 打开首页，确认能看到 10 条示例、8 个分类。
2. 点右上角锁图标，进入 `/#/admin`，用 `QA_ADMIN_PASSWORD` 登录。
3. 在后台点“审核队列”，应显示“暂无待审核内容”。
4. 退出登录，用无痕窗口提交一条测试问题：
   - 应显示“问题已提交，等待审核”；
   - 公开列表暂时搜不到；
   - 管理员后台能看到并可通过/拒绝。
5. 管理员通过后，公开列表能搜到；回答也走同样流程。
6. 在后台导出一次 JSON/CSV，确认中文正常。

验收完成后，在后台“清除示例”删除 10 条示例，换成部门真实内容。

---

## 6. 数据与备份

- 数据位置：Netlify Blobs，store 名称 `dept-qa`，key `questions.json`。
- 首次访问自动写入 `netlify/lib/seed.mjs` 的 10 条示例。
- 后台“导出 JSON/CSV”是主要备份方式；建议每周导出一次，存到公司网盘/共享盘。
- Netlify 控制台 → **Blobs** 可以查看 store，但不建议手动改 JSON；改坏后没有自动回滚。
- 如果误删数据，可用最近一次 JSON 导出恢复；当前版本没有“一键导入”，需要重新部署并手工写入 Blobs（或让技术人员处理）。

---

## 7. 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `QA_ADMIN_PASSWORD` | 是 | 管理员密码；未设置会退回 `admin123` 并打印警告，**公网绝对不要这样** |
| `QA_SESSION_SECRET` | 是 | Cookie HMAC 密钥；未设置会用开发默认值，**公网绝对不要这样** |
| `QA_PUBLIC_ORIGIN` | 建议 | 正式站点地址，如 `https://qa.example.com`；用于同源校验 |
| `QA_COOKIE_SECURE` | 否 | 默认 `1`；只有本地 HTTP 预览才设为 `0`，生产不要设 |

修改环境变量后需要重新部署（Netlify 会提示 Redeploy）。

---

## 8. 本地测试

```bash
# 纯 API 测试，不需要安装 @netlify/blobs
npm test

# 语法检查
npm run check
```

当前测试结果：

- `scripts/netlify-test.mjs`：54 项通过，0 失败
- 原项目浏览器回归：30 项通过
- 原项目审核流程：27 项通过

本地预览：

```bash
node scripts/dev-server.mjs
# http://127.0.0.1:8899
# 管理员密码 netlify-local-test
```

---

## 9. 安全边界

- 管理员密码和 session secret 必须用强随机值，且只放在 Netlify 环境变量里。
- 登录 Cookie 为 `HttpOnly + SameSite=Strict + Secure`，8 小时有效。
- 公开提交默认进入 `pending`，管理员通过后才进入公开列表/搜索/统计。
- 登录、提问、回答有内存限流；Netlify Functions 可能多实例，限流是尽力而为，不是 WAF。
- 没有验证码、敏感词扫描、审核操作日志、邮件通知；公网大规模使用建议再加 Netlify 访问控制/WAF 或 Cloudflare。
- 导出文件含全部问答（包括待审核），请只在管理员环境下载和保存。

---

## 10. 常见问题

**为什么不能拖拽？**  
拖拽只上传 `public/` 静态文件，`netlify/functions/api.mjs` 不会运行，管理员无法登录、数据无法共享。必须用 Git 或 CLI 让 Netlify 构建 Functions。

**登录后又跳回登录页？**  
检查 `QA_PUBLIC_ORIGIN` 是否和浏览器地址完全一致（协议+域名），确认站点是 HTTPS，且没有把 `QA_COOKIE_SECURE` 设成 `0`。清除站点 Cookie 后重试。

**提交后搜不到？**  
这是审核机制：访客提交是 `pending`，管理员在后台“审核队列”通过后才会公开。

**API 404？**  
确认 `netlify.toml` 的 functions 目录是 `netlify/functions`，且 `netlify/functions/api.mjs` 存在；重新部署。

**出现 500 / Blobs 错误？**  
在 Netlify 控制台 **Functions → api → Logs** 查看错误；确认站点已关联 Blobs，且环境变量已设置。首次访问需要能写入 Blobs。

**示例数据会一直存在吗？**  
不会自动删除；管理员后台“清除示例”可删除 10 条示例，保留真实内容。

---

## 11. 从原站迁移

原 `dept-qa/data/questions.json` 已转成 `netlify/lib/seed.mjs`，包含 10 条示例和 9 条回答。  
如果之后在原站积累了真实数据，可导出 JSON，再让技术人员转换为 Blobs 数据；不要直接把原 JSON 放进 `public/`（会公开泄露）。
