## QBin 自托管部署教程

本文将帮助您快速部署 QBin 服务，分别提供三种灵活的部署方式，适合不同的使用场景和技术偏好。

## ⚡ 部署方式选择

|      部署方式      |      适用场景       | 难度  | 稳定性 |
|:--------------:|:---------------:|:---:|:---:|
| Docker Compose | 本地或服务器部署，适合生产环境 | 很简单 |  高  |
|     Docker     |    快速测试或简单部署    | 很简单  |  高  |
|  Deno Deploy   |  无需服务器，快速云端部署   | 很简单  |  高  |
|    Deno CIL    |  本地开发环境和调试测试     | 简单  |  中  |

## 🐳 Docker Compose 一键部署（推荐）

最简单的部署方式，一键完成环境配置和应用启动：

```bash
# 克隆项目仓库
git clone https://github.com/Quick-Bin/qbin.git

# 进入项目目录
cd qbin

# 启动服务
docker-compose up -d
```

完成后，访问 `http://localhost:8000` 即可使用 QBin 服务，所有配置已在 docker-compose.yml 中预设好。

## 🐋 Docker 部署

```bash
# 拉取最新镜像
docker pull naiher/qbin:latest

# 启动容器
docker run -it -p 8000:8000 \
  -e JWT_SECRET="your_jwt_secret" \
  -e ADMIN_PASSWORD="qbin" \
  -e ADMIN_EMAIL="admin@qbin.github" \
  -e DB_CLIENT="sqlite" \
  -e ENABLE_ANONYMOUS_ACCESS="1" \
  -v ~/qbin-data:/app/data \
  naiher/qbin
```

启动后，访问 `http://localhost:8000` 即可使用 QBin 服务。

## ☁️ Deno Deploy 云端部署

无需服务器，快速部署到 Deno 云平台：

1. 准备一个 PostgreSQL 数据库
2. [Fork QBin](https://github.com/Quick-Bin/Qbin/fork) 项目仓库
3. 登录/注册 [Deno Deploy](https://dash.deno.com)
4. 创建新项目：https://dash.deno.com/new_project
5. 选择您 Fork 的项目，填写项目名称（关系到自动分配的域名）
6. Entrypoint 填写 `index.ts`，其他字段留空
7. 配置环境变量（详见下方环境变量说明）
8. 点击 Deploy Project
9. 部署成功后，点击生成的域名即可使用
10. 部署完成后配置环境变量：
     - 在 Project 的 Settings 中找到 Environment Variables
     - 点击 Add Variable 添加必要的环境变量
     <img src="https://s3.tebi.io/lite/Environment.jpg" width="60%" alt="环境变量设置" title="环境变量设置" />
11. 自定义域名（可选）：
     - 在 Project 的 Settings 中设置自定义二级域名或绑定自己的域名
     <img src="https://s3.tebi.io/lite/custom_url.jpg" width="60%" alt="自定义域名" title="自定义域名" />

> **注意**：使用 Deno 部署需要提前准备好 PostgreSQL 数据库。

## 🛢 数据库准备

Deno Deploy部署方式需要手动创建 PostgreSQL 数据库。如果你没有，那么可以使用以下几个提供免费方案的服务商：

| 服务商 | 免费方案 | 特点 |
|:-----:|:-------:|:----:|
| [Render](https://render.com/docs/deploy-mysql) | 免费 10 GB 空间 | 与 Render 应用集成方便 |
| [Aiven](https://aiven.io/) | 免费 5 GB 空间 | 稳定可靠，简单易用 |
| [Neon](https://neon.tech/) | 免费 0.5 GB 空间 | 弹性扩展，零停机时间，开发者友好 |


## 🖥️ Deno CLI 本地部署

适合开发环境和本地测试，快速启动和调试：

**Windows PowerShell 安装 Deno:**
```bash
irm https://deno.land/install.ps1 | iex
```

**Mac/Linux 安装 Deno:**
```bash
curl -fsSL https://deno.land/install.sh | sh
```

**克隆项目:**
```bash
# 克隆项目仓库
git clone https://github.com/Quick-Bin/qbin.git

# 进入项目目录
cd qbin
```

**启动项目:**
```bash
deno run -NER --allow-ffi --allow-sys --unstable-kv --unstable-broadcast-channel index.ts
```

### 环境变量配置

在项目根目录 将`.env.template` 重命名为 `.env` 文件，并设置必要的环境变量（参考环境变量配置说明）：

```
ENABLE_ANONYMOUS_ACCESS=1        # 匿名访问，默认开启，0表示关闭, 支持共享编辑
ADMIN_EMAIL=admin@qbin.github    # 管理员邮箱（必选）
ADMIN_PASSWORD=qbin              # 管理员密码（必选）
DB_CLIENT=postgres      # 选择数据库，支持 postgres、sqlite
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=your_jwt_secret  # JWT密钥，用于加密验证（建议修改）
```

完成部署后，访问 `http://localhost:8000` 即可使用 QBin 服务。

## ⚙️ 环境变量配置说明

### 基础配置

|           环境变量            | 类型 | 描述 |                       示例                        |
|:-------------------------:|:----:|:----:|:-----------------------------------------------:|
|     `ADMIN_PASSWORD`      | 必选 | 管理员访问密码 |                     `qbin`                      |
|       `ADMIN_EMAIL`       | 必选 | 管理员邮箱地址 |               `admin@qbin.github`               |
|      `DATABASE_URL`       | 必选 | PostgreSQL 数据库连接 URL | `postgresql://user:password@host:5432/database` |
|       `JWT_SECRET`        | 必选 | JWT 签名密钥（建议使用随机字符串） |        `XTV0STZzYFxxxxxxxxxx5ecm50W04v`         |
|          `PORT`           | 可选 | 服务访问端口，默认 8000 |                     `8000`                      |
| `ENABLE_ANONYMOUS_ACCESS` | 可选 | 匿名访问, 支持共享编辑 |                       `1`                       |
|      `TOKEN_EXPIRE`       | 可选 | 令牌有效期(秒)，默认一年 |                   `31536000`                    |
|  `MAX_UPLOAD_FILE_SIZE`   | 可选 | 最大上传文件大小(字节)，默认 50MB |                   `52428800`                    |
|  `DENO_KV_PROJECT_ID`   | 可选 | Deno KV 项目 ID，默认为空 |                   `xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`                    |
|  `DENO_KV_ACCESS_TOKEN`   | 可选 | Deno KV 项目访问令牌，默认为空 |                   ``                    |

### 社交登录配置（可选）

#### GitHub OAuth 配置

| 环境变量 | 类型 | 描述 | 示例 |
|:-------:|:----:|:----:|:----:|
| `GITHUB_CLIENT_ID` | 可选 | GitHub OAuth 应用客户端 ID | `Ovxxxxxxxxxfle8Oyi` |
| `GITHUB_CLIENT_SECRET` | 可选 | GitHub OAuth 应用客户端密钥 | `56ab9xxxxxxxxxxxxxx4012184b426` |
| `GITHUB_CALLBACK_URL` | 可选 | GitHub OAuth 回调地址 | `http://localhost:8000/api/login/oauth2/callback/github` |

#### Google OAuth 配置

| 环境变量 | 类型 | 描述 | 示例 |
|:-------:|:----:|:----:|:----:|
| `GOOGLE_CLIENT_ID` | 可选 | Google OAuth 应用客户端 ID | `84932xxxxx-gbxxxxxxxxxxxxjg8s3v.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | 可选 | Google OAuth 应用客户端密钥 | `GOCSPX-xxxxxxxxxxxxxxxxxxxx` |
| `GOOGLE_CALLBACK_URL` | 可选 | Google OAuth 回调地址 | `http://localhost:8000/api/login/oauth2/callback/google` |

#### Microsoft OAuth 配置

| 环境变量 | 类型 | 描述 | 示例 |
|:-------:|:----:|:----:|:----:|
| `MICROSOFT_CLIENT_ID` | 可选 | Microsoft OAuth 应用客户端 ID | `a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6` |
| `MICROSOFT_CLIENT_SECRET` | 可选 | Microsoft OAuth 应用客户端密钥 | `abC8Q~xxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `MICROSOFT_CALLBACK_URL` | 可选 | Microsoft OAuth 回调地址 | `http://localhost:8000/api/login/oauth2/callback/microsoft` |

#### Custom OAuth 配置

| 环境变量 | 类型 | 描述 | 示例 |
|:-------:|:----:|:----:|:----:|
| `OAUTH_CLIENT_ID` | 可选 | OAuth 应用的客户端标识符 | `V4HmbQixxxxxxxxxxxxCJ2CVypqL` |
| `OAUTH_CLIENT_SECRET` | 可选 | OAuth 应用的客户端密钥 | `hZtE3cxxxxxxxxxxxxxkZ0al01Hi` |
| `OAUTH_AUTH_URL` | 可选 | 授权端点 URL | `https://provider.example.com/oauth2/authorize` |
| `OAUTH_TOKEN_URL` | 可选 | 令牌端点 URL | `https://provider.example.com/oauth2/token` |
| `OAUTH_CALLBACK_URL` | 可选 | 认证成功后的回调地址 | `http://localhost:8000/api/login/oauth2/callback/custom` |
| `OAUTH_SCOPES` | 可选 | 请求的权限范围，以空格分隔 | `user:profile` |
| `OAUTH_USER_INFO_URL` | 可选 | 获取用户信息的 API 端点 | `https://provider.example.com/api/user` |

## 🔧 常见问题与故障排除

1. **数据库连接失败**
   - 检查 DATABASE_URL 格式是否正确
   - 确认数据库服务是否已启动
   - 验证用户名密码是否正确
   - 检查防火墙是否允许连接

2. **部署成功但无法访问**
   - 检查端口是否被其他程序占用
   - 确认防火墙是否允许该端口访问
   - 检查 Deno Deploy 日志查看错误信息

3. **社交登录无法使用**
   - 确认 OAuth 配置信息是否正确
   - 检查回调 URL 是否与应用配置一致
   - 确认已在对应平台启用了正确的 OAuth 权限

## 📚 更多信息

有关本项目的更多详细说明、API 文档和高级配置，请参考 [完整文档](https://github.com/Quick-Bin/Qbin/blob/main/README.md)。

如有任何问题，欢迎 [提交 Issue](https://github.com/Quick-Bin/Qbin/issues) 。