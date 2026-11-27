//   Copyright (C) 2021-2026 sirpdboy herboy2008@gmail.com https://github.com/sirpdboy/luci-app-lucky
//   Angel (2026-11-27): 在此基础上新增「在线更新」区块（检查云端最新版本/一键升级），
//   走 /usr/libexec/lucky-upgrade 五通道加速，修复 Lucky 内置更新 GitHub 直连不可达的问题。

'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require ui';
'require view';
'require fs';

async function checkProcess() {
    try {
        const pidofRes = await fs.exec('/bin/pidof', ['lucky']);
        if (pidofRes.code === 0) {
            return {
                running: true,
                pid: pidofRes.stdout.trim()
            };
        }
    } catch (err) {
    }
    try {
        const psRes = await fs.exec('/bin/ps', ['-C', 'lucky', '-o', 'pid=']);
        const pid = psRes.stdout.trim();
        return {
            running: pid !== '',
            pid: pid || null
        };
    } catch (err) {
        return { running: false, pid: null };
    }
}

const getLuckyConfig = rpc.declare({
    object: 'luci.lucky',
    method: 'get_Info',
    expect: { 'Info': {} }
});

const luckyUpgradeCheck = rpc.declare({
    object: 'luci.lucky',
    method: 'upgrade_check'
});

const luckyUpgradeRun = rpc.declare({
    object: 'luci.lucky',
    method: 'upgrade_run'
});

function getServiceStatus() {
    return L.resolveDefault(checkProcess(), {}).then(function(res) {
        let isRunning = false;
        try {
            if (res && res.running) {
                isRunning = true;
            }
        } catch (e) {
            console.error('Service status error:', e);
        }
        return isRunning;
    }).catch(function(error) {
        console.error('Service status check failed:', error);
        return false;
    });
}

function loadLuckyVer() {
    return L.resolveDefault(getLuckyConfig(), {}).then(function(result) {
        // console.debug('loadLuckyVer');
        return result.Version || 'Unknown';
    });
}

function renderStatus(isRunning, webport, safe_url, protocol, version) {
    let statusText = isRunning ? _('RUNNING') : _('NOT RUNNING');
    let color = isRunning ? 'green' : 'red';
    let icon = isRunning ? '✓' : '✗';
    let html = String.format(
        '<em><span style="color:%s">%s <strong>%s %s - %s</strong></span></em>',
        color, icon, _('Lucky'), version, statusText
    );

    if (isRunning) {
        let buttonUrl = String.format('%s//%s:%s/', protocol, window.location.hostname, webport);

        if (safe_url && safe_url.trim() !== '') {
            buttonUrl = String.format('%s%s/', buttonUrl, safe_url);
        }

        html += String.format(
            '<input class="cbi-button cbi-button-reload" type="button" style="margin-left: 20px" value="%s" onclick="window.open(\'%s\')">',
            _('Open Web Interface'),
            buttonUrl
        );
    }

    return html;
}

/* Angel: 更新区块渲染与交互 */
function upgradeCall(rpcFn, btn, statusEl) {
    const oldText = btn.value;
    btn.disabled = true;
    statusEl.innerHTML = '<em>' + (rpcFn === 'upgrade_check' ? _('Checking for updates, please wait...') : _('Downloading and upgrading, this may take 1-3 minutes...')) + '</em>';
    const call = (rpcFn === 'upgrade_check') ? luckyUpgradeCheck : luckyUpgradeRun;
    return L.resolveDefault(call, {}).then(function(res) {
        btn.disabled = false;
        btn.value = oldText;
        let html;
        if (!res || res.error) {
            html = '<span style="color:red">' + _('Update check failed') + ': ' + ((res && res.error) ? res.error : _('no response')) + '</span>';
        } else if (rpcFn === 'upgrade_check') {
            if (res.update) {
                html = '<span style="color:#e07a00">' + String.format(_('New version available: %s (current %s)'), res.latest, res.current) + '</span>';
            } else {
                html = '<span style="color:green">' + String.format(_('Already the latest version: %s'), res.current || res.latest) + '</span>';
            }
        } else {
            if (res.error) {
                html = '<span style="color:red">' + _('Upgrade failed') + ': ' + res.error + '</span>';
            } else {
                html = '<span style="color:green">' + String.format(_('Upgrade success: %s -> %s'), res.current, res.installed) + '</span>';
            }
        }
        statusEl.innerHTML = html;
        if (rpcFn === 'upgrade_run' && res && !res.error && res.installed) {
            ui.addNotification(null, E('p', {}, String.format(_('Lucky upgraded to %s, service restarted.'), res.installed)), 'info');
        }
    }).catch(function(err) {
        btn.disabled = false;
        btn.value = oldText;
        statusEl.innerHTML = '<span style="color:red">' + _('Update request failed') + ': ' + err + '</span>';
    });
}

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('lucky')
        ]);
    },

    handleResetUser: async function () {
    try {
        // 检查文件权限
        const stat = await fs.stat('/usr/bin/lucky');
        const result = await fs.exec('/usr/bin/lucky', ['-rResetUser', '-cd', '/etc/lucky']);
        if (result.code === 0) {
            alert(_('SUCCESS:') + '\n' + _('Username and password reset successfully to 666'));
        }
    } catch (error) { }
    },
    render: function(data) {
        let m, s, o;
        let webport = uci.get('lucky', 'lucky', 'port') || '16601';
        let safeurl = uci.get('lucky', 'lucky', 'safe') || '';
        let uci_ssl = uci.get('lucky', 'lucky', 'ssl') || '0';
        let protocol = uci_ssl === '1' ? 'https:' : 'http:';

        m = new form.Map('lucky', _('Lucky'),
            _('ipv4/ipv6 portforward,ddns,reverseproxy proxy,wake on lan,IOT and more,Default username and password 666'));

        // 状态显示部分
        s = m.section(form.TypedSection);
        s.anonymous = true;
        s.addremove = false;

        s.render = function() {
            poll.add(function() {
                return Promise.all([
                    L.resolveDefault(getServiceStatus()),
                    L.resolveDefault(loadLuckyVer())
                ]).then(function(results) {
                    const [isRunning, version] = results;
                    var view = document.getElementById('service_status');
                    if (view) {
                        view.innerHTML = renderStatus(isRunning, webport, safeurl, protocol, version);
                    }
                }).catch(function(error) {
                    console.error('Poll error:', error);
                });
            }, 5); // 添加轮询间隔5秒

            return E('div', { class: 'cbi-section', id: 'status_bar' }, [
                E('div', { id: 'service_status' },
                    E('p', {}, _('Collecting data...'))
                ),
		E('div', { 'style': 'text-align: right; font-style: italic;' }, [
                    E('span', {}, [
                        _('© github '),
                        E('a', {
                            'href': 'https://github.com/sirpdboy',
                            'target': '_blank',
                            'style': 'text-decoration: none;'
                        }, 'by sirpdboy')
                    ])
                ])
            ]);
        };

        // 在线更新部分（Angel 2026-11-27）
        s = m.section(form.TypedSection);
        s.anonymous = true;
        s.addremove = false;

        s.render = function() {
            return E('div', { class: 'cbi-section', id: 'lucky_upgrade_bar' }, [
                E('div', { class: 'cbi-section-descr' }, _('Online update: check the latest version from GitHub via accelerated channels and upgrade /usr/bin/lucky automatically (auto rollback on failure). The built-in update page of Lucky uses direct GitHub access, which is unreachable in most cases.')),
                E('div', { 'style': 'display:flex; align-items:center; gap:12px; flex-wrap:wrap;' }, [
                    E('button', {
                        'class': 'cbi-button cbi-button-apply',
                        'id': 'lucky_btn_check',
                        'click': ui.createHandlerFn(function() {
                            const btn = document.getElementById('lucky_btn_check');
                            const st = document.getElementById('lucky_upgrade_status');
                            return upgradeCall('upgrade_check', btn, st);
                        })
                    }, _('Check update')),
                    E('button', {
                        'class': 'cbi-button cbi-button-action',
                        'id': 'lucky_btn_run',
                        'click': ui.createHandlerFn(function() {
                            const btn = document.getElementById('lucky_btn_run');
                            const st = document.getElementById('lucky_upgrade_status');
                            if (!window.confirm(_('Download and upgrade Lucky now? The service will restart automatically.')))
                                return Promise.resolve();
                            return upgradeCall('upgrade_run', btn, st);
                        })
                    }, _('Upgrade now')),
                    E('span', { 'id': 'lucky_upgrade_status', 'style': 'flex:1; min-width:200px;' },
                        E('em', {}, _('Click "Check update" to query the latest version.'))
                    )
                ])
            ]);
        };

        s = m.section(form.NamedSection, 'lucky', 'lucky');

        o = s.option(form.Flag, 'enabled', _('Enable'));
        o.default = o.disabled;
        o.rmempty = false;

        o = s.option(form.Value, 'port', _('Set the Lucky access port'));
        o.default = '16601';
        o.rmempty = false;
        o.datatype = 'port';
        o.validate = function(section_id, value) {
            if (value < 1 || value > 65535) {
                return _('Port must be between 1 and 65535');
            }
            return true;
        };

        o = s.option(form.Value, 'safe', _('Safe entrance'),_('Set an installation access path, eg:sirpdboy'));
        o.default = '';
        o.datatype = 'string';

        o = s.option(form.Flag, 'ssl', _('Enable SSL'),_('Encrypt access using HTTPS'));
        o.default = '0';
        o.rmempty = false;

        o = s.option(form.Value, 'delay', _('Delayed Start (seconds)'));
        o.default = '60';

	o = s.option(form.Button, '_newpassword', _('ResetUser'),
			_('Reset account and password to initial values'));
	o.inputtitle = _('ResetUser');
	o.inputstyle = 'apply';
	o.onclick = L.bind(this.handleResetUser, this, data);

        return m.render();
    }
});
