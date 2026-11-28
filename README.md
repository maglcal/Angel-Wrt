# Angel-Wrt

自用的 OpenWrt 固件云编译仓库。基于 GitHub Actions 编译 [coolsnowwolf/lede](https://github.com/coolsnowwolf/lede)（大雕源码），**仅编译 x86_64 一种配置**。

## 使用方法

1. 打开 **Actions** 页面 → 选择 **Lede-大雕**
2. 点 **Run workflow**，参数保持默认即可（配置文件只有 x86_64）
3. 等编译完成（约 2-3 小时），固件在该次运行的 **Artifacts** 里下载

编译流程：`Lede-大雕`（入口，写入配置）→ 自动触发 `编译主程序`（compile.yml，实际编译）。

## 目录结构

```
.github/workflows/
  Lede.yml        # 入口 workflow（手动触发）
  compile.yml     # 编译主程序（勿改文件名）
build/Lede/
  settings.ini    # 编译开关（源码/分支/上传/缓存等）
  seed/x86_64     # x86_64 固件的 .config 种子
  diy-part.sh     # 自定义插件/包脚本
  relevance/start # 触发文件（入口 workflow 通过改动它触发编译）
```

## 在线更新行为说明

固件内置 luci-app-autoupdate（系统 → 在线更新）从本仓库 Release 拉固件升级：

- **主路由/旁路由模式**：落盘 `/etc/angel-mode.state`，已加入 sysupgrade 保留清单（`/lib/upgrade/keep.d/10-angel-mode`），升级后不会重新弹设置向导。
- **手动安装的插件**：更新前会自动落盘 opkg 已安装清单（`/etc/angel-pkg.list`）并随备份保留，升级后由 `angel-pkg-restore` 服务开机自动重装缺失插件（需外网可达软件源）。
- **rootfs 分区**：自 2026-11-27 起钉死 1024MB（原默认 448MB 被大件插件占满，余量不足会导致 Lucky 等自带在线更新的程序替换二进制失败）。**从旧固件首次在线升级到本版本时分区布局变化，会整盘写入一次**：除上述保留清单外的数据（含手装插件文件）该次会清空，之后每次更新都是分区级写入、保留全部数据。

## 内置软件

除 lede 官方源外，固件额外内置（x86_64 版）：

- **Lucky / EasyTier / OpenList2 / AdGuardHome / Tailscale / ZeroTier** 等网络工具（见 seed）
- **SQM CAKE 智能队列**（`网络 → SQM QoS`，配合 irqbalance/zram-swap 优化）
- **ttyd 网页终端**、**irqbalance** 中断均衡、**zram-swap** 内存压缩

lite 精简版仅含网络工具与 SQM/irqbalance/zram-swap。

## 依赖

- 复合 action：[angel-Xn/common](https://github.com/angel-Xn/common)（mishi / need / message / trigger）
- 需要仓库 Secret：`REPO_TOKEN`（PAT，需 repo + workflow 权限，用于入口触发编译主程序）

## 致谢

编译框架基于 [281677160/build-actions](https://github.com/281677160/build-actions)（GPLv3），原仓库已长期未维护，本仓库在其基础上裁剪并自维护。源码版权归 [coolsnowwolf/lede](https://github.com/coolsnowwolf/lede) 及各软件包作者所有。

## License

GNU General Public License v3.0（见 [LICENSE](LICENSE)）
