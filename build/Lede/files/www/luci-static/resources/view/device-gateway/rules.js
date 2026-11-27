'use strict';
'require view';
'require form';
'require uci';
'require network';
'require ui';
'require dom';
'require fs';
'require poll';

var config = 'device-gateway';
var statusPath = '/tmp/device-gateway.status';

function isIPv4(ip) {
	var parts = String(ip).split('.');
	return parts.length === 4 && parts.every(function(o) {
		return /^(0|[1-9][0-9]{0,2})$/.test(o) && Number(o) <= 255;
	});
}

function saveMaps() {
	var tasks = [];
	document.getElementById('maincontent').querySelectorAll('.cbi-map').forEach(function(map) {
		tasks.push(dom.callClassMethod(map, 'save'));
	});
	return Promise.all(tasks);
}

return view.extend({
	handleSave: function() {
		return saveMaps();
	},
	handleSaveApply: function(ev, mode) {
		return saveMaps().then(function() { return ui.changes.apply(mode == '0'); });
	},

	load: function() {
		return Promise.all([
			uci.load(config),
			network.getHostHints(),
			network.getNetwork('lan'),
			fs.read(statusPath).catch(function() { return ''; })
		]);
	},

	render: function(data) {
		var hints = data[1];
		var lan = data[2];
		var lanIp = lan ? lan.getIPAddr() : null;
		var m = new form.Map(config, _('设备网关'),
			_('按设备下发固定 IPv4、网关与 DNS。网关和 DNS 都选“继承”时，只分配固定 IP。IPv6 由系统单独配置。'));

		// 全局设置
		var g = m.section(form.NamedSection, 'main', 'settings', _('全局设置'));
		g.anonymous = true;
		g.addremove = false;
		var enabled = g.option(form.Flag, 'enabled', _('启用'));
		enabled.default = '1';
		enabled.rmempty = false;
		enabled.description = _('关闭后自动清理本插件生成的 dnsmasq 配置，不影响系统原有静态租约。');

		// 网关预设（内置主路由 / 旁路由，另可自定义）
		var presets = m.section(form.TableSection, 'gateway_preset', _('网关预设'));
		presets.anonymous = true;
		presets.addremove = true;
		presets.nodescriptions = true;
		var label = presets.option(form.Value, 'label', _('名称'));
		label.rmempty = false;
		var addr = presets.option(form.Value, 'address', _('IPv4 地址'));
		addr.rmempty = false;
		addr.datatype = 'ip4addr';
		addr.validate = function(id, value) {
			return isIPv4(value) || _('请输入有效的 IPv4 地址');
		};

		// 设备规则
		var s = m.section(form.TableSection, 'rule', _('设备规则'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.addbtntitle = _('添加设备');
		s.description = _('旁路由场景：给指定设备选“旁路由 10.0.0.2”网关，其他设备不受影响。手机的随机 MAC 需先设为固定私有地址。');

		var en = s.option(form.Flag, 'enabled', _('启用'));
		en.default = '1';
		en.rmempty = false;

		var name = s.option(form.Value, 'name', _('设备名称'));
		name.rmempty = true;

		var mac = s.option(form.ListValue, 'mac', _('设备 / MAC'));
		mac.rmempty = false;
		mac.datatype = 'macaddr';
		mac.editable = true;
		hints.getMACHints(false).forEach(function(h) {
			var value = String(h[0]).toLowerCase();
			var ip = hints.getIPAddrByMACAddr(h[0]);
			mac.value(value, [h[1], ip, h[0]].filter(function(v) { return v; }).join(' · '));
		});
		mac.cfgvalue = function(id) {
			return String(uci.get(config, id, 'mac') || '').toLowerCase();
		};
		mac.write = function(id, value) {
			value = String(value).toLowerCase();
			uci.set(config, id, 'mac', value);
			if (!uci.get(config, id, 'ip')) {
				var ip = hints.getIPAddrByMACAddr(value);
				if (ip) uci.set(config, id, 'ip', ip);
			}
			if (!uci.get(config, id, 'name')) {
				var host = hints.getHostnameByMACAddr(value);
				if (host) uci.set(config, id, 'name', host);
			}
		};

		var ipOpt = s.option(form.Value, 'ip', _('固定 IP'));
		ipOpt.datatype = 'ip4addr';
		ipOpt.rmempty = false;
		ipOpt.placeholder = _('选择设备后自动填写');

		// 网关：内置主路由/旁路由 + 自定义预设
		var gw = s.option(form.ListValue, 'gateway_mode', _('指定网关'));
		gw.rmempty = false;
		gw.default = 'inherit';
		gw.value('inherit', lanIp ? _('继承 · %s').format(lanIp) : _('继承当前网络'));
		gw.value('gw_main', _('主路由 · 10.0.0.1'));
		gw.value('gw_bypass', _('旁路由 · 10.0.0.2'));
		var renderGw = gw.renderWidget;
		gw.renderWidget = function(id, idx, value) {
			this.keylist = []; this.vallist = [];
			this.value('inherit', lanIp ? _('继承 · %s').format(lanIp) : _('继承当前网络'));
			this.value('gw_main', _('主路由 · 10.0.0.1'));
			this.value('gw_bypass', _('旁路由 · 10.0.0.2'));
			uci.sections(config, 'gateway_preset').forEach(function(p) {
				if (p.label && p.address) this.value(p['.name'], p.label + ' · ' + p.address);
			}, this);
			if (value && this.keylist.indexOf(value) < 0)
				this.value(value, _('自定义 · %s').format(value));
			return renderGw.call(this, id, idx, value);
		};

		// DNS：内置常用公共 DNS + 自定义
		var dnsMode = s.option(form.Value, 'dns_mode', _('指定 DNS'));
		dnsMode.rmempty = false;
		dnsMode.default = 'inherit';
		dnsMode.value('inherit', _('继承当前网络'));
		dnsMode.value('ali', _('阿里 · 223.5.5.5 / 223.6.6.6'));
		dnsMode.value('tencent', _('腾讯 · 119.29.29.29'));
		dnsMode.value('114', _('114 · 114.114.114.114'));
		dnsMode.placeholder = _('或填自定义 IPv4，多个用逗号分隔');
		dnsMode.validate = function(id, value) {
			if (['inherit', 'ali', 'tencent', '114'].indexOf(value) >= 0) return true;
			var list = String(value).split(/[\s,]+/).filter(function(v) { return v; });
			return list.length && list.every(isIPv4) || _('请输入一个或多个 IPv4 DNS，逗号分隔');
		};
		dnsMode.cfgvalue = function(id) {
			var mode = uci.get(config, id, 'dns_mode');
			if (mode && ['inherit', 'ali', 'tencent', '114'].indexOf(mode) >= 0) return mode;
			var v = uci.get(config, id, 'dns');
			return (Array.isArray(v) ? v.join(', ') : v) || 'inherit';
		};
		dnsMode.write = function(id, value) {
			if (['inherit', 'ali', 'tencent', '114'].indexOf(value) >= 0) {
				uci.set(config, id, 'dns_mode', value);
				uci.unset(config, id, 'dns');
			} else {
				uci.set(config, id, 'dns_mode', 'custom');
				uci.set(config, id, 'dns', String(value).trim().split(/[\s,]+/).join(','));
			}
		};

		// 同步记录面板
		var status = E('p');
		var summary = E('summary', { style: 'cursor:pointer' }, _('DHCP 同步记录'));
		var details = E('details', { 'class': 'cbi-section' }, [summary, status,
			E('p', {}, _('这是路由器侧的规则加载记录。设备何时采用新参数取决于 DHCP 续租。'))]);
		function showStatus(v) {
			var next = String(v).trim() || _('暂无同步记录。');
			if (next === status.textContent) return;
			status.textContent = next;
			var failed = next.indexOf('错误') >= 0;
			summary.textContent = failed ? _('同步失败') : _('DHCP 同步记录');
			if (failed) details.open = true;
		}
		showStatus(data[3]);
		poll.add(function() {
			return fs.read(statusPath).then(showStatus).catch(function() {});
		}, 5);

		return m.render().then(function(content) {
			return E('div', {}, [content, details]);
		});
	}
});
