// ==UserScript==
// @name         buff市场饰品详细页面显示价格比率
// @namespace    http://tampermonkey.net/
// @version      0.5
// @description  buff市场饰品详细页面显示价格比率
// @author       Ultronxr
// @match        https://buff.163.com/*
// @icon         data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgBAMAAACBVGfHAAAAFVBMVEVHcEwhIS0hISshISshISv///+QkJU/x7PBAAAABHRSTlMAJK7xdunbSwAAAFxJREFUeAFjYFR2QQJGAgzCLijAkEEFVcCJwQRVwJnBBQ2QKxAKBXgEwIpTw1AF3EJTEAJQBQgBhAKEQCqaoW5YbHGhuYAbqufCXFJRBVIoC1OMiMKISozIxkgOAEjZind3Npg5AAAAAElFTkSuQmCC
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @require      https://code.jquery.com/jquery-3.6.1.min.js
// ==/UserScript==
/*
饰品详细信息实际上是请求接口获取的，例如 https://buff.163.com/api/market/goods/sell_order?game=csgo&goods_id=835457&page_num=1&sort_by=default&mode=&allow_tradable_cooldown=1&_=1632289975917
这里我使用解析网页HTML内容实现功能。
*/

(function() {
    'use strict';

    // 请求权限，用于发送浏览器桌面通知API
    var NOTIFICATION_STATUS = false; // "default" | "denied"
    Notification.requestPermission(function (status) {
        if (status === "granted") {
            NOTIFICATION_STATUS = true;
        }
    });

    // 所有菜单选项汇总表，格式为：[选项名称（存储变量名称）；初始选项值名称；备选选项值名称；选项默认值]
    var MENU_ALL = [
        ['menu_auto_close_high_rate_window', '自动关闭过高价格比率的商品窗口：❌已禁用（点击启用）', '自动关闭过高价格比率的商品窗口：✅已启用（点击禁用）', false],
        ['menu_set_auto_close_high_rate', '设置自动关闭窗口的过高价格比率，建议 0.8，当前：', , 0.8],
        ['menu_auto_close_exclude', '当前窗口自动关闭：✅启用（点击禁用）', '当前窗口自动关闭：❌禁用（点击启用）', []],
        ['menu_price_monitor', '当前窗口价格监听：❌禁用（点击启用）', '当前窗口价格监听：✅启用 - ￥', {}],
    ];
    // 所有菜单命令ID汇总表，下标与MENU_ALL相同，例如：注册了 MENU_ALL[0] 命令，该命令id存储在 MENU_ID[0]
    var MENU_CMD_ID = [];

    // 如果选项值在“存储”中没有，则为其设置选项默认值
    for(let i = 0; i < MENU_ALL.length; ++i) {
        if(GM_getValue(MENU_ALL[i][0]) == null) {
            GM_setValue(MENU_ALL[i][0], MENU_ALL[i][3]);
        }
    }
    // 取消注册所有命令
    if(MENU_CMD_ID.length > 0) {
        for(let i = 0; i < MENU_CMD_ID.length; ++i) {
            GM_unregisterMenuCommand(MENU_CMD_ID[i]);
        }
        MENU_CMD_ID = [];
    }




    // 设置是否自动关闭价格比率过高的商品窗口，避免多余的人工操作
    var auto_close_high_rate_window = GM_getValue(MENU_ALL[0][0]);
    if(auto_close_high_rate_window === false) {
        // 如果当前是“已禁用”状态，那么注册启用命令
        reg_auto_close('enable');
    } else {
        // 如果当前是“已启用”状态，那么注册禁用命令
        reg_auto_close('disable');
    }

    function reg_auto_close(type) {
         switch(type) {
            case 'enable':
                // 注册启用命令：选项显示的是“已禁用”，点击的效果是改变auto_close状态为true
                MENU_CMD_ID[0] = GM_registerMenuCommand(`${MENU_ALL[0][1]}`, function(){change_auto_close_state('enable');});
                break;
            case 'disable':
                // 注册禁用命令：选项显示的是“已启用”，点击的效果是改变auto_close状态为false
                MENU_CMD_ID[0] = GM_registerMenuCommand(`${MENU_ALL[0][2]}`, function(){change_auto_close_state('disable');});
                break;
        }
    }

    function change_auto_close_state(type) {
        // 先取消注册原先的命令
        GM_unregisterMenuCommand(MENU_CMD_ID[0]);

        switch(type) {
            case 'enable':
                // 把当前状态赋true，并注册禁用命令
                auto_close_high_rate_window = true;
                GM_setValue(MENU_ALL[0][0], true);
                reg_auto_close('disable');
                break;
            case 'disable':
                // 把当前状态赋false，并注册启用命令
                auto_close_high_rate_window = false;
                GM_setValue(MENU_ALL[0][0], false);
                reg_auto_close('enable');
                break;
        }
        window.location.reload();
    };

    // 注册设置价格比率过高线的菜单命令
    MENU_CMD_ID[1] = GM_registerMenuCommand(`${MENU_ALL[1][1]+GM_getValue(MENU_ALL[1][0])}`, function(){
        let temp_high_rate = prompt('输入价格比率过高线（0.0 ≤ 比率 ≤ 1.0）');
        if(temp_high_rate != null) {
            if(/^\d+(\.\d+)?$/.test(temp_high_rate) && temp_high_rate >= 0.0 && temp_high_rate <= 1.0) {
                GM_setValue(MENU_ALL[1][0], parseFloat(temp_high_rate));
                window.location.reload();
            } else {
                alert('输入内容格式错误，请重新设置！');
            }
        }
    });



    // 价格比率过高线
    const high_rate = GM_getValue(MENU_ALL[1][0]);

    // Steam市场出售价格税率（1.0-税率）
    const steam_sell_tax_rate = 0.86956522;

    // 是商品页面才执行的操作
    if(window.location.href.indexOf('buff.163.com/goods/') > 0) {

        // 正则提取商品编号
        let good_id = /^https:\/\/buff.163.com\/goods\/(\d+)/.exec(window.location.href)[1];
        let auto_close_exclude = GM_getValue(MENU_ALL[2][0]);
        let auto_close_exclude_index = auto_close_exclude.indexOf(good_id);
        if(auto_close_exclude_index != -1){
            // 已经在自动关闭排除列表中
            MENU_CMD_ID[2] = GM_registerMenuCommand(`${MENU_ALL[2][2]}`, function(){
                GM_unregisterMenuCommand(MENU_CMD_ID[2]);
                auto_close_exclude.splice(auto_close_exclude_index, 1);
                GM_setValue(MENU_ALL[2][0], auto_close_exclude);
                window.location.reload();
            });
        } else {
            // 不在自动关闭排除列表中
            MENU_CMD_ID[2] = GM_registerMenuCommand(`${MENU_ALL[2][1]}`, function(){
                GM_unregisterMenuCommand(MENU_CMD_ID[2]);
                auto_close_exclude.push(good_id);
                GM_setValue(MENU_ALL[2][0], auto_close_exclude);
                window.location.reload();
            });
        }


        // 进行价格比率计算
        let good_name = $(".detail-cont").find($("h1")).text();
        let sell_price = 0.0, buy_price = 0.0, rate = 0.0;
        window.set_rate = function(){
            // 如果请求接口还没结束，列表未加载完成
            if ($(".detail-tab-cont .list_tb .list_tb_csgo").length == 0) {
                setTimeout(set_rate, 300);
                return;
            }
            sell_price = parseFloat($('.detail-summ .f_Strong').text().split(' ')[1].split('(')[0]);
            buy_price = parseFloat($($('.list_tb_csgo tr')[1]).find($('.f_Strong')).text().split(' ')[1]);
            rate = buy_price / (sell_price * steam_sell_tax_rate);
            $('.detail-summ .f_Strong').append("&nbsp;&nbsp;&nbsp;<span style='color:#00ffff;'>" + rate + "</span>&nbsp;&nbsp;&nbsp;");
            if(auto_close_high_rate_window === true && rate >= high_rate && auto_close_exclude_index == -1){
                //alert('auto_close_high_rate_window='+auto_close_high_rate_window);
                window.close();
            }
        };
        set_rate();


        let price_monitor = GM_getValue(MENU_ALL[3][0]);
        let interval_price_monitor = -1;
        if(price_monitor[good_id] == undefined) {
            // 未对当前商品设置价格监听
            MENU_CMD_ID[3] = GM_registerMenuCommand(`${MENU_ALL[3][1]}`, function(){
                GM_unregisterMenuCommand(MENU_CMD_ID[3]);
                let temp_price = prompt('输入价格监听线（价格低于或等于监听线时会提醒）');
                if(/^\d+(\.\d+)?$/.test(temp_price) && temp_price >= 0.0 && temp_price <= 10000.0) {
                    price_monitor[good_id] = parseFloat(temp_price);
                    GM_setValue(MENU_ALL[3][0], price_monitor);
                    window.location.reload();
                } else {
                    alert('输入内容格式错误，请重新输入！');
                }
            });
            clearInterval(interval_price_monitor);
        } else {
            // 对当前商品设置了价格监听
            MENU_CMD_ID[3] = GM_registerMenuCommand(`${MENU_ALL[3][2]+price_monitor[good_id]+' （点击禁用）'}`, function(){
                GM_unregisterMenuCommand(MENU_CMD_ID[3]);
                delete price_monitor[good_id];
                GM_setValue(MENU_ALL[3][0], price_monitor);
                window.location.reload();
            });
            // 设置定时器监听最上面的商品价格
            interval_price_monitor = self.setInterval(function() {
                window.location.reload();
                console.log('价格监听：商品名：'+good_name+'  商品编号good_id='+good_id+'  价格监听线price_monitor[good_id]=￥'+price_monitor[good_id]+'  当前最低价格buy_price=￥'+buy_price);
                if(buy_price <= price_monitor[good_id]) {
                    // 优先使用浏览器桌面通知API，无授权才使用alert
                    if(NOTIFICATION_STATUS === true) {
                        let good_img = $(".detail-pic .t_Center img")[0].src,
                            good_url = 'https://buff.163.com/goods/'+good_id;
                        let nt = new Notification('网易BUFF市场：价格低，可入手！',{
                            body: '\n商品名='+good_name+'\n价格监听线=￥'+price_monitor[good_id]+'\n当前最低价格=￥'+buy_price,
                            tag: 'buff',
                            icon: good_img,
                            requireInteraction: false,
                            data: {
                                good_url: good_url
                            },
                        });
                        // 注：这个onclick是不能正常工作的，因为发送通知之后原网页被刷新了，这个通知对象不存在了
                        nt.onclick = function(){ window.open(nt.data.good_url, '_blank'); nt.close(); };
                    } else {
                        alert('价格低，可入手！');
                    }
                }
            }, 1000*60*3);
        }

    }

})();