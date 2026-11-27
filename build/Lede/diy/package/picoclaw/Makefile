# SPDX-License-Identifier: MIT
#
# Copyright (C) 2026 许诺
# PicoClaw 二进制分发打包：源码 https://github.com/afjcjsbx/picoclaw (MIT License)
# 预编译 Linux x86_64 单文件，免 Go 工具链编译，随固件直接下发。
#

include $(TOPDIR)/rules.mk

PKG_NAME:=picoclaw
PKG_VERSION:=0.5.6
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=afjcjsbx
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_HASH:=skip

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=utils
	CATEGORY:=Utilities
	TITLE:=PicoClaw featherweight AI agent (router edition)
	DEPENDS:=@x86_64
	URL:=https://github.com/afjcjsbx/picoclaw
endef

define Package/$(PKG_NAME)/description
  PicoClaw: ultra-lightweight personal AI agent written in Go (10-20 MB RAM).
  Ships with the browser-based Launcher dashboard (port 18800) which manages
  the gateway subprocess; configure LLM providers/channels in the dashboard.
endef

define Build/Prepare
	[ ! -f $(PKG_BUILD_DIR)/picoclaw_Linux_x86_64.tar.gz ] && wget https://github.com/afjcjsbx/picoclaw/releases/download/v$(PKG_VERSION)/picoclaw_Linux_x86_64.tar.gz -O $(PKG_BUILD_DIR)/picoclaw_Linux_x86_64.tar.gz
	tar -xzf $(PKG_BUILD_DIR)/picoclaw_Linux_x86_64.tar.gz -C $(PKG_BUILD_DIR) || exit 1
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/picoclaw
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/bin/
	$(INSTALL_DIR) $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/config/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/picoclaw $(1)/usr/bin/picoclaw
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/picoclaw-launcher $(1)/usr/bin/picoclaw-launcher
	$(INSTALL_BIN) $(CURDIR)/files/picoclaw.init $(1)/etc/init.d/picoclaw
	$(INSTALL_CONF) $(CURDIR)/files/picoclaw.config $(1)/etc/config/picoclaw
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
