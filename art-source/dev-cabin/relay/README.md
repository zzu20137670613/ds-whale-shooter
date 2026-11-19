# 开发者小屋 · 留言中转

游戏是纯前端，浏览器写不进 GitHub。所以要有一个拿着 token 的"跑腿"，替玩家建 issue。
这一份东西就是那个跑腿 —— **两种形态，选一种**。

## 先决定：要不要一台常开的机器

| 方案                                      | 需要 24 小时在线吗                                                                                                     | 你的一次性成本                                |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **A. Cloudflare Worker（推荐）**          | **不需要**。它是"有请求才跑"的函数，跑在 Cloudflare 的边缘节点上，你没有任何机器需要开着。睡着的时候它也能接活。       | 注册 Cloudflare + 网页里粘代码部署，约 5 分钟 |
| **B. 你自己的另一台电脑（`server.mjs`）** | **需要**。只有那台机器醒着并连着网，玩家点发送才能成功。它睡了，玩家会退回到"自己点提交"那条路 —— 丢不了信，但多一步。 | 装 Node + 配开机自启，约 15 分钟              |

**结论**：这游戏一天可能只有几个留言，方案 A 免费额度（每天 10 万次）一辈子用不完，**而且不需要你维护任何机器**。
如果你就是不想多注册一个账号，方案 B 也能用 —— 只要接受"你电脑关了，玩家多发一步"。

---

## 部署方案 A（Cloudflare Worker）

1. **造 token（只给这一个仓库，只给 issue 权限）**
   GitHub → 右上头像 → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token
    - Repository access：**Only select repositories** → 只勾 `ds-whale-shooter-PC`
    - Permissions → Repository permissions → **Issues: Read and write**
    - 有效期建议 1 年，到期再换
    - 生成后**只显示一次**，先复制到记事本

2. **建 Worker**
   cloudflare.com 注册（免费）→ 左侧 **Workers & Pages** → **Create** → **Worker** →
   名字随便（比如 `dev-cabin-relay`）→ Deploy → **Edit code**，
   把 `worker.js` 整个粘进去 → **Deploy**

3. **配两个变量**（Worker → Settings → Variables and Secrets）
    - Secret：`GH_TOKEN` = 刚才那个 token
    - 普通变量：`GH_REPO` = `zzu20137670613/ds-whale-shooter-PC`

4. **拿到地址**：形如 `https://dev-cabin-relay.你的账号.workers.dev`
   把它给我，我写进游戏的配置里。

5. **顺手建一个 label**（可选，弹框里会用到分类）
   仓库 → Issues → Labels → New label：`dev-cabin`，颜色随便。

### 自测（部署完粘这个到浏览器地址栏不行，要用命令行）

```bash
curl -X POST https://你的地址.workers.dev \
  -H "Content-Type: application/json" \
  -d '{"message":"测试一下","reply":"","handle":"relay"}'
```

看到 `{"ok":true,"url":"https://gitee.com/.../issues/N"}` 就通了。

---

## 部署方案 B（你自己的电脑）

```bash
# 需要 Node 20+
GH_TOKEN=ghp_xxx GH_REPO=zzu20137670613/ds-whale-shooter-PC node art-source/dev-cabin/relay/server.mjs
```

默认听 `127.0.0.1:38931`，路径 `/dev-cabin`。
想在别的机器上用，把 `listen(PORT, '127.0.0.1')` 改成 `'0.0.0.0'`，并**在防火墙上只放行游戏来源**。

关机自启（Windows）：任务计划程序 → 创建任务 → 触发器"登录时" → 操作"启动程序" →
`node.exe`，参数填 `server.mjs` 的绝对路径，起始位置填该目录。

---

## 游戏侧的降级顺序

1. 配置了中转地址 → POST 过去，服务端建 issue，玩家看到"已寄出"
2. 没配置 / 中转失败 → 打开**预填好的新建 issue 页面**，玩家自己点提交
3. 完全没有 GitHub → 弹框给一句人话说明，并指向留言板 issue

第 2、3 步都不需要任何服务，所以**中转挂了不会让这关变哑巴**。

## Gitee（2026-10-30 迁移）

**给运维看的手把手指南：[`MIGRATION-TO-GITEE.md`](./MIGRATION-TO-GITEE.md)**（接口差异、要改的两个变量、验证用的 curl、回滚）。

GitHub 账号被封，留言板搬到 Gitee。**代码已经改好**，但**线上那个 Worker 还是旧代码**，
它现在仍然往 api.github.com 投递 —— 那边一删仓库，信就寄不出去。

**主人要做的三步：**

1. 去 Gitee 生成令牌：`设置 → 私人令牌`，勾 **issues** 权限，复制令牌
2. 更新 Worker 的环境变量（Cloudflare 控制台 → 那个 Worker → Settings → Variables）：
    - `GITEE_TOKEN` = 刚复制的令牌
    - `GITEE_REPO` = `zzu20137670613/ds-whale-shooter-PC`
    - 旧的 `GH_TOKEN` / `GH_REPO` 可以留着，代码会优先用 `GITEE_*`
3. 重新部署 Worker：把 `worker.js` 的内容贴进 Cloudflare 的编辑器，或者 `wrangler deploy`

**改了什么：**

| 项       | 旧                                   | 新                                            |
| -------- | ------------------------------------ | --------------------------------------------- |
| 接口     | `api.github.com/repos/{repo}/issues` | `gitee.com/api/v5/repos/{repo}/issues`        |
| 鉴权     | `Authorization: Bearer <token>`      | body 里 `access_token`                        |
| 标签     | `labels: ['dev-cabin']`              | **去掉**（Gitee 没有这个字段，传了会 400）    |
| 环境变量 | `GH_TOKEN` / `GH_REPO`               | `GITEE_TOKEN` / `GITEE_REPO`（`GH_*` 仍兼容） |

**注意 Gitee 的令牌权限**：只要 `issues` 就够，**不要**给它仓库写权限。
