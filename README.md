<p align="center">
  <img src="docs/images/banner.png" alt="Momo Blog — 把好奇心，变成作品。" width="600">
</p>

<div align="center">

**一个可以直接在页面上编辑的 Bento 个人空间。**

作品、文字、照片、灵感，还有一首正在循环的歌。

[在线示例](https://hejiac.com) · [使用指南](docs/guide.md) · [部署指南](docs/deployment.md) · [更新日志](CHANGELOG.md)

</div>

## 预览

<table>
  <tr>
    <th width="33.33%" align="center">清新绿</th>
    <th width="33.33%" align="center">卡通粉</th>
    <th width="33.33%" align="center">午夜紫</th>
  </tr>
  <tr>
    <td align="center" valign="top">
      <a href="docs/images/homepage-preview.png"><img src="docs/images/homepage-preview.png" alt="清新绿主题首页" width="280"></a>
    </td>
    <td align="center" valign="top">
      <a href="docs/images/homepage-cartoon-pink.png"><img src="docs/images/homepage-cartoon-pink.png" alt="卡通粉主题首页" width="280"></a>
    </td>
    <td align="center" valign="top">
      <a href="docs/images/homepage-midnight-purple.png"><img src="docs/images/homepage-midnight-purple.png" alt="午夜紫主题首页" width="280"></a>
    </td>
  </tr>
  <tr>
    <td align="center">自然留白 · 哑光纸感</td>
    <td align="center">圆润文字 · 猫咪贴纸</td>
    <td align="center">深色磨砂 · 紫色微光</td>
  </tr>
</table>

点击图片查看大图。截图使用示例内容，天气为演示数据。

## 功能

- **页面编辑**：修改资料、介绍与内容，上传图片和音乐，预览后统一保存。
- **内容收藏**：项目、文字、相册、收集和友链；首页最近三篇文字自适应展示。
- **音乐陪伴**：独立歌单、四种播放模式，切换栏目继续播放。
- **日常互动**：私人留言、签到、点赞，以及可设置地点和时区的时钟、日历与天气。

三套主题共用内容与布局，支持桌面和手机；管理员可在底部悬浮栏切换主题。

## 快速开始

需要 **Node.js 24.14–24.x**。

```sh
git clone https://github.com/snowhejia/momo-blog.git
cd momo-blog
npm ci
npm run build
npm start
```

打开 [本地首页](http://127.0.0.1:4318)。首次点击页脚「管理」，使用 `data/setup-token.txt` 中的令牌创建管理员，密码至少 12 位。

登录后点击「编辑页面」，修改内容或更换主题，再点「保存修改」。首次启动自带可替换的示例内容，个人数据保存在 `data/`，不会进入 Git。

## Railway 部署

从 GitHub 导入项目，构建命令使用 `npm run build`，启动命令使用 `npm start`。

挂载 Volume 到 `/app/data`，设置 `DATA_DIR=/app/data`、`HOST=0.0.0.0`，并将 `APP_URL` 设为网站的完整 HTTPS 地址。**先挂持久卷，再创建管理员。**

完整步骤与数据备份见 [部署指南](docs/deployment.md)。

---

React + TypeScript · Express · SQLite · Better Auth

[开发与检查](docs/guide.md#验证) · [反馈建议](https://github.com/snowhejia/momo-blog/issues) · [MIT License](LICENSE) · [素材说明](THIRD_PARTY_NOTICES.md)
