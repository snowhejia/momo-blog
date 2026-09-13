# 初始素材说明

- `sydney.png`：2026-09-14 为本项目通过 ImageGen 生成的悉尼示意照片；非站主实拍。用于实现已批准设计稿中的生活照片模块。
- `poster.png`、`architecture.png`：本项目原创的演示图形，源文件生成器为 `scripts/create-demo-art.mjs`。不是外部摄影作品。
- `coffee.jpg`、`forest.jpg`、`coast.jpg`、`sunlight.jpg` 及其他备用照片：沿用旧项目的已注明许可的 Unsplash 演示素材，仅复制文件，不共享数据。逐张原始 URL 在 `photos.json`，许可见 `LICENSE.md`。
- `slow-morning.wav`、`cloud-notes.wav`：旧项目原创、CC0 的合成器演示旋律，生成源程序为 `generate-audio.py`。不含商业歌曲采样。
- `client/public/assets/cat.svg`：此首页原创像素猫标识，用于 logo 和签到提示，内容卡片中不使用猫咪填充。
- `assets/profile/avatar-demo.webp`：经提供者同意发布的毛绒猫示例头像，详见同目录的 `README.md`。
- 字体 DM Sans、Space Grotesk：Google Fonts，SIL Open Font License；中文使用系统字体。

## 主图生成提示

Create a photorealistic editorial travel photograph for a personal website's featured photo tile. Sydney harbour waterfront walking path at Mrs Macquarie's Chair area, warm clear late-afternoon sunshine, Sydney Opera House visible across the harbour in the left middle distance and skyline behind it. On the right a sandstone wall curves along the path. Overhanging green tree branches frame the top edge. Blue water, naturally warm sandstone, calm everyday atmosphere, subtle film grain, premium realistic architectural travel photography, not oversaturated. A few tiny distant pedestrians are acceptable but no close-up faces. Vertical 4:5 composition, trees at top, harbour on the left, sandstone wall and path leading away on the right. No text, no branding, no UI, no borders. This is a standalone replaceable demo photo asset, not a page screenshot.

以生成的独立图片用于首页照片卡片，整体界面由可编辑组件组成。原始设计参考和本地验收截图不包含在仓库中。
