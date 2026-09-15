# 叙音 Story to Song

一个手机优先的“私人故事唱片”网站原型。它不把自己包装成 AI 音乐工具，而是把一段真实生活做成可以听、收藏和分享的私人唱片。输入或讲述一段故事后，它会：

- 分析核心与辅助情绪，给出 BPM、调性、能量和乐器编制
- 从故事意象中组织歌名、主歌、副歌、桥段与尾声
- 使用浏览器 Web Audio API 编排一段约 26 秒、有起承转合的纯器乐 Demo
- 以内置的真实钢琴、原声吉他、大提琴与木琴多采样承担主要声部，合成音仅用于轻量节奏、空气感与加载失败时的回退
- 识别家庭、旅途、雨夜、海风与星空等故事场景，并加入对应声音轨道
- 为每首作品生成 1080×1080 专辑封面与 1080×1350 故事海报
- 生成可跨设备打开的静态作品链接，朋友可以直接听旋律、读故事
- 通过发行面板分享作品链接，或下载 PNG 封面、4:5 海报与 WAV 音乐
- 生成可直接交给 Suno、Udio 等专业音乐模型的完整 Prompt
- 将最近作品保存在当前浏览器本地，本站不接收或上传故事文本

核心体验遵循“生活触发点 → 理解故事 → 制作唱片 → 收藏或分享 → 用另一段记忆回应”的闭环。面向普通用户的主界面优先展示唱片内页和声音设计，歌词、Prompt 与制作参数收进次级的制作手记。

语音输入使用浏览器提供的 Web Speech API，音频如何处理取决于浏览器厂商；对隐私敏感的内容建议直接键入文字。

## 本地运行

```bash
npm install
npm run dev
```

本地地址通常是 <http://localhost:5173>。这只用于开发预览，关闭终端后本地地址会停止。

## 发布到 GitHub Pages

项目已经包含 [GitHub Actions 工作流](.github/workflows/deploy-pages.yml)。线上网站由 GitHub 托管，你的电脑不需要保持开机。

1. 在 GitHub 新建一个空仓库，例如 `story-to-song`。
2. 在本目录执行以下命令，其中仓库地址替换为你自己的地址：

```bash
git remote add origin git@github.com:<你的用户名>/story-to-song.git
git push -u origin main
```

3. 打开 GitHub 仓库的 **Settings → Pages**。
4. 在 **Build and deployment → Source** 中选择 **GitHub Actions**。
5. 回到 **Actions** 页面等待 `Deploy to GitHub Pages` 完成。

之后每次向 `main` 分支推送，网站都会自动更新。默认地址为：

```text
https://<你的用户名>.github.io/story-to-song/
```

## 生产边界

当前版本完全静态，可免费托管在 GitHub Pages。浏览器试听是多层程序化纯音乐，不包含 AI 人声；歌词保留为可选创作素材，不会在试听中演唱。

真实乐器采样随网站本地发布，不依赖第三方运行时音频地址。首次播放需要下载并解码约 4 MB 音源，之后会复用浏览器缓存；素材许可与来源见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

跨设备作品链接会把故事编码在 URL 中，因此只有用户主动分享链接时，接收者才能读到完整故事。当前静态方案无法为每张唱片生成独立的微信或小红书链接预览图；如果后续需要短链接、动态 Open Graph 卡片、删除已分享作品或更严格的访问控制，应增加轻量后端与对象存储。

未来若接入大模型或音乐生成 API，不应把 API Key 写进前端。届时建议保留 GitHub Pages 前端，并增加 Cloudflare Workers 或 Vercel Functions 作为轻量后端；如果使用支持 OAuth/用户自带密钥的服务，也可以继续保持纯前端架构。

## 检查

```bash
npm run lint
npm run build
```
