#!/bin/bash
# 自定义插件拉取（主路由/旁路由两版共用，由 diy-part*.sh 引用执行）
#
# 原理：本脚本在 feeds update/install 之前执行，把需要的包放进 package/ 目录，
#       feeds 里同名的旧包会被 scripts/feeds 自动跳过（本地包优先），无需删改 feeds。
# 覆盖范围：
#   - Lucky   ：用 danshui 源新版(lucky 2.27.x + LuCI 3.x) 覆盖 lede 源同名旧版(2.17.8/1.2.0)
#   - EasyTier：官方源守护进程 + LuCI 成对拉取(版本由 version.mk 统一)，覆盖 lede 源 net/easytier
#   - Socat 界面：lede 的 luci 源(openwrt-25.12 分支)已删 Lua 版 luci-app-socat，从 master 分支补回
#   - OpenList2：sbwml 源（openlist2 4.2.9 + LuCI），版本比 coolsnowwolf/packages 的 net/openlist(4.2.7) 新
# 其余三个插件(网易云音乐解锁/KMS/ZeroTier)没有同名冲突，直接由 seed 选择即可。

base="${HOME_PATH:-.}"

# Lucky 守护进程版本钉子：跟随官网文件站 https://release.66666.host 手动更新
# （作者 3.6+ 只发官网文件站，GitHub releases 停在 3.5.0 且无 v3.8.1 tag；
#   Build/Prepare 下载源已同步改为 官网直连 + GitHub 兜底，见下方第二个 sed）
Lucky_ver="3.8.1"

# ---------- Lucky（danshui 源界面 + 守护进程升到 Lucky_ver） ----------
Lucky_tmp="$(mktemp -d)"
if git clone -q --depth=1 --filter=blob:none --sparse -b Lede https://github.com/angel-Xn/openwrt-package.git "${Lucky_tmp}/owpkg"; then
    git -C "${Lucky_tmp}/owpkg" sparse-checkout set luci-app-lucky
    mkdir -p "${base}/package/lucky" "${base}/package/luci-app-lucky"
    cp -Rf "${Lucky_tmp}/owpkg/luci-app-lucky/lucky/." "${base}/package/lucky/"
    cp -Rf "${Lucky_tmp}/owpkg/luci-app-lucky/luci-app-lucky/." "${base}/package/luci-app-lucky/"
    sed -i "s/^PKG_VERSION:=.*/PKG_VERSION:=${Lucky_ver}/" "${base}/package/lucky/Makefile"
    # procd 默认 respawn 重试 5 次即放弃，Lucky 自更新后退出进程若遇暂态故障会被放弃；
    # 改为无限重试（threshold 3600 / timeout 5 / retry 0），配合 angel-lucky-guard 开机自愈
    sed -i 's/procd_set_param respawn[[:space:]]*$/procd_set_param respawn 3600 5 0/' "${base}/package/lucky/files/lucky.init"
    # 下载源：danshui 原版只从 GitHub releases 拉，新版(3.6+) GitHub 已无对应 tag 会 404；
    # 改为官网文件站直连优先（release.66666.host/v{ver}/{ver}_lucky/...），GitHub 兜底
    sed -i 's|wget https://github\.com/gdy666/lucky/releases/download/v\$(PKG_VERSION)/\$(PKG_NAME)_\$(PKG_VERSION)_Linux_\$(LUCKY_ARCH)\.tar\.gz -O \$(PKG_BUILD_DIR)/\$(PKG_NAME)_\$(PKG_VERSION)_Linux_\$(LUCKY_ARCH)\.tar\.gz|wget https://release.66666.host/v$(PKG_VERSION)/$(PKG_VERSION)_lucky/$(PKG_NAME)_$(PKG_VERSION)_Linux_$(LUCKY_ARCH).tar.gz -O $(PKG_BUILD_DIR)/$(PKG_NAME)_$(PKG_VERSION)_Linux_$(LUCKY_ARCH).tar.gz \|\| wget https://github.com/gdy666/lucky/releases/download/v$(PKG_VERSION)/$(PKG_NAME)_$(PKG_VERSION)_Linux_$(LUCKY_ARCH).tar.gz -O $(PKG_BUILD_DIR)/$(PKG_NAME)_$(PKG_VERSION)_Linux_$(LUCKY_ARCH).tar.gz|' "${base}/package/lucky/Makefile"
    echo "Lucky 插件已就位（界面 danshui 新版，守护进程 v${Lucky_ver}，优先于 lede 源同名旧版）"
else
    echo "警告：Lucky 源拉取失败，将回退使用 feeds 里的旧版本" >&2
fi
rm -rf "${Lucky_tmp}"

# ---------- Lucky 在线更新覆盖层（Angel 2026-11-27） ----------
# 源：本仓库 build/Lede/diy/lucky-override/（BUILD_DIY 已把它拷到 lede 根 ${base}/lucky-override）
# 内容：config.js 加「在线更新」区块 + luci.lucky ucode 加 upgrade_check/upgrade_run rpc；
#       配套升级脚本 build/Lede/files/usr/libexec/lucky-upgrade 走 files/ 进固件。
# 必须 danshui 拷贝之后执行才能盖住同步源版本；danshui 上游若改版只需重做 override 两文件。
if [[ -d "${base}/lucky-override" && -d "${base}/package/luci-app-lucky" ]]; then
    cp -Rf "${base}/lucky-override/." "${base}/package/luci-app-lucky/"
    rm -rf "${base}/lucky-override"
    echo "Lucky 在线更新覆盖层已合并（config.js + luci.lucky ucode）"
else
    echo "警告：lucky-override 未合并（目录缺失或 Lucky 源拉取失败）" >&2
fi

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

# ---------- OpenList2（sbwml 源：openlist2 守护进程 + LuCI 成对） ----------
# 版本跟随 https://github.com/sbwml/luci-app-openlist2（openlist2 4.2.9，OpenListTeam 官方源码构建），
# 比 coolsnowwolf/packages 的 net/openlist(4.2.7) 新；seed 里选 openlist2/luci-app-openlist2，
# feeds 里的 net/openlist 不会被选中，互不冲突。Makefile 已用 $(TOPDIR) 绝对路径，无需 sed。
OpenList2_tmp="$(mktemp -d)"
if git clone -q --depth=1 https://github.com/sbwml/luci-app-openlist2.git "${OpenList2_tmp}/src"; then
    mkdir -p "${base}/package/openlist2" "${base}/package/luci-app-openlist2"
    cp -Rf "${OpenList2_tmp}/src/openlist2/." "${base}/package/openlist2/"
    cp -Rf "${OpenList2_tmp}/src/luci-app-openlist2/." "${base}/package/luci-app-openlist2/"
    echo "OpenList2 插件已就位（sbwml 源，openlist2 + LuCI 成对）"
else
    echo "警告：OpenList2 源拉取失败，固件将不含 OpenList" >&2
fi
rm -rf "${OpenList2_tmp}"
