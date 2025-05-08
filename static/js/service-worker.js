/**
 * QBin Progressive Web App - Service Worker
 * 支持HTTP/HTTPS协议和降级方案
 */

// 缓存配置
const CACHE_VERSION = 'v1.62';
const STATIC_CACHE_NAME = `qbin-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `qbin-dynamic-${CACHE_VERSION}`;
const CDN_CACHE_NAME = `qbin-cdn-${CACHE_VERSION}`;
const DEBUG = false;

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
    '/document',
    '/static/',
    '/p/',
    '/home',
    '/pwa-loader',
];

// CDN资源
const CDN_RESOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/',
    'https://cdn.jsdelivr.net/npm/cherry-markdown@0.9.1/dist/',
    'https://cdn.jsdelivr.net/npm/katex@0.12.0/dist/',
    'https://cdn.jsdelivr.net/npm/echarts@4.6.0/dist/',
    'https://cdn.jsdelivr.net/npm/mermaid@8.11.1/dist/',
    'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js',
    'https://notion-avatar.app/api/svg/',
];

// 页面模板
const PAGE_TEMPLATES = [
    '/e',
    '/c',
    '/m',
];

// 实时数据 - 采用网络优先策略
const REALTIME_PATHS = [];

/**
 * 安装事件处理 - 初始化缓存并预缓存关键资源
 */
self.addEventListener('install', event => {
    log('安装事件触发');

    // 根据上下文选择缓存策略
    const cachingStrategy = isSecureContext ? fullCachingStrategy : limitedCachingStrategy;

    event.waitUntil(
        cachingStrategy()
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
 * 有限缓存策略 - 用于HTTP环境
 */
async function limitedCachingStrategy() {
    try {
        const staticCache = await caches.open(STATIC_CACHE_NAME);
        const criticalResources = [
            '/favicon.ico',
            '/static/css/panel-common.css',
            '/static/js/utils.js'
        ];

        await Promise.all([
            staticCache.addAll(criticalResources).catch(err => warn('关键资源缓存失败:', err)),
            caches.open(DYNAMIC_CACHE_NAME)
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

    // 非安全上下文(HTTP)环境下的处理
    if (!isSecureContext) {
        if (isStaticResource(request.url) && url.origin === self.location.origin) {
            event.respondWith(limitedCacheStrategy(request));
        }
        return;
    }

    // 安全上下文(HTTPS)环境下的处理
    try {
        // CDN或跨域资源处理
        if (isCdnResource(request.url) || url.origin !== self.location.origin) {
            event.respondWith(cacheFirstStrategy(request));
            return;
        }

        const path = url.pathname;

        // 处理根路径和模板路径
        if (path === '/' || path.match(/^\/[cme](\/.*)?$/)) {
            event.respondWith(handleTemplateRoutes(request));
            return;
        }

        // 基于资源类型应用不同的缓存策略
        if (isStaticResource(request.url) || isPageTemplate(request.url)) {
            event.respondWith(cacheFirstStrategy(request));
        }
    } catch (err) {
        error('缓存策略处理错误:', err);
    }
});

/**
 * 有限缓存策略 - 用于HTTP环境
 */
async function limitedCacheStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;

        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200) {
            const criticalResources = [
                '/favicon.ico',
                '/static/css/panel-common.css',
                '/static/js/utils.js'
            ];

            const url = new URL(request.url);
            if (criticalResources.some(path => url.pathname === path)) {
                const cache = await caches.open(STATIC_CACHE_NAME);
                cache.put(request, networkResponse.clone());
            }
        }
        return networkResponse;
    } catch (err) {
        warn('HTTP环境下缓存处理失败:', err);
        return new Response('Network error occurred', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

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
 */
async function cacheFirstStrategy(request) {
    if (DEBUG) log(`缓存优先策略: 处理请求 - ${request.url}`);

    const cache = await caches.open(STATIC_CACHE_NAME);
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
 */
async function networkFirstStrategy(request) {
    const cache = await caches.open(DYNAMIC_CACHE_NAME);
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
 */
async function StaleWhileRevalidate(request) {
    const cdnRequest = new Request(request.url, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-cache'
    });

    const cache = await caches.open(CDN_CACHE_NAME);
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
        return await cacheFirstStrategy(templateRequest);
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
            'https://cdn.jsdelivr.net/npm/cherry-markdown@0.9.1/dist/cherry-markdown.core.js',
            'https://cdn.jsdelivr.net/npm/cherry-markdown@0.9.1/dist/cherry-markdown.min.css',
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
function isStaticResource(url) {
    const path = new URL(url).pathname;
    return STATIC_RESOURCES.some(staticPath => path.startsWith(staticPath));
}

function isPageTemplate(url) {
    const path = new URL(url).pathname;
    return PAGE_TEMPLATES.some(templatePath => path === templatePath) ||
           path.match(/^\/[cme](\/.*)?$/);
}

function isRealtimeResource(url) {
    const path = new URL(url).pathname;
    return REALTIME_PATHS.some(realtimePath => path.startsWith(realtimePath));
}

function isCdnResource(url) {
    return CDN_RESOURCES.some(cdnPath => url.startsWith(cdnPath));
}

/**
 * 激活事件处理 - 清理旧缓存并检查过期资源
 */
self.addEventListener('activate', event => {
    log('激活事件触发');

    event.waitUntil(
        Promise.all([
            cleanupOldCaches(),
            cleanupExpiredResources()
        ])
        .then(() => {
            log('缓存清理完成');
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
 * 清理旧版本缓存
 */
async function cleanupOldCaches() {
    try {
        const cacheNames = await caches.keys();
        const deletionPromises = cacheNames
            .filter(cacheName =>
                cacheName !== STATIC_CACHE_NAME &&
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CDN_CACHE_NAME &&
                cacheName.includes('qbin-')
            )
            .map(cacheName => {
                log('删除旧缓存:', cacheName);
                return caches.delete(cacheName);
            });

        return Promise.all(deletionPromises);
    } catch (err) {
        warn('清理旧缓存失败:', err);
        return Promise.resolve();
    }
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
