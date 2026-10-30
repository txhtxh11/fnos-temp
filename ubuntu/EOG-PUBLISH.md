# linux-cpu温度 — 上架 GNOME 扩展市场（extensions.gnome.org）说明

本仓库的 Ubuntu 版扩展（`ubuntu/portable/linux-temp@txh`，UUID `linux-temp@txh`）可用于上架
**GNOME 官方扩展站 extensions.gnome.org（EOG）**。上架后，用户可在 Ubuntu 自带「扩展」应用里
搜索 **linux-cpu温度** 并一键安装（体验与 Bing 壁纸相同）。

## 仓库内已备好的材料

| 材料 | 位置 | 状态 |
|---|---|---|
| 许可证 | 根 `LICENSE`（MIT，Copyright txhtxh11 2026） | ✅ |
| 扩展本体 | `ubuntu/portable/linux-temp@txh/`（metadata.json / extension.js / stylesheet.css / linux-temp-read.sh） | ✅ |
| metadata 字段 | name / description / uuid / shell-version(45–51) / version-name / **url**(GitHub 仓库) / stylesheet | ✅ |
| 通用化 | 无内置主机/用户名/密码/密钥；配置为出厂空模板 | ✅ |

## 还需要你完成的（个人化步骤，无法代做）

1. **注册 GNOME 账户**：到 <https://account.gnome.org/> 用邮箱注册并验证。
2. **截图**：登录桌面后，把顶部栏显示温度的画面截图一张（按 `PrintScreen` 或「扩展」类工具截图）。
3. **提交**：登录 <https://extensions.gnome.org/> 后操作。

## 提交步骤（登录 EOG 后）

1. 打开 <https://extensions.gnome.org/upload/>。
2. 把 `linux-temp@txh` 整个目录打成 zip（包含 `metadata.json`、`extension.js`、`stylesheet.css`、`linux-temp-read.sh`），上传。
3. 填写：
   - 名称：`linux-cpu温度`
   - 描述：可复制 `metadata.json` 的 `description`
   - 许可证：选择 **MIT**
   - 兼容的 Shell 版本：随 metadata 自动带出（45–51）
   - 项目主页 / 源码链接：`https://github.com/txhtxh11/fnos-temp`
4. 上传/填写截图。
5. 提交，等待 EOG 审核。

## 审核与维护

- EOG 会校验 metadata、lint 代码、核对兼容版本与许可证；通过后即可被搜索安装。
- 后续 GNOME 发布新版本时，需在 `metadata.json` 的 `shell-version` 加入新版本号并重新上传，保持兼容。

## 备注

- 如需要，可让助手协助完成「打包 zip + 把资料填好」的准备工作，再交由你在已登录的浏览器里点提交。
