/**
 * QBin Progressive Web App - Service Worker
 */

// 缓存配置 - 从URL获取版本号
const CACHE_VERSION = self.location.search.includes('v=') 
    ? self.location.search.match(/v=([^&]*)/)[1] 
    : 'v1.0';

const CACHE_MAJOR = extractMajorVersion(CACHE_VERSION);
const STATIC_CACHE_NAME = `qbin-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `qbin-dynamic-${CACHE_VERSION}`;
// CDN缓存仅使用主版本号
const CDN_CACHE_NAME = `qbin-cdn-v${CACHE_MAJOR}`;
const DEBUG = false;
const AUTO_UPDATE = true; // 自动更新开关，允许无需用户交互自动更新

// 日志函数
const log = DEBUG ? console.log.bind(console, '[SW]') : () => {};
const warn = console.warn.bind(console, '[SW]');
const error = console.error.bind(console, '[SW]');

// 缓存过期时间配置
const CACHE_EXPIRATION = {
    static: 30 * 24 * 60 * 60 * 1000, // 30天
    dynamic: 7 * 24 * 60 * 60 * 1000, // 7天
    cdn: 90 * 24 * 60 * 60 * 1000     // 90天
};

const isSecureContext = self.location.protocol === 'https:' ||
                        self.location.hostname === 'localhost' ||
                        self.location.hostname === '127.0.0.1';

// 静态资源
const STATIC_RESOURCES = [
    '/favicon.ico',
    '/manifest.json',
    '/pwa-loader',
    '/home',
    '/document',
];

// CDN资源
const CDN_RESOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/',
    'https://cdn.jsdelivr.net/npm/cherry-markdown@0.8.58/dist/',
    'https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/',
    'https://cdn.jsdelivr.net/npm/echarts@4.6.0/dist/',
    'https://cdn.jsdelivr.net/npm/mermaid@10.3.1/dist/',
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
    'https://notion-avatar.app/api/svg/',
];

// 页面模板
const PAGE_TEMPLATES = [
    '/e',
    '/c',
    '/m',
    '/p',
];

// 实时数据 - 采用网络优先策略
const REALTIME_PATHS = [
    '/r/'
];

/**
 * 安装事件处理 - 初始化缓存并预缓存关键资源
 */
self.addEventListener('install', event => {
    log('安装事件触发');

    // 如果开启了自动更新模式，就跳过等待阶段直接激活
    if (AUTO_UPDATE) {
        self.skipWaiting();
    }

    event.waitUntil(
        fullCachingStrategy()
            .then(() => {
                log('缓存初始化完成');
                return self.skipWaiting(); // 立即激活新的 service worker
            })
            .catch(err => {
                error('缓存初始化失败:', err);
                return self.skipWaiting();
            })
    );
});

/**
 * 完整缓存策略 - 用于HTTPS环境
 */
async function fullCachingStrategy() {
    try {
        const staticCache = await caches.open(STATIC_CACHE_NAME);
        const fetchAndCacheResources = async (resources) => {
            return Promise.all(resources.map(async (resource) => {
                try {
                    const response = await fetch(resource);
                    if (response.status === 200) {
                        return staticCache.put(resource, response);
                    } else {
                        return Promise.resolve();
                    }
                } catch (err) {
                    warn(`资源缓存失败: ${resource}`, err);
                    return Promise.resolve();
                }
            }));
        };
        await Promise.all([
            fetchAndCacheResources(STATIC_RESOURCES),
            fetchAndCacheResources(PAGE_TEMPLATES),
            caches.open(DYNAMIC_CACHE_NAME),
            caches.open(CDN_CACHE_NAME),
            preCacheCriticalCdnResources()
        ]);
        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
}

/**
 * 请求拦截处理
 */
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);

    // 仅处理GET请求
    if (request.method !== 'GET') return;

    // 跳过敏感资源和授权请求
    if (['.pem', '.key', '.cert'].some(ext => url.pathname.includes(ext))) return;
    if (['token=', 'auth=', 'key='].some(param => url.search.includes(param))) return;

    // 安全上下文(HTTPS)环境下的处理
    try {
        // CDN或跨域资源处理
        if (isCdnResource(request.url) || url.origin !== self.location.origin) {
            event.respondWith(StaleWhileRevalidate(request, CDN_CACHE_NAME));
            return;
        }

        const path = url.pathname;

        // 处理根路径和模板路径
        if (path === '/' || isPageTemplate(path)) {
            event.respondWith(handleTemplateRoutes(request));
            return;
        }

        // 基于资源类型应用不同的缓存策略
        if (isStaticResource(path)) {
            event.respondWith(cacheFirstStrategy(request, STATIC_CACHE_NAME));
        }
        //  else if (isRealtimeResource(path)) {
        //     event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE_NAME));
        // } else {
        //     // 默认使用网络优先策略
        //     event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE_NAME));
        // }
    } catch (err) {
        error('缓存策略处理错误:', err);
    }
});

/**
 * 验证并更新缓存 - 统一处理本地资源和CDN资源
 */
async function validateAndUpdateCache(request, cachedResponse, cache, options = {}) {
    const isCdn = options.isCdn || false;
    const resourceType = options.type || '资源';

    try {
        const headers = new Headers();

        if (!isCdn && request.headers) {
            request.headers.forEach((value, key) => {
                headers.set(key, value);
            });
        }

        if (isCdn) {
            headers.set('Accept', '*/*');
            headers.set('Origin', self.location.origin);
        }

        const etag = cachedResponse.headers.get('etag') ||
                     cachedResponse.headers.get('ETag') ||
                     cachedResponse.headers.get('Etag');

        if (etag) {
            headers.set('If-None-Match', etag);
            if (DEBUG) log(`添加条件验证头If-None-Match: ${etag} - ${request.url}`);
        } else {
            const lastModified = cachedResponse.headers.get('last-modified') ||
                                 cachedResponse.headers.get('Last-Modified');
            if (lastModified) {
                headers.set('If-Modified-Since', lastModified);
                if (DEBUG) log(`添加条件验证头If-Modified-Since: ${lastModified} - ${request.url}`);
            }
        }

        const conditionalRequest = new Request(request.url, {
            method: 'GET',
            headers: headers,
            mode: isCdn ? 'cors' : request.mode,
            credentials: isCdn ? 'omit' : request.credentials,
            cache: 'no-cache',
            redirect: request.redirect || 'follow',
            referrer: request.referrer
        });

        const response = await fetch(conditionalRequest);

        if (response.status === 304) {
            // 资源未变化，不需要更新
            if (DEBUG) log(`${resourceType}未变化: ${request.url}`);
        } else if (response.ok) {
            // 资源已更新，更新缓存
            if (DEBUG) log(`更新${resourceType}缓存: ${request.url}`);
            await cache.put(request, response);
        }

        return response;
    } catch (err) {
        if (DEBUG) warn(`${resourceType}缓存验证出错: ${request.url}`, err);
        return null;
    }
}

/**
 * 缓存优先策略 - 适用于静态资源和页面模板
 * @param {Request} request 请求对象
 * @param {string} cacheName 要使用的缓存名称
 * @returns {Promise<Response>} 响应对象
 */
async function cacheFirstStrategy(request, cacheName = STATIC_CACHE_NAME) {
    if (DEBUG) log(`缓存优先策略: 处理请求 - ${request.url} (使用缓存: ${cacheName})`);

    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
        if (DEBUG) log(`缓存优先: 返回缓存 - ${request.url}`);
        return cachedResponse;
    }

    try {
        // 从网络获取
        if (DEBUG) log(`缓存优先: 从网络获取 - ${request.url}`);
        const response = await fetch(request);

        if (response.ok) {
            const clonedResponse = response.clone();
            await cache.put(request, clonedResponse);
        }

        return response;
    } catch (err) {
        if (DEBUG) warn(`网络请求失败: ${request.url}`, err);

        // 再次检查缓存
        const recheck = await cache.match(request);
        if (recheck) return recheck;

        error(`完全无法获取资源: ${request.url}`);
        return new Response('无法加载资源', {
            status: 503,
            headers: {'Content-Type': 'text/plain; charset=UTF-8'}
        });
    }
}

/**
 * 网络优先策略 - 适用于实时数据
 * @param {Request} request 请求对象
 * @param {string} cacheName 要使用的缓存名称
 * @returns {Promise<Response>} 响应对象
 */
async function networkFirstStrategy(request, cacheName = DYNAMIC_CACHE_NAME) {
    if (DEBUG) log(`网络优先策略: 处理请求 - ${request.url} (使用缓存: ${cacheName})`);

    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    try {
        let networkRequest = request.clone();

        if (cachedResponse) {
            const headers = new Headers(request.headers);
            const etag = cachedResponse.headers.get('etag') ||
                         cachedResponse.headers.get('ETag') ||
                         cachedResponse.headers.get('Etag');

            if (etag) {
                headers.set('If-None-Match', etag);
            }

            const lastModified = cachedResponse.headers.get('last-modified') ||
                                cachedResponse.headers.get('Last-Modified');
            if (lastModified) {
                headers.set('If-Modified-Since', lastModified);
            }

            networkRequest = new Request(request.url, {
                method: request.method,
                headers: headers,
                mode: request.mode,
                credentials: request.credentials,
                cache: 'no-cache', // 防止浏览器缓存干扰
                redirect: request.redirect,
                referrer: request.referrer
            });
        }

        const response = await fetch(networkRequest);
        if (response.status === 304 && cachedResponse) {
            return cachedResponse;
        } else if (response.ok) {
            const responseToCache = response.clone();
            const headers = new Headers(responseToCache.headers);
            if (!headers.has('date')) headers.set('date', new Date().toUTCString());
            const enhancedResponse = new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
            });
            cache.put(request, enhancedResponse);
            return response;
        } else if (response.status >= 500 && cachedResponse) {
            return cachedResponse;
        }
        return response;
    } catch (err) {
        warn(`网络请求失败: ${request.url}`, err);
        if (cachedResponse) return cachedResponse;

        return new Response('无法获取资源', {
            status: 503,
            headers: {'Content-Type': 'text/plain; charset=UTF-8'}
        });
    }
}

/**
 * 先缓存后网络策略
 * @param {Request} request 请求对象
 * @param {string} cacheName 要使用的缓存名称
 * @returns {Promise<Response>} 响应对象
 */
async function StaleWhileRevalidate(request, cacheName = CDN_CACHE_NAME) {
    if (DEBUG) log(`先缓存后网络策略: 处理请求 - ${request.url} (使用缓存: ${cacheName})`);

    const cdnRequest = new Request(request.url, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache'
    });

    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(cdnRequest);

    const backgroundUpdate = (async () => {
        try {
            if (cachedResponse) {
                await validateAndUpdateCache(cdnRequest, cachedResponse, cache, {
                    isCdn: true,
                    type: 'CDN资源'
                });
            } else {
                const networkResponse = await fetch(cdnRequest);
                if (networkResponse && networkResponse.ok) {
                    const headers = new Headers(networkResponse.headers);
                    if (!headers.has('date')) headers.set('date', new Date().toUTCString());
                    const enhancedResponse = new Response(networkResponse.clone().body, {
                        status: networkResponse.status,
                        statusText: networkResponse.statusText,
                        headers: headers
                    });

                    await cache.put(cdnRequest, enhancedResponse);
                }
            }
        } catch (err) {
            warn(`CDN资源后台更新失败: ${cdnRequest.url}`, err);
        }
    })();

    if (cachedResponse) {
        backgroundUpdate.catch(err => warn(`CDN后台更新错误: ${cdnRequest.url}`, err));
        return cachedResponse;
    }

    try {
        const networkResponse = await fetch(cdnRequest);
        await backgroundUpdate;

        if (networkResponse.ok) {
            return networkResponse;
        } else {
            return new Response('CDN资源加载失败', {
                status: networkResponse.status,
                headers: {'Content-Type': 'text/plain; charset=UTF-8'}
            });
        }
    } catch (err) {
        warn(`CDN资源获取失败: ${cdnRequest.url}`, err);

        const recheckCache = await cache.match(cdnRequest);
        if (recheckCache) return recheckCache;

        return new Response('无法加载CDN资源', {
            status: 503,
            headers: {'Content-Type': 'text/plain; charset=UTF-8'}
        });
    }
}

/**
 * 处理页面模板路由 - 处理根路径和模板路径请求
 * @param {Request} request 原始请求对象
 * @returns {Promise<Response>} 处理后的响应
 */
async function handleTemplateRoutes(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    let templatePath, templateUrl;

    try {
        // 确定要使用的模板路径
        if (path === '/') {
            // 根路径 - 从缓存获取首选编辑器类型
            const editorType = await getCache("qbin-editor") || 'm';
            templatePath = ['e', 'c', 'm'].includes(editorType) ? `/${editorType}` : '/m';
            log(`根路径请求使用模板: ${templatePath}`);
        } else {
            // 非根路径 - 取前两个字符作为模板标识
            templatePath = path.substring(0, 2);
        }

        // 构建模板URL并保留原始查询参数
        templateUrl = new URL(templatePath, self.location.origin);
        templateUrl.search = url.search;

        // 创建并发送模板请求
        const requestInit = {
            method: 'GET',
            headers: request.headers,
            credentials: request.credentials,
            redirect: 'follow',
            ...(request.mode !== 'navigate' && { mode: request.mode })
        };

        const templateRequest = new Request(templateUrl.toString(), requestInit);
        return await cacheFirstStrategy(templateRequest, STATIC_CACHE_NAME);
    } catch (err) {
        error(`模板路由处理失败: ${path}`, err);

        // 尝试从缓存中获取备用响应
        if (templateUrl) {
            try {
                const cache = await caches.open(STATIC_CACHE_NAME);
                const fallbackRequest = new Request(templateUrl.toString(), {
                    method: 'GET',
                    headers: request.headers,
                    credentials: request.credentials,
                    redirect: 'follow',
                    ...(request.mode !== 'navigate' && { mode: request.mode })
                });

                const fallback = await cache.match(fallbackRequest);
                if (fallback) return fallback;
            } catch (fallbackErr) {
                error(`备用模板获取失败`, fallbackErr);
            }
        }

        // 最终错误响应
        return new Response('页面加载失败', {
            status: 503,
            headers: {'Content-Type': 'text/plain; charset=UTF-8'}
        });
    }
}

/**
 * 预缓存关键的CDN资源
 */
async function preCacheCriticalCdnResources() {
    try {
        const cdnCache = await caches.open(CDN_CACHE_NAME);
        const criticalCdnResources = [
            'https://cdn.jsdelivr.net/npm/cherry-markdown@0.8.58/dist/cherry-markdown.core.js',
            'https://cdn.jsdelivr.net/npm/cherry-markdown@0.8.58/dist/cherry-markdown.min.css',
            'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/loader.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/editor/editor.main.css',
        ];
        const fetchPromises = criticalCdnResources.map(async url => {
            try {
                const request = new Request(url, { mode: 'cors', credentials: 'omit' });
                const cachedResponse = await cdnCache.match(request);

                if (!cachedResponse) {
                    if (DEBUG) log(`预缓存CDN资源: ${url}`);
                    const response = await fetch(request);
                    if (response && response.ok) {
                        await cdnCache.put(request, response);
                    }
                } else {
                    validateAndUpdateCache(request, cachedResponse, cdnCache, {
                        isCdn: true,
                        type: 'CDN资源'
                    }).catch(err => warn(`CDN缓存验证失败: ${url}`, err));
                }
                return true;
            } catch (err) {
                warn(`预缓存CDN资源失败: ${url}`, err);
                return false;
            }
        });
        await Promise.all(fetchPromises);
        return Promise.resolve();
    } catch (err) {
        warn('预缓存CDN资源过程失败:', err);
        return Promise.resolve();
    }
}

// 资源类型判断函数
function isStaticResource(path) {
    return STATIC_RESOURCES.some(staticPath => path.startsWith(staticPath)) || path.startsWith('/static/');
}

function isPageTemplate(path) {
    return PAGE_TEMPLATES.some(templatePath => path === templatePath) ||
           path.match(/^\/[cmep](\/.*)?$/);
}

function isRealtimeResource(path) {
    return REALTIME_PATHS.some(realtimePath => path.startsWith(realtimePath));
}

function isCdnResource(url) {
    return CDN_RESOURCES.some(cdnPath => url.startsWith(cdnPath));
}

/**
 * 激活事件处理 - 清理旧缓存并检查版本更新
 */
self.addEventListener('activate', event => {
    log('激活事件触发');

    event.waitUntil(
        Promise.all([
            cleanupOldCaches(), // 清理旧缓存并检查是否需要通知更新
            cleanupExpiredResources()
        ])
        .then(() => {
            log('缓存清理与版本检查完成');
            // 立即控制所有客户端，无需刷新
            return self.clients.claim();
        })
        .catch(err => {
            warn('缓存清理过程出错:', err);
            return self.clients.claim();
        })
    );

    // 如果是安全上下文，发送消息通知客户端
    if (isSecureContext) {
        self.clients.matchAll().then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'SW_ACTIVATED',
                    version: CACHE_VERSION
                });
            });
        });
    }
});

/**
 * 根据版本号清理旧版本缓存，同时检查是否需要通知客户端更新
 */
async function cleanupOldCaches() {
    try {
        // 获取当前版本信息
        const currentVersion = CACHE_VERSION;
        const currentMajor = extractMajorVersion(currentVersion);
        const cacheNames = await caches.keys();

        log(`当前版本: ${currentVersion}, 主版本: ${currentMajor}`);

        // 从缓存名称中提取先前版本
        const staticCaches = cacheNames.filter(name => name.startsWith('qbin-static-') && name !== STATIC_CACHE_NAME);
        let previousVersion = null;
        
        if (staticCaches.length > 0) {
            staticCaches.sort();
            const latestOldCache = staticCaches[staticCaches.length - 1];
            previousVersion = latestOldCache.match(/v\d+\.\d+/)?.[0];
            log(`从缓存名称中提取的先前版本: ${previousVersion}`);
        }
        
        const versionChanged = previousVersion && previousVersion !== currentVersion;
        
        if (versionChanged) {
            log(`检测到版本变更: ${previousVersion} -> ${currentVersion}`);
        }

        // 按类型分组缓存
        const dynamicCaches = cacheNames.filter(name => name.startsWith('qbin-dynamic-') && name !== DYNAMIC_CACHE_NAME);
        const cdnCaches = cacheNames.filter(name => name.startsWith('qbin-cdn-') && name !== CDN_CACHE_NAME);
        const otherCaches = cacheNames.filter(name =>
            name.includes('qbin-') &&
            !name.startsWith('qbin-static-') &&
            !name.startsWith('qbin-dynamic-') &&
            !name.startsWith('qbin-cdn-'));

        // 处理删除逻辑
        const deletionPromises = [];

        // 始终删除其他旧的qbin缓存
        otherCaches.forEach(cacheName => {
            log(`删除其他旧缓存: ${cacheName}`);
            deletionPromises.push(caches.delete(cacheName));
        });

        // 处理静态缓存 - 任何版本变化都删除
        staticCaches.forEach(cacheName => {
            log(`删除旧静态缓存: ${cacheName}`);
            deletionPromises.push(caches.delete(cacheName));
        });

        // 处理动态缓存 - 任何版本变化都删除
        dynamicCaches.forEach(cacheName => {
            log(`删除旧动态缓存: ${cacheName}`);
            deletionPromises.push(caches.delete(cacheName));
        });

        // 处理CDN缓存
        cdnCaches.forEach(cacheName => {
            const cacheVersion = extractVersionFromCacheName(cacheName);
            const cacheMajor = extractMajorVersion(cacheVersion);

            if (cacheMajor !== currentMajor) {
                // 主版本不同，直接删除
                log(`删除旧CDN缓存 (主版本不同): ${cacheName}`);
                deletionPromises.push(caches.delete(cacheName));
            }
        });

        // 3. 执行删除操作
        await Promise.all(deletionPromises);
        
        // 4. 如果版本有变化且启用了自动更新，通知客户端需要刷新
        if (versionChanged && AUTO_UPDATE) {
            log('版本已变更，通知客户端刷新');
            await notifyClientsToRefresh();
        }
        
        return Promise.resolve();
    } catch (err) {
        warn('清理旧缓存和版本检查失败:', err);
        return Promise.resolve();
    }
}

/**
 * 从缓存名称中提取版本号
 */
function extractVersionFromCacheName(cacheName) {
    const parts = cacheName.split('-');
    return parts[parts.length - 1]; // 获取最后一部分
}

/**
 * 提取主版本号
 */
function extractMajorVersion(version) {
    return version.replace('v', '').split('.')[0];
}

/**
 * 清理过期资源
 */
async function cleanupExpiredResources() {
    try {
        const now = Date.now();
        await Promise.all([
            cleanupExpiredCacheEntries(STATIC_CACHE_NAME, now - CACHE_EXPIRATION.static),
            cleanupExpiredCacheEntries(DYNAMIC_CACHE_NAME, now - CACHE_EXPIRATION.dynamic),
            cleanupExpiredCacheEntries(CDN_CACHE_NAME, now - CACHE_EXPIRATION.cdn)
        ]);
        return Promise.resolve();
    } catch (err) {
        warn('清理过期资源失败:', err);
        return Promise.resolve();
    }
}

/**
 * 清理指定缓存中的过期条目
 */
async function cleanupExpiredCacheEntries(cacheName, expirationTime) {
    try {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();

        const deletionPromises = requests.map(async request => {
            try {
                const response = await cache.match(request);
                if (!response) return null;

                const dateHeader = response.headers.get('date');
                if (!dateHeader) return null;

                const responseTime = new Date(dateHeader).getTime();
                if (responseTime < expirationTime) {
                    log(`删除过期资源: ${request.url}`);
                    return cache.delete(request);
                }

                return null;
            } catch (err) {
                warn(`处理缓存条目时出错: ${request.url}`, err);
                return null;
            }
        });

        return Promise.all(deletionPromises.filter(Boolean));
    } catch (err) {
        warn(`清理缓存 ${cacheName} 失败:`, err);
        return Promise.resolve();
    }
}

async function getCache(key) {
  try {
    const db = await new Promise(resolve => {
      const req = indexedDB.open('qbin', 2);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('qbin')) {
          db.createObjectStore('qbin', {keyPath: 'key'});
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
    if (!db) return null;
    return await new Promise(resolve => {
      const tx = db.transaction(['qbin'], 'readonly');
      const req = tx.objectStore('qbin').get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * message事件处理 - 用于处理来自页面的消息
 */
self.addEventListener('message', event => {
    const message = event.data;

    if (message && message.type === 'SKIP_WAITING') {
        log('收到跳过等待消息，立即激活');
        self.skipWaiting();
    }
});

/**
 * 通知所有客户端进行刷新
 */
async function notifyClientsToRefresh() {
    try {
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SW_UPDATED_REFRESH_NEEDED',
                version: CACHE_VERSION
            });
        });
        return Promise.resolve();
    } catch (err) {
        warn('通知客户端刷新失败:', err);
        return Promise.resolve();
    }
}

