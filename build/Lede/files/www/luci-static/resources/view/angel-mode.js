'use strict';
'require view';
'require rpc';
'require ui';

const MODES = {
	main: {
		title: '主路由模式',
		desc: '本机作为局域网主网关，负责 DHCP、网关与 NAT。',
		ip: '10.0.0.1',
		rows: [
			[ 'LAN 地址', '10.0.0.1/23' ],
			[ 'DHCP 服务', '开启' ],
			[ '网关 / DNS', '由本机提供' ],
			[ 'WAN 口', 'eth1 独立拨号' ],
			[ '防火墙 / NAT', '开启' ]
		]
	},
	bypass: {
		title: '旁路由模式',
		desc: '本机作为旁路网关，上层路由仍负责 DHCP，流量需指到本机。',
		ip: '10.0.0.2',
		rows: [
			[ 'LAN 地址', '10.0.0.2/23' ],
			[ 'DHCP 服务', '关闭' ],
			[ '网关 / DNS', '10.0.0.1' ],
			[ 'WAN 口', '并入 LAN（全口交换）' ],
			[ '防火墙 / NAT', '关闭，仅转发' ]
		]
	}
};

return view.extend({
	callStatus: rpc.declare({
		object: 'luci.angel',
		method: 'status',
		expect: { }
	}),

	callApply: rpc.declare({
		object: 'luci.angel',
		method: 'apply',
		params: [ 'mode' ],
		expect: { }
	}),

	load() {
		return this.callStatus();
	},

	doApply(mode) {
		const m = MODES[mode];
		ui.showConfirm('切换工作模式',
			'确定切换到「' + m.title + '」吗？设备将在 3 秒后自动重启。'
			+ '重启后请通过 http://' + m.ip + ' 访问管理页面。',
			() => {
				this.callApply(mode).then((res) => {
					if (res.status !== 0) {
						ui.addNotification(null, E('p', '切换失败：' + (res.error || '未知错误')), 'error');
						return;
					}
					ui.showModal('正在重启', [
						E('p', '配置已保存，设备正在重启。请稍候 1~2 分钟后重新访问 http://' + m.ip + ' 。')
					]);
				}).catch((e) => {
					ui.addNotification(null, E('p', '切换失败：' + (e.message || e)), 'error');
				});
			});
	},

	render(status) {
		const cur = (status && (status.mode === 'main' || status.mode === 'bypass')) ? status.mode : null;
		const cards = Object.keys(MODES).map((k) => {
			const m = MODES[k];
			const isCur = (cur === k);
			return E('div', { 'class': 'col-md-6' }, [
				E('div', { 'class': 'cbi-section' }, [
					E('h3', {}, [ m.title + (isCur ? '（当前模式）' : '') ]),
					E('p', { 'class': 'help-inline' }, m.desc),
					E('table', { 'class': 'table' }, m.rows.map((r) =>
						E('tr', {}, [ E('td', {}, r[0]), E('td', {}, r[1]) ]))),
					E('button', {
						'class': 'btn cbi-button-action',
						'disabled': isCur ? 'disabled' : null,
						'click': () => this.doApply(k)
					}, [ isCur ? '当前模式' : '切换到此模式' ])
				])
			]);
		});

		return E('div', {}, [
			E('h2', {}, [ '主路由 / 旁路由切换' ]),
			E('p', { 'class': 'help-inline' }, '切换会修改网络、DHCP 与防火墙配置，随后自动重启。当前模式：'
				+ (cur ? MODES[cur].title : '未选择（默认主路由形态）')
				+ (status && status.ip ? '，当前 LAN IP：' + status.ip : '') + '。'),
			E('div', { 'class': 'row' }, cards),
			E('div', { 'class': 'alert alert-warning' }, [
				E('strong', {}, [ '切换前必读' ]),
				E('ul', {}, [
					E('li', {}, [ '网段固定为 10.0.0.0/23。旁路由的网关固定为 10.0.0.1，若你的上层路由不在此网段，切换旁路由后会失联。' ]),
					E('li', {}, [ '旁路由不发 DHCP，也不会自动接替网关。需在上层路由把 DHCP 网关指向 10.0.0.2，客户端流量才会经过本机。' ]),
					E('li', {}, [ '切换后 LAN IP 会变化（主 10.0.0.1 / 旁 10.0.0.2），重启后用新 IP 访问，旧地址不再可用。' ]),
					E('li', {}, [ '也可在 SSH 中执行 angel-mode main 或 angel-mode bypass 完成切换。' ])
				])
			])
		]);
	}
});
