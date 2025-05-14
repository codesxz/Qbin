/**
 * QBin PWA 处理程序
 */
(function() {
    // 定义PWA版本号
    const PWA_VERSION = 'v1.74';

    // 初始化全局变量
    window.QBinPWA = {
        isSupported: 'serviceWorker' in navigator,
        isHTTPS: location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1',
        registration: null,
        offlineReady: false,
        updateAvailable: false,
    };
    
    window.QBinPWA.hasIndexedDB = 'indexedDB' in window;
    window.QBinPWA.hasCacheAPI = 'caches' in window;
    window.QBinPWA.lastVersion = PWA_VERSION;

    // 注册Service Worker
    function registerServiceWorker() {
        if (window.QBinPWA.isSupported && window.QBinPWA.isHTTPS) {
            window.addEventListener('load', () => {
                // 确定service worker URL，传递版本号作为查询参数
                const swUrl = `/service-worker.js?v=${PWA_VERSION}`;
                
                console.log('注册Service Worker，版本:', PWA_VERSION);
                
                navigator.serviceWorker.register(swUrl, { scope: "/" })
                    .then(registration => {
                        window.QBinPWA.registration = registration;
                        console.log('Service Worker 注册成功:', registration.scope);
                        
                        // 监听控制台状态变化
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            console.log('发现Service Worker更新');
                            
                            // 监听新worker的状态变化
                            newWorker.addEventListener('statechange', () => {
                                console.log('Service Worker状态变化:', newWorker.state);
                                
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // 新版本已安装但还在等待激活
                                    console.log('新版本Service Worker已准备好，等待激活');
                                    window.QBinPWA.updateAvailable = true;
                                    showUpdateNotification();
                                } else if (newWorker.state === 'activated') {
                                    window.QBinPWA.offlineReady = true;
                                    window.QBinPWA.updateAvailable = false;
                                    hideUpdateNotification();
                                    console.log('离线模式已就绪');
                                }
                            });
                        });
                        
                        // 如果已经有激活的Service Worker
                        if (registration.active) {
                            window.QBinPWA.offlineReady = true;
                        }
                    })
                    .catch(error => {
                        console.warn('Service Worker 注册失败:', error);
                    });
                
                // 添加用于接收跨worker通信的监听器
                navigator.serviceWorker.addEventListener('message', event => {
                    if (event.data && event.data.type === 'SW_ACTIVATED') {
                        console.log('收到Service Worker激活消息，版本:', event.data.version);
                        
                        if (event.data.version !== window.QBinPWA.lastVersion) {
                            window.QBinPWA.lastVersion = event.data.version;
                            console.log('已更新到新版本:', event.data.version);
                        }
                        
                        window.QBinPWA.offlineReady = true;
                        window.QBinPWA.updateAvailable = false;
                        hideUpdateNotification();
                    } else if (event.data && event.data.type === 'SW_VERSION') {
                        // 收到Service Worker的版本信息
                        console.log('当前Service Worker版本:', event.data.version);
                        
                        // 检查版本是否变化
                        if (window.QBinPWA.lastVersion && 
                            window.QBinPWA.lastVersion !== event.data.version) {
                            console.log('检测到版本变更，旧版本:', window.QBinPWA.lastVersion, '新版本:', event.data.version);
                            // 版本变化时自动刷新以应用新版本
                            window.location.reload();
                        }
                    } else if (event.data && event.data.type === 'SW_UPDATED_REFRESH_NEEDED') {
                        // 收到需要刷新的消息
                        console.log('收到Service Worker更新通知，版本:', event.data.version);
                        
                        // 检查版本号是否真的不同
                        if (window.QBinPWA.lastVersion === event.data.version) {
                            console.log('当前已是最新版本，忽略更新通知');
                            return;
                        }
                        
                        window.QBinPWA.lastVersion = event.data.version;
                        
                        // 显示更新通知
                        const refreshNotification = '发现新版本，即将刷新...';
                        showUpdateNotificationWithMessage(refreshNotification);
                        
                        // 延迟刷新
                        setTimeout(() => {
                            window.location.reload();
                        }, 3000);
                    }
                });
                
                // 添加用于处理控制器变化的监听器
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    console.log('Service Worker控制器已变更');
                });
            });
            
            // 添加离线/在线状态检测
            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);
            updateOnlineStatus();
        }
    }
    
    // 显示更新通知
    function showUpdateNotification() {
        showUpdateNotificationWithMessage('新版本可用，点击刷新');
    }
    
    // 带自定义消息的更新通知
    function showUpdateNotificationWithMessage(message) {
        // 检查是否已存在通知
        let notification = document.getElementById('update-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'update-notification';
            notification.style.position = 'fixed';
            notification.style.bottom = '70px';
            notification.style.right = '20px';
            notification.style.padding = '10px 15px';
            notification.style.backgroundColor = '#4CAF50';
            notification.style.color = '#fff';
            notification.style.borderRadius = '4px';
            notification.style.zIndex = '9999';
            notification.style.fontSize = '14px';
            notification.style.transition = 'opacity 0.3s ease';
            notification.style.display = 'flex';
            notification.style.alignItems = 'center';
            notification.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
            
            const messageElement = document.createElement('span');
            messageElement.textContent = message;
            notification.appendChild(messageElement);
            
            const button = document.createElement('button');
            button.textContent = '更新';
            button.style.marginLeft = '10px';
            button.style.padding = '5px 10px';
            button.style.border = 'none';
            button.style.borderRadius = '3px';
            button.style.backgroundColor = '#fff';
            button.style.color = '#4CAF50';
            button.style.cursor = 'pointer';
            
            button.addEventListener('click', () => {
                // 强制应用更新并刷新页面
                forceServiceWorkerUpdate();
            });
            
            notification.appendChild(button);
            document.body.appendChild(notification);
        } else {
            // 更新已存在通知的消息
            const messageElement = notification.querySelector('span');
            if (messageElement) {
                messageElement.textContent = message;
            }
        }
        
        notification.style.opacity = '1';
    }
    
    // 隐藏更新通知
    function hideUpdateNotification() {
        const notification = document.getElementById('update-notification');
        if (notification) {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }
    
    // 强制Service Worker更新
    function forceServiceWorkerUpdate() {
        if (window.QBinPWA.registration && window.QBinPWA.registration.waiting) {
            console.log('正在强制激活新Service Worker...');
            // 发送消息给等待中的Service Worker，告诉它立即接管
            window.QBinPWA.registration.waiting.postMessage({type: 'SKIP_WAITING'});
            
            // 等待控制器变化完成后刷新页面
            let refreshed = false;
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (!refreshed) {
                    refreshed = true;
                    console.log('新Service Worker已激活，正在刷新页面');
                    window.location.reload();
                }
            });
        } else {
            // 如果没有等待的Service Worker，直接刷新
            window.location.reload();
        }
    }
    
    // 更新在线/离线状态
    function updateOnlineStatus() {
        const isOnline = navigator.onLine;
        window.QBinPWA.isOnline = isOnline;
        
        // 如果需要，可以在这里添加UI提示
        if (!isOnline && window.QBinPWA.offlineReady) {
            console.log('当前处于离线模式，但离线缓存可用');
            showOfflineNotification(true);
        } else if (!isOnline) {
            console.log('当前处于离线模式，离线缓存尚未就绪');
            showOfflineNotification(false);
        } else {
            hideOfflineNotification();
        }
    }
    
    // 显示离线通知
    function showOfflineNotification(cacheAvailable) {
        // 检查是否已存在通知
        let notification = document.getElementById('offline-notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'offline-notification';
            notification.style.position = 'fixed';
            notification.style.bottom = '20px';
            notification.style.right = '20px';
            notification.style.padding = '10px 15px';
            notification.style.borderRadius = '4px';
            notification.style.zIndex = '9999';
            notification.style.fontSize = '14px';
            notification.style.transition = 'opacity 0.3s ease';
            document.body.appendChild(notification);
        }
        
        notification.style.backgroundColor = cacheAvailable ? '#4a6cf7' : '#f44336';
        notification.style.color = '#fff';
        notification.textContent = cacheAvailable 
            ? '您当前处于离线模式，但可以访问缓存内容' 
            : '您当前处于离线模式，部分功能可能不可用';
        notification.style.opacity = '1';
    }
    
    // 隐藏离线通知
    function hideOfflineNotification() {
        const notification = document.getElementById('offline-notification');
        if (notification) {
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }
    }
    
    // 启动注册过程
    registerServiceWorker();
})();
