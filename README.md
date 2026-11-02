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

## 依赖

- 复合 action：[maglcal/common](https://github.com/maglcal/common)（mishi / need / message / trigger）
- 需要仓库 Secret：`REPO_TOKEN`（PAT，需 repo + workflow 权限，用于入口触发编译主程序）

## 致谢

编译框架基于 [281677160/build-actions](https://github.com/281677160/build-actions)（GPLv3），原仓库已长期未维护，本仓库在其基础上裁剪并自维护。源码版权归 [coolsnowwolf/lede](https://github.com/coolsnowwolf/lede) 及各软件包作者所有。

## License

GNU General Public License v3.0（见 [LICENSE](LICENSE)）
