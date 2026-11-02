#!/bin/bash
# 自定义插件拉取（主路由/旁路由两版共用，由 diy-part*.sh 引用执行）
#
# 原理：本脚本在 feeds update/install 之前执行，把需要的包放进 package/ 目录，
#       feeds 里同名的旧包会被 scripts/feeds 自动跳过（本地包优先），无需删改 feeds。
# 覆盖范围：
#   - Lucky   ：用 danshui 源新版(lucky 2.27.x + LuCI 3.x) 覆盖 lede 源同名旧版(2.17.8/1.2.0)
#   - EasyTier：官方源守护进程 + LuCI 成对拉取(版本由 version.mk 统一)，覆盖 lede 源 net/easytier
# 其余三个插件(网易云音乐解锁/KMS/ZeroTier)没有同名冲突，直接由 seed 选择即可。

base="${HOME_PATH:-.}"

# ---------- Lucky（danshui 源新版） ----------
Lucky_tmp="$(mktemp -d)"
if git clone -q --depth=1 --filter=blob:none --sparse -b Lede https://github.com/maglcal/openwrt-package.git "${Lucky_tmp}/owpkg"; then
    git -C "${Lucky_tmp}/owpkg" sparse-checkout set luci-app-lucky
    mkdir -p "${base}/package/lucky" "${base}/package/luci-app-lucky"
    cp -Rf "${Lucky_tmp}/owpkg/luci-app-lucky/lucky/." "${base}/package/lucky/"
    cp -Rf "${Lucky_tmp}/owpkg/luci-app-lucky/luci-app-lucky/." "${base}/package/luci-app-lucky/"
    echo "Lucky 插件已就位（danshui 源新版，优先于 lede 源同名旧版）"
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
