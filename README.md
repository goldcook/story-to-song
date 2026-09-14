# 叙音 Story to Song

一个手机优先的“故事变成歌”网站原型。输入或讲述一段故事后，它会：

- 分析核心与辅助情绪，给出 BPM、调性、能量和乐器编制
- 从故事意象中组织歌名、主歌、副歌、桥段与尾声
- 使用浏览器 Web Audio API 合成一段约 17–20 秒、与情绪匹配的纯器乐 Demo
- 按情绪组合拨弦、柔音钢琴、氛围铺底、低音、打击乐、钟琴与混响层
- 生成可直接交给 Suno、Udio 等专业音乐模型的完整 Prompt
- 将最近作品保存在当前浏览器本地，本站不接收或上传故事文本

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

未来若接入大模型或音乐生成 API，不应把 API Key 写进前端。届时建议保留 GitHub Pages 前端，并增加 Cloudflare Workers 或 Vercel Functions 作为轻量后端；如果使用支持 OAuth/用户自带密钥的服务，也可以继续保持纯前端架构。

## 检查

```bash
npm run lint
npm run build
```
