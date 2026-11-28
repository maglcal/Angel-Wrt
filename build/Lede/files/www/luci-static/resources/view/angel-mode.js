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

/* 卡片左上角的小图标（内联 SVG，随主题文字色变化） */
const ICONS = {
	main: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M6 17.5h.01M9 17.5h.01"/><path d="M12 14v-3"/><path d="M7.5 8.5a6.4 6.4 0 0 1 9 0"/><path d="M5 5.5a10 10 0 0 1 14 0"/></svg>',
	bypass: '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="12" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 11l10-4.4M7 13l10 4.4"/></svg>'
};

const GLASS_CSS = `
.angel-stage { position: relative; padding: 8px 4px 16px; }
.angel-stage > .angel-blob { position: absolute; border-radius: 999px; filter: blur(70px); opacity: .35; pointer-events: none; z-index: 0; }
.angel-blob-1 { width: 340px; height: 340px; top: -80px; left: 4%; background: #7aa5ff; }
.angel-blob-2 { width: 300px; height: 300px; top: 120px; right: 6%; background: #9d7aff; }
.angel-blob-3 { width: 260px; height: 260px; bottom: -60px; left: 38%; background: #63d2c3; }
.angel-stage > *:not(.angel-blob) { position: relative; z-index: 1; }

.angel-glass {
	background: rgba(255, 255, 255, .52);
	-webkit-backdrop-filter: blur(16px) saturate(150%);
	backdrop-filter: blur(16px) saturate(150%);
	border: 1px solid rgba(255, 255, 255, .55);
	border-radius: 16px;
	box-shadow: 0 8px 28px rgba(16, 24, 40, .10), inset 0 1px 0 rgba(255, 255, 255, .40);
}

.angel-head { padding: 18px 22px; margin-bottom: 18px; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
.angel-head h2 { margin: 0; font-size: 1.35rem; font-weight: 600; letter-spacing: .3px; }
.angel-head .angel-sub { flex-basis: 100%; margin: 0; font-size: .88rem; }

.angel-pill {
	display: inline-flex; align-items: center; gap: 7px;
	padding: 4px 14px; border-radius: 999px; font-size: .82rem; font-weight: 600;
	background: linear-gradient(135deg, rgba(59,130,246,.22), rgba(139,92,246,.22));
	border: 1px solid rgba(59,130,246,.38);
	box-shadow: 0 2px 10px rgba(59,130,246,.15);
	white-space: nowrap;
}
.angel-pill::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 6px rgba(59,130,246,.8); }
.angel-pill.idle::before { background: #9ca3af; box-shadow: none; }

.angel-card { padding: 20px 22px; height: 100%; display: flex; flex-direction: column; transition: transform .22s ease, box-shadow .22s ease; }
.angel-card:hover { transform: translateY(-3px); box-shadow: 0 16px 40px rgba(16, 24, 40, .16), inset 0 1px 0 rgba(255, 255, 255, .40); }
.angel-card.is-current { border-color: rgba(59,130,246,.45); box-shadow: 0 8px 28px rgba(59,130,246,.16), inset 0 1px 0 rgba(255,255,255,.40); }
.angel-card-top { display: flex; align-items: flex-start; gap: 12px; }
.angel-icon { flex: 0 0 auto; width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center;
	background: linear-gradient(135deg, rgba(59,130,246,.16), rgba(139,92,246,.16));
	border: 1px solid rgba(255,255,255,.45); color: #3b82f6; }
.angel-card.is-current .angel-icon { color: #2563eb; }
.angel-title-wrap { min-width: 0; }
.angel-card h3 { margin: 2px 0 4px; font-size: 1.08rem; font-weight: 600; }
.angel-desc { margin: 0; font-size: .84rem; line-height: 1.5; }

.angel-table { width: 100%; margin: 14px 0 16px; border-collapse: collapse; }
.angel-table td { border: 0; border-bottom: 1px dashed rgba(120,120,140,.22); padding: 7px 2px; font-size: .88rem; }
.angel-table tr:last-child td { border-bottom: 0; }
.angel-table td:first-child { width: 38%; }

.angel-btn {
	display: inline-block; width: 100%; padding: 9px 18px; border-radius: 12px; border: 1px solid rgba(255,255,255,.5);
	font-size: .92rem; font-weight: 600; color: #fff; letter-spacing: .3px; cursor: pointer; text-align: center;
	background: linear-gradient(135deg, #3b82f6, #7c5cf0);
	box-shadow: 0 6px 18px rgba(59,130,246,.32), inset 0 1px 0 rgba(255,255,255,.30);
	transition: transform .18s ease, box-shadow .18s ease, filter .18s ease;
}
.angel-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 10px 24px rgba(59,130,246,.40), inset 0 1px 0 rgba(255,255,255,.30); filter: brightness(1.06); }
.angel-btn:active:not(:disabled) { transform: translateY(0); }
.angel-btn:disabled { cursor: not-allowed; color: rgba(255,255,255,.92);
	background: linear-gradient(135deg, rgba(148,163,184,.75), rgba(120,140,170,.75));
	box-shadow: none; border-color: rgba(255,255,255,.35); }

.angel-warn {
	margin-top: 18px; padding: 14px 20px; font-size: .86rem;
	background: rgba(245, 178, 68, .16);
	border: 1px solid rgba(245, 178, 68, .40);
}
.angel-warn ul { margin: 6px 0 0 18px; padding: 0; }
.angel-warn li { margin-bottom: 4px; line-height: 1.55; }

.angel-muted { color: rgba(40, 44, 56, .62); }
@media (prefers-color-scheme: dark) {
	.angel-glass { background: rgba(26, 28, 36, .55); border-color: rgba(255, 255, 255, .14); box-shadow: 0 8px 28px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.08); }
	.angel-card:hover { box-shadow: 0 16px 40px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.08); }
	.angel-muted { color: rgba(255, 255, 255, .62); }
	.angel-table td { border-bottom-color: rgba(255,255,255,.14); }
	.angel-stage > .angel-blob { opacity: .25; }
	.angel-btn:disabled { color: rgba(255,255,255,.75); }
}`;

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
		const doIt = () => {
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
		};
		/* 本 LuCI 版本无 ui.showConfirm，用 showModal 拼确认弹窗 */
		ui.showModal('切换工作模式', [
			E('p', {}, [
				'确定切换到「' + m.title + '」吗？设备将在 3 秒后自动重启。',
				E('br'),
				'重启后请通过 http://' + m.ip + ' 访问管理页面。'
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'btn',
					'click': ui.hideModal
				}, [ '取消' ]),
				' ',
				E('button', {
					'class': 'btn cbi-button-action important',
					'click': () => { ui.hideModal(); doIt(); }
				}, [ '确认切换' ])
			])
		], 'angel-mode-confirm');
	},

	render(status) {
		const cur = (status && (status.mode === 'main' || status.mode === 'bypass')) ? status.mode : null;

		const cards = Object.keys(MODES).map((k) => {
			const m = MODES[k];
			const isCur = (cur === k);
			return E('div', { 'class': 'col-md-6' }, [
				E('div', { 'class': 'angel-glass angel-card' + (isCur ? ' is-current' : '') }, [
					E('div', { 'class': 'angel-card-top' }, [
						E('div', { 'class': 'angel-icon', 'aria-hidden': 'true' }, [ E(ICONS[k]) ]),
						E('div', { 'class': 'angel-title-wrap' }, [
							E('h3', {}, [ m.title ]),
							E('p', { 'class': 'angel-desc angel-muted' }, [ m.desc ])
						]),
						E('span', {
							'class': 'angel-pill' + (isCur ? '' : ' idle'),
							'style': 'margin-left:auto'
						}, [ isCur ? '当前模式' : '未启用' ])
					]),
					E('table', { 'class': 'angel-table' }, m.rows.map((r) =>
						E('tr', {}, [
							E('td', { 'class': 'angel-muted' }, [ r[0] ]),
							E('td', {}, [ r[1] ])
						]))),
					E('button', {
						'class': 'angel-btn',
						'disabled': isCur ? 'disabled' : null,
						'click': () => this.doApply(k)
					}, [ isCur ? '当前模式' : '切换到此模式' ])
				])
			]);
		});

		return E('div', { 'class': 'angel-stage' }, [
			E('style', {}, [ GLASS_CSS ]),
			E('div', { 'class': 'angel-blob angel-blob-1', 'aria-hidden': 'true' }),
			E('div', { 'class': 'angel-blob angel-blob-2', 'aria-hidden': 'true' }),
			E('div', { 'class': 'angel-blob angel-blob-3', 'aria-hidden': 'true' }),
			E('div', { 'class': 'angel-glass angel-head' }, [
				E('h2', {}, [ '主路由 / 旁路由切换' ]),
				E('span', {
					'class': 'angel-pill' + (cur ? '' : ' idle')
				}, [ cur ? MODES[cur].title : '未选择（默认主路由形态）' ]),
				E('p', { 'class': 'angel-sub angel-muted' },
					'切换会修改网络、DHCP 与防火墙配置，随后自动重启。'
					+ (status && status.ip ? '当前 LAN IP：' + status.ip + '。' : ''))
			]),
			E('div', { 'class': 'row' }, cards),
			E('div', { 'class': 'angel-glass angel-warn' }, [
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
