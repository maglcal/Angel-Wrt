/* Angel-Wrt 首启模式设置向导（自包含，无外部依赖）
 * 流程：打开网页入口 → 查 /cgi-bin/angel-wizard?state →
 *   已配置：跳转 LuCI；未配置：弹向导，选主路由/旁路由，应用后设备重启。 */
(function () {
	"use strict";

	if (window.__angelWizardLoaded) return;
	window.__angelWizardLoaded = true;

	var API = "/cgi-bin/angel-wizard";
	var LUCI = "cgi-bin/luci/";

	var MODES = {
		main: {
			title: "主路由模式",
			subtitle: "本机拨号/做网关，家庭网络的大脑",
			items: [
				"后台 10.0.0.1",
				"DHCP 服务开启，给全网发地址",
				"WAN 口独立，防火墙 / NAT 开启",
				"DNS：dnsmasq 直接走外网上游",
				"主机名 OpenWrt-Angel"
			],
			warn: ""
		},
		bypass: {
			title: "旁路由模式",
			subtitle: "挂在现有主路由旁边，只做旁路处理",
			items: [
				"后台 10.0.0.2",
				"DHCP 关闭，地址仍由主路由分配",
				"网关 / DNS 指向 10.0.0.1",
				"WAN 口并入 LAN，防火墙关闭、IP 转发开启",
				"DNS：dnsmasq 上游固定 10.0.0.1",
				"主机名 OpenWrt-Angel-Bypass"
			],
			warn: "重要：请先用网线把电脑直连本机完成选择，再把本机接入主网络。未选择就接入会与现有主路由 IP 冲突。"
		}
	};

	function h(tag, attrs, children) {
		var e = document.createElement(tag);
		if (attrs) Object.keys(attrs).forEach(function (k) {
			if (k === "class") e.className = attrs[k];
			else if (k === "text") e.textContent = attrs[k];
			else e.setAttribute(k, attrs[k]);
		});
		(children || []).forEach(function (c) { e.appendChild(c); });
		return e;
	}

	var css = [
		".aw-mask{position:fixed;inset:0;background:rgba(10,14,20,.72);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}",
		".aw-panel{background:#fff;color:#1c2430;border-radius:14px;width:min(760px,92vw);max-height:92vh;overflow:auto;padding:28px 30px;box-shadow:0 24px 64px rgba(0,0,0,.35)}",
		".aw-panel h1{margin:0 0 4px;font-size:22px}",
		".aw-panel .aw-lead{margin:0 0 20px;color:#5b6779;font-size:14px}",
		".aw-cards{display:flex;gap:16px;flex-wrap:wrap}",
		".aw-card{flex:1 1 300px;border:2px solid #dfe5ee;border-radius:12px;padding:18px 18px 14px;cursor:pointer;transition:border-color .15s,box-shadow .15s;background:#fbfcfe}",
		".aw-card:hover{border-color:#8aa9d6}",
		".aw-card.aw-sel{border-color:#2f6fdd;box-shadow:0 0 0 3px rgba(47,111,221,.15)}",
		".aw-card h2{margin:0 0 2px;font-size:17px}",
		".aw-card .aw-sub{color:#6b7787;font-size:12.5px;margin:0 0 10px}",
		".aw-card ul{margin:0;padding-left:18px;color:#3a4553;font-size:13px;line-height:1.75}",
		".aw-warn{margin-top:10px;background:#fff6e8;border:1px solid #f0c98a;color:#8a5a12;border-radius:8px;padding:8px 10px;font-size:12.5px;line-height:1.6}",
		".aw-foot{margin-top:22px;display:flex;align-items:center;justify-content:flex-end;gap:12px}",
		".aw-btn{border:0;border-radius:9px;padding:10px 22px;font-size:14px;cursor:pointer}",
		".aw-btn:disabled{opacity:.5;cursor:not-allowed}",
		".aw-primary{background:#2f6fdd;color:#fff}",
		".aw-ghost{background:transparent;color:#5b6779}",
		".aw-status{margin-top:18px;font-size:13.5px;color:#5b6779}",
		".aw-status.aw-err{color:#c2352c}",
		".aw-done h1{color:#1c2430}",
		"@media (prefers-color-scheme: dark){",
		".aw-panel{background:#171d27;color:#e8edf5}",
		".aw-card{background:#1e2632;border-color:#2c3646}",
		".aw-card:hover{border-color:#47608a}",
		".aw-card.aw-sel{border-color:#5b8dee;box-shadow:0 0 0 3px rgba(91,141,238,.18)}",
		".aw-card .aw-sub{color:#94a1b3}",
		".aw-card ul{color:#c3cddc}",
		".aw-panel .aw-lead{color:#94a1b3}",
		".aw-warn{background:#33270f;border-color:#7a5c22;color:#f2d191}",
		".aw-ghost{color:#94a1b3}",
		".aw-status{color:#94a1b3}",
		"}"
	].join("\n");

	function injectCss() {
		var s = document.createElement("style");
		s.textContent = css;
		document.head.appendChild(s);
	}

	function renderWizard() {
		injectCss();
		var chosen = null;
		var applyBtn = h("button", { "class": "aw-btn aw-primary", disabled: "disabled", text: "应用所选模式" });
		var status = h("div", { "class": "aw-status", text: "请选择本机的工作模式，选择后设备会自动重启。" });

		var mask = h("div", { "class": "aw-mask" });
		var panel = h("div", { "class": "aw-panel" });

		panel.appendChild(h("h1", { text: "Angel-Wrt 模式设置向导" }));
		panel.appendChild(h("p", { "class": "aw-lead", text: "首次开机请选择本机工作模式。此向导只会出现这一次，之后如需切换请在 SSH 里执行 angel-mode 命令。" }));

		var cards = h("div", { "class": "aw-cards" });
		["main", "bypass"].forEach(function (key) {
			var m = MODES[key];
			var ul = h("ul");
			m.items.forEach(function (t) { ul.appendChild(h("li", { text: t })); });
			var card = h("div", { "class": "aw-card" }, [
				h("h2", { text: m.title }),
				h("p", { "class": "aw-sub", text: m.subtitle }),
				ul
			]);
			if (m.warn) card.appendChild(h("div", { "class": "aw-warn", text: m.warn }));
			card.addEventListener("click", function () {
				chosen = key;
				Array.prototype.forEach.call(cards.children, function (c) { c.classList.remove("aw-sel"); });
				card.classList.add("aw-sel");
				applyBtn.removeAttribute("disabled");
				status.className = "aw-status";
				status.textContent = "已选择：" + m.title + "。点击「应用所选模式」后设备会自动重启。";
			});
			cards.appendChild(card);
		});
		panel.appendChild(cards);

		var laterBtn = h("button", { "class": "aw-btn aw-ghost", text: "稍后再说" });
		laterBtn.addEventListener("click", function () {
			mask.parentNode && mask.parentNode.removeChild(mask);
		});
		applyBtn.addEventListener("click", function () {
			if (!chosen) return;
			applyBtn.setAttribute("disabled", "disabled");
			laterBtn.setAttribute("disabled", "disabled");
			status.className = "aw-status";
			status.textContent = "正在应用 " + MODES[chosen].title + " ...";
			fetch(API + "?apply=" + chosen, { cache: "no-store" })
				.then(function (r) { return r.json(); })
				.then(function (j) {
					if (j && j.ok) {
						panel.className = "aw-panel aw-done";
						panel.innerHTML = "";
						panel.appendChild(h("h1", { text: "已应用 " + MODES[chosen].title }));
						panel.appendChild(h("p", { "class": "aw-lead", text: "设备正在重启，请稍候 1~2 分钟后重新访问。" }));
						panel.appendChild(h("p", { "class": "aw-lead", text: "提示：以后如需切换模式，在 SSH 中执行 angel-mode main 或 angel-mode bypass。" }));
					} else {
						throw new Error((j && j.error) || "apply failed");
					}
				})
				.catch(function (err) {
					status.className = "aw-status aw-err";
					status.textContent = "应用失败：" + err.message + "。请重试，或在 SSH 中执行 angel-mode 命令。";
					applyBtn.removeAttribute("disabled");
					laterBtn.removeAttribute("disabled");
				});
		});

		panel.appendChild(h("div", { "class": "aw-foot" }, [laterBtn, applyBtn]));
		panel.appendChild(status);
		mask.appendChild(panel);
		document.body.appendChild(mask);
	}

	function boot() {
		fetch(API + "?state", { cache: "no-store" })
			.then(function (r) { return r.json(); })
			.then(function (st) {
				if (st && st.configured) {
					location.replace(LUCI);
					return;
				}
				renderWizard();
			})
			.catch(function () {
				/* 向导后端不可用时不挡路，直接进 LuCI */
				location.replace(LUCI);
			});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", boot);
	} else {
		boot();
	}
})();
