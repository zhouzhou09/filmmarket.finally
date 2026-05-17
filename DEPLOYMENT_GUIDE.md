# FilmMarket 部署指南

## 目录
1. [后端部署 (Render.com 免费)](#后端部署-rendercom-免费)
2. [前端部署 (Netlify 免费)](#前端部署-netlify-免费)
3. [环境变量配置](#环境变量配置)
4. [测试部署](#测试部署)

---

## 后端部署 (Render.com 免费)

### 步骤1: 推送代码到 GitHub

```bash
# 在项目根目录
git init
git add .
git commit -m "Initial commit: FilmMarket API"
git branch -M main
git remote add origin https://github.com/你的用户名/filmmarket-api.git
git push -u origin main
```

### 步骤2: 在 Render.com 部署

1. 访问 https://render.com 并注册/登录
2. 点击 **"New +"** → 选择 **"Web Service"**
3. 连接你的 GitHub 账户
4. 选择 `filmmarket-api` 仓库
5. 配置：
   - **Name**: `filmmarket-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free`

6. 点击 **"Create Web Service"**

### 步骤3: 配置环境变量

在 Render 控制台的 **Environment** 标签页，添加以下变量：

```env
NODE_ENV=production
PORT=10000
JWT_SECRET=filmmarket_secret_2026

# 阿里云 RDS 数据库
DB_HOST=rm-bp1c9272p58gcdz1u5o.mysql.rds.aliyuncs.com
DB_USER=filmmarket
DB_PASSWORD=filmmarket@2006923
DB_NAME=filmmarket
DB_PORT=3306

# 阿里云 OSS
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=你的AccessKeyID
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
OSS_BUCKET=filmmarket-uploads
OSS_BASE_URL=https://filmmarket-uploads.oss-cn-hangzhou.aliyuncs.com
```

⚠️ **重要**：
- 将 `OSS_ACCESS_KEY_ID` 和 `OSS_ACCESS_KEY_SECRET` 替换为你自己的阿里云 AccessKey
- 如果还没有 AccessKey，访问 https://usercenter.console.aliyun.com/#/manage/ak 创建

### 步骤4: 部署

点击 **"Deploy"** 按钮，等待部署完成（约2-3分钟）

部署成功后，你会获得一个 `.onrender.com` 的域名，例如：
```
https://filmmarket-api.onrender.com
```

---

## 前端部署 (Netlify 免费)

### 方法1: 从 GitHub 自动部署（推荐）

1. 访问 https://netlify.com 并注册/登录
2. 点击 **"Add new site"** → **"Import an existing project"**
3. 选择 **GitHub**
4. 选择你的前端仓库（如果前后端在同一个仓库，需要配置忽略）
5. 配置：
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Node version**: `20`

6. 点击 **"Deploy"**

### 方法2: 手动上传 dist 文件夹

如果你不想用 GitHub：

```bash
# 在本地构建
npm run build
```

然后在 Netlify：
1. 点击 **"Add new site"** → **"Deploy manually"**
2. 拖拽 `dist` 文件夹到页面

### 配置环境变量

在 Netlify 控制台的 **Site settings** → **Environment variables**，添加：

```env
VITE_API_URL=https://filmmarket-api.onrender.com
```

（替换成你实际的 Render 后端地址）

---

## 绑定域名 (filmmarket.top)

### 后端 API 域名 (api.filmmarket.top)

1. 在 Render 控制台，进入你的服务
2. 点击 **"Settings"** → **"Custom Domain"**
3. 输入 `api.filmmarket.top`
4. 按照提示在你的域名服务商（阿里云？）添加 CNAME 记录：
   ```
   类型: CNAME
   主机记录: api
   记录值: filmmarket-api.onrender.com
   ```

### 前端域名 (filmmarket.top)

1. 在 Netlify 控制台，进入你的站点
2. 点击 **"Domain settings"** → **"Add custom domain"**
3. 输入 `filmmarket.top`
4. 按照提示添加 A 记录或 CNAME 记录

---

## 测试部署

### 测试后端 API

```bash
# 健康检查
curl https://api.filmmarket.top/health

# 测试商品列表
curl https://api.filmmarket.top/api/products

# 测试搜索热词
curl https://api.filmmarket.top/api/search/hot
```

### 测试前端

访问 `https://filmmarket.top`，检查：
- ✅ 页面能正常加载
- ✅ 可以搜索商品
- ✅ 可以登录/注册
- ✅ 图片能正常上传和显示

---

## 常见问题

### Q1: Render.com 免费版会休眠怎么办？

**A**: 15分钟无访问会休眠，首次访问需要10-30秒唤醒。

**解决方案**：
- 使用 [UptimeRobot](https://uptimerobot.com/) 每10分钟 ping 一次你的 API
- 或升级到付费版（$7/月）

### Q2: 阿里云 RDS 白名单怎么配置？

**A**: Render.com 的出口 IP 不固定，需要：

1. 登录阿里云 RDS 控制台
2. 进入 **"数据安全性"** → **"白名单设置"**
3. 添加白名单：`0.0.0.0/0`（允许所有IP访问）

⚠️ **注意**：这样设置后，任何知道你数据库密码的人都能访问。确保密码足够强！

**更安全的方法**：
- 使用阿里云自带的应用服务器（ECS）
- 或在 RDS 控制台查看 Render.com 的 IP 段并添加到白名单

### Q3: OSS 跨域问题 (CORS)

**A**: 如果前端无法直接上传到 OSS，需要在阿里云 OSS 控制台配置 CORS：

```json
[
  {
    "allowedOrigins": ["https://filmmarket.top"],
    "allowedMethods": ["GET", "POST", "PUT"],
    "allowedHeaders": ["*"]
  }
]
```

---

## 部署检查清单

- [ ] 代码已推送到 GitHub
- [ ] Render.com 后端已部署
- [ ] 环境变量已配置（数据库 + OSS）
- [ ] 后端 API 可以访问（/health 返回正常）
- [ ] Netlify 前端已部署
- [ ] 前端环境变量 `VITE_API_URL` 已设置
- [ ] 域名已绑定（api.filmmarket.top + filmmarket.top）
- [ ] 阿里云 RDS 白名单已配置
- [ ] OSS CORS 已配置

---

## 下一步

部署完成后，可以：
1. 测试所有功能是否正常
2. 设置 UptimeRobot 监控 API 健康状态
3. 配置 Google Analytics 跟踪访问量
4. 优化 SEO（添加 sitemap.xml, robots.txt）

---

**祝部署顺利！如果有任何问题，随时问我。**
