#!/bin/bash
# 自定义插件拉取（主路由/旁路由两版共用，由 diy-part*.sh 引用执行）
#
# 原理：本脚本在 feeds update/install 之前执行，把需要的包放进 package/ 目录，
#       feeds 里同名的旧包会被 scripts/feeds 自动跳过（本地包优先），无需删改 feeds。
# 覆盖范围：
#   - Lucky   ：用 danshui 源新版(lucky 2.27.x + LuCI 3.x) 覆盖 lede 源同名旧版(2.17.8/1.2.0)
#   - EasyTier：官方源守护进程 + LuCI 成对拉取(版本由 version.mk 统一)，覆盖 lede 源 net/easytier
#   - Socat 界面：lede 的 luci 源(openwrt-25.12 分支)已删 Lua 版 luci-app-socat，从 master 分支补回
# 其余三个插件(网易云音乐解锁/KMS/ZeroTier)没有同名冲突，直接由 seed 选择即可。

base="${HOME_PATH:-.}"

# Lucky 守护进程版本钉子：跟随 https://github.com/gdy666/lucky/releases 手动更新
# （sirpdboy 打包长期停旧版；扩展 CLI -setconf/-cd 与 3.x 兼容，已对照 gdy666/luci-app-lucky 官方打包验证）
Lucky_ver="3.5.0"

# ---------- Lucky（danshui 源界面 + 守护进程升到 Lucky_ver） ----------
Lucky_tmp="$(mktemp -d)"
if git clone -q --depth=1 --filter=blob:none --sparse -b Lede https://github.com/maglcal/openwrt-package.git "${Lucky_tmp}/owpkg"; then
    git -C "${Lucky_tmp}/owpkg" sparse-checkout set luci-app-lucky
    mkdir -p "${base}/package/lucky" "${base}/package/luci-app-lucky"
    cp -Rf "${Lucky_tmp}/owpkg/luci-app-lucky/lucky/." "${base}/package/lucky/"
    cp -Rf "${Lucky_tmp}/owpkg/luci-app-lucky/luci-app-lucky/." "${base}/package/luci-app-lucky/"
    sed -i "s/^PKG_VERSION:=.*/PKG_VERSION:=${Lucky_ver}/" "${base}/package/lucky/Makefile"
    echo "Lucky 插件已就位（界面 danshui 新版，守护进程 v${Lucky_ver}，优先于 lede 源同名旧版）"
else
    echo "警告：Lucky 源拉取失败，将回退使用 feeds 里的旧版本" >&2
fi
rm -rf "${Lucky_tmp}"

# ---------- EasyTier（官方源，守护进程 + LuCI 成对） ----------
EasyTier_tmp="$(mktemp -d)"
if git clone -q --depth=1 https://github.com/EasyTier/luci-app-easytier.git "${EasyTier_tmp}/src"; then
    mkdir -p "${base}/package/easytier" "${base}/package/luci-app-easytier"
    cp -Rf "${EasyTier_tmp}/src/easytier/." "${base}/package/easytier/"
    cp -Rf "${EasyTier_tmp}/src/luci-app-easytier/." "${base}/package/luci-app-easytier/"
    cp -f "${EasyTier_tmp}/src/version.mk" "${base}/package/version.mk"
    echo "EasyTier 插件已就位（官方源，优先于 lede 源 net/easytier）"
else
    echo "警告：EasyTier 源拉取失败，固件将不含 EasyTier 界面" >&2
fi
rm -rf "${EasyTier_tmp}"

# ---------- luci-app-socat（coolsnowwolf/luci master 版；openwrt-25.12 分支已删此 Lua 界面） ----------
# 界面自带 /etc/init.d/luci_socat 与 /etc/config/socat，socat 二进制由 seed 里的 packages 源 net/socat 提供。
# Lua 老界面需要 luci-compat（会自动带上 luci-lua-runtime）。
Socat_tmp="$(mktemp -d)"
if git clone -q --depth=1 --filter=blob:none --sparse -b master https://github.com/coolsnowwolf/luci.git "${Socat_tmp}/luci"; then
    git -C "${Socat_tmp}/luci" sparse-checkout set applications/luci-app-socat
    mkdir -p "${base}/package/luci-app-socat"
    cp -Rf "${Socat_tmp}/luci/applications/luci-app-socat/." "${base}/package/luci-app-socat/"
    sed -i 's#include ../../luci.mk#include $(TOPDIR)/feeds/luci/luci.mk#' "${base}/package/luci-app-socat/Makefile"
    sed -i 's/^LUCI_DEPENDS:=+socat$/LUCI_DEPENDS:=+socat +luci-compat/' "${base}/package/luci-app-socat/Makefile"
    echo "luci-app-socat 界面已就位（master 分支 Lua 版，补 +luci-compat 依赖）"
else
    echo "警告：luci-app-socat 源拉取失败，固件将只含 socat 命令行、无 Web 界面" >&2
fi
rm -rf "${Socat_tmp}"
