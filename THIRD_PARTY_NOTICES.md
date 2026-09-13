# 素材与第三方说明

Momo Blog 的代码与文档采用根目录中的 [MIT License](LICENSE)。第三方素材和依赖继续适用各自的许可；MIT 不替代这些许可，也不授予第三方商标、肖像或其他独立权利。

| 内容 | 来源与适用说明 |
| --- | --- |
| `assets/demo/*.jpg` | 来自 Unsplash，按 [Unsplash License](https://unsplash.com/license) 提供。逐张来源保留在 [photos.json](assets/demo/photos.json)，不可把这些图片汇集成竞争性的图片服务。 |
| `assets/demo/slow-morning.wav`、`cloud-notes.wav` | 原创合成器演示旋律，不含采样，按 [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) 提供。生成源程序见 [generate-audio.py](assets/demo/generate-audio.py)。 |
| `assets/demo/sydney.png` | 使用 ImageGen 生成的悉尼示意图，非作者实拍；生成来源与提示见 [SOURCES.md](assets/demo/SOURCES.md)。 |
| `assets/demo/poster.png`、`architecture.png` | 本项目原创演示图形，按项目 MIT 许可提供；生成器见 [create-demo-art.mjs](scripts/create-demo-art.mjs)。 |
| `client/public/assets/cat.svg` | 本项目原创像素猫标识，按项目 MIT 许可提供。 |
| `assets/profile/avatar-demo.webp` | 经提供者同意随项目发布的毛绒猫演示头像。其来源说明不构成对第三方摄影或角色权利的额外授权，使用自己的站点时可替换为有权使用的头像。见 [头像说明](assets/profile/README.md)。 |
| `docs/images/homepage-preview.png` | 提供者授权用于 README 展示的示例站截图；其中的照片、头像和字体仍分别适用原有许可。 |
| DM Sans、Space Grotesk | 页面通过 Google Fonts 加载，字体采用 SIL Open Font License。中文使用设备上的系统字体；系统字体不随本仓库分发。 |

JavaScript 依赖及随依赖下载的原生库、FFmpeg 二进制保留各自许可证。版本锁定在 [package-lock.json](package-lock.json)；重新分发这些依赖或打包后的二进制时，应一并保留其附带的许可与说明。项目根目录的 MIT 许可不对第三方依赖重新授权。

原始设计参考、头像编辑过程文件、个人数据库与私人上传内容均不属于开源发布内容。示例素材可从管理员编辑面板替换，具体上传与保存方式见 [使用指南](docs/guide.md)。
