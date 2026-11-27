# SPDX-License-Identifier: Apache-2.0
#
# Copyright (C) 2026 许诺
# SongLoft 二进制分发打包：源码 https://github.com/songloft-org/songloft (Apache-2.0)
# 预编译 linux-amd64 单文件（前身为 MiMusic），免 Go 工具链编译。
#

include $(TOPDIR)/rules.mk

PKG_NAME:=songloft
PKG_VERSION:=2.13.13
PKG_RELEASE:=1

PKG_LICENSE:=Apache-2.0
PKG_LICENSE_FILES:=LICENSE
PKG_MAINTAINER:=songloft-org
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)
PKG_HASH:=skip

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
	SECTION:=net
	CATEGORY:=Network
	TITLE:=SongLoft self-hosted music server (port 58091)
	DEPENDS:=@x86_64
	URL:=https://github.com/songloft-org/songloft
endef

define Package/$(PKG_NAME)/description
  SongLoft: self-hosted music server for music you legally own.
  Web UI on port 58091; data in /etc/songloft/data, music library
  defaults to /etc/songloft/music (can point to a mounted disk in the app).
endef

define Build/Prepare
	[ ! -f $(PKG_BUILD_DIR)/songloft-linux-amd64 ] && wget https://github.com/songloft-org/songloft/releases/download/v$(PKG_VERSION)/songloft-linux-amd64 -O $(PKG_BUILD_DIR)/songloft-linux-amd64
	chmod 755 $(PKG_BUILD_DIR)/songloft-linux-amd64
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/conffiles
/etc/config/songloft
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/bin/
	$(INSTALL_DIR) $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/config/
	$(INSTALL_DIR) $(1)/etc/songloft/data
	$(INSTALL_DIR) $(1)/etc/songloft/music
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/songloft-linux-amd64 $(1)/usr/bin/songloft
	$(INSTALL_BIN) $(CURDIR)/files/songloft.init $(1)/etc/init.d/songloft
	$(INSTALL_CONF) $(CURDIR)/files/songloft.config $(1)/etc/config/songloft
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
