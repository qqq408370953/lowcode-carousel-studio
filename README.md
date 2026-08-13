# 低代码轮播视频工作台

这是一个本地运行的低代码图片与视频编辑器，已实现：

- 9:16 / 16:9 画布比例切换
- 3:4 / 4:3 / 9:16 / 16:9 封面画布与高清 PNG 导出
- 当前屏幕可保存为本地可编辑封面模板，后续套用后继续替换图片和修改文字
- 本地图片、带原声视频、音频上传与拖拽素材库
- 单屏整视频或多个视频左右/上下分屏，支持剪辑起止、倍速、循环、原声音量与静音
- 视频独立缩放、位移、旋转、裁切适配、亮度、对比度、饱和度、色调和图层排序
- 视频入场/出场动画、屏幕转场，以及位于视频上方的独立文字动画
- 单屏多图片图层、层级排序，以及每张图片独立的缩放、位移、旋转、亮度、对比度、饱和度、色调调整
- 图片独立入场/出场动画与屏幕转场，可选 GSAP、Anime.js、Animate.css 和 Motion 动画预设
- 文字层添加、拖拽定位、字号、颜色、字体、粗体、斜体、阴影与淡入/上浮/弹入/打字动画
- 多屏幕轮播时间线、自动预览、复制/新增/删除屏幕
- 口播文案调用豆包 TTS 生成 MP3 配音，或直接拖入本地音频作为口播轨道
- 按配音时长同步轮播时间
- 浏览器端一键导出带音频的视频文件
- 手机与平板自适应工作区，支持素材、画布、属性三视图切换和横屏操作

## 技术栈

- React 19 + TypeScript 严格模式
- Vite 生产构建与开发服务器
- Reducer 管理屏幕、图片/视频图层、文字和口播状态
- GSAP、Anime.js、Animate.css、Motion 动画适配层
- ESLint + TypeScript 构建检查

前端按组件、状态、动画运行时和视频导出模块拆分在 `src/` 下；Node 服务端只负责静态资源与豆包 TTS 代理。

## 启动

```bash
cd /Users/admin/Desktop/skills/lowcode-carousel-studio
npm install
npm start
```

打开服务输出的地址，默认是：

```text
http://localhost:4177
```

### 手机和其他电脑访问

运行 `npm start` 的电脑作为主机。手机、电脑 A、电脑 B 连接同一个 Wi-Fi 或同一个路由器后，在主机上查询局域网 IP：

```bash
ipconfig getifaddr en0
```

如果输出例如 `192.168.1.25`，其他设备使用浏览器打开：

```text
http://192.168.1.25:4177
```

若 `en0` 没有输出，可在 macOS 的“系统设置 > Wi-Fi > 详细信息 > TCP/IP”查看 IP 地址。首次启动时需要允许 Node 接受传入网络连接。若仍无法访问，请确认：

- 所有设备位于同一局域网，且不是开启了客户端隔离的访客 Wi-Fi。
- macOS 防火墙允许 Node.js 的传入连接。
- 主机未休眠，终端中的服务仍在运行。
- 访问的是主机的局域网 IP，而不是 `localhost` 或 `127.0.0.1`。

此方式只适合可信局域网。任何能访问该地址的局域网设备都可以调用主机上的豆包 TTS 接口并消耗额度，不要将路由器的 `4177` 端口映射到公网。

开发模式：

```bash
npm run dev
```

Vite 开发页面为 `http://localhost:5173`，局域网设备也可通过 `http://主机局域网IP:5173` 访问，API 自动代理到本地 Node 服务。提交前可运行：

```bash
npm run check
```

## 本地安装包

三端共用同一套 React 编辑器，不需要购买域名或服务器。图片处理、预览和视频合成均在当前设备完成；豆包 TTS 需要设备联网。

### macOS

Apple Silicon 和 Intel Mac 通用包：

```bash
npm run pack:mac
```

产物位于 `release/`，可直接打开 DMG 安装，或解压 ZIP 后双击应用。未配置 Apple 开发者签名时，首次打开可能需要在 Finder 中右键应用并选择“打开”。

### Windows

在 Windows 电脑或 GitHub Actions 中运行：

```bash
npm ci
npm run pack:win
```

产物是 `release/` 下的便携版 EXE 和 ZIP，无需 Node.js。也可以在 macOS 上运行 `npm run pack:win:zip` 交叉生成 Windows ZIP，解压后双击其中的 EXE。未配置代码签名时，Windows SmartScreen 可能显示未知发布者。

### Android

项目已包含 Capacitor Android 工程。安装 Android Studio、JDK 21 和 Android SDK 35 后运行：

```bash
npm ci
npm run android:apk
```

APK 位于 `android/app/build/outputs/apk/debug/app-debug.apk`。安装时需要允许当前文件来源安装未知应用。Android 6.0 及以上系统可运行。

### GitHub 自动构建

`.github/workflows/build-local-apps.yml` 会在手动触发或推送 `v*` 标签时分别构建 macOS、Windows 和 Android 包，并上传到该次 GitHub Actions 运行的 Artifacts 中。

桌面和 Android 安装包首次使用豆包 TTS 时，在“口播”面板填写并保存 API Key。密钥不会编译进安装包；macOS/Windows 使用 Electron 系统安全存储，Android 保存在当前应用的私有偏好设置中。浏览器本地服务模式仍读取 `.env`。

## 配置豆包 TTS

复制示例配置：

```bash
cp .env.example .env
```

填写 `.env`：

```text
DOUBAO_TTS_MODE=api-key
DOUBAO_API_KEY=你的 UUID 型 API Key
DOUBAO_RESOURCE_ID=seed-tts-2.0
DOUBAO_VOICE_TYPE=zh_female_xiaohe_uranus_bigtts
```

服务端使用火山引擎豆包语音合成 V3 HTTP 接口，浏览器只调用本地 `/api/doubao-tts`，不会拿到你的密钥。`DOUBAO_RESOURCE_ID` 必须和音色匹配：`*_uranus_bigtts` 通常填 `seed-tts-2.0`，`*_moon_bigtts` / `*_mars_bigtts` 通常填 `seed-tts-1.0`。

## 导出说明

视频导出基于浏览器 `MediaRecorder`。如果浏览器支持 MP4，会导出 MP4；否则自动导出 WebM。导出时会按时间线实时合成图片、视频帧、动画和文字，并把未静音的视频原声与已生成或上传的口播音频混合进音轨。多个分屏视频同时保留原声时会一起混音，可在“视频”属性页单独调节音量或静音。

“导出图片”只导出当前屏幕，并把全部图层以静态完整状态合成为 PNG。输出尺寸分别为：3:4 `1200×1600`、4:3 `1600×1200`、9:16 `720×1280`、16:9 `1280×720`。素材区的“保存封面”会把当前比例、图层参数、文字和素材保存在当前设备的 IndexedDB 中；套用后生成独立副本，原模板不会被修改。
