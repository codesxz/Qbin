class QBinViewer {
    constructor() {
        this.currentPath = parsePath(window.location.pathname);
        this.clickTimeout = null;
        this.CACHE_KEY = 'qbin/';
        this.buttonBar = document.getElementById('buttonBar');
        this.cherryContainer = document.getElementById('qbin-viewer');
        this.isProcessing = false;
        this.debounceTimeouts = new Map();
        this.lastScrollY = 0;
        this.scrollThreshold = 20;
        this.ticking = false;
        this.edit = 'e';
        this.title = '';
        this.currentTheme = this.getThemePreference();
        this.init();
        this.initScrollHandler();
    }

    initScrollHandler() {
        window.addEventListener('scroll', () => {
            if (!this.ticking) {
                window.requestAnimationFrame(() => this.handleScroll());
                this.ticking = true;
            }
        }, { passive: true });
    }

    handleScroll() {
        const currentScrollY = window.scrollY;
        
        // Check scroll direction and position
        if (currentScrollY > this.lastScrollY + this.scrollThreshold) {
            // Scrolling DOWN - hide the header after scrolling a bit
            if (currentScrollY > 80) { // Only hide after scrolling down some content
                this.buttonBar.classList.add('header-hidden');
            }
        } else if (currentScrollY < this.lastScrollY - (this.scrollThreshold/2) || currentScrollY <= 0) {
            // Scrolling UP or at the TOP - show the header
            // We use a smaller threshold for showing to make it more responsive
            this.buttonBar.classList.remove('header-hidden');
        }
        
        this.lastScrollY = currentScrollY <= 0 ? 0 : currentScrollY;
        this.ticking = false;
    }

    getThemePreference() {
        const savedTheme = localStorage.getItem('qbin-theme') || 'system';
        if (savedTheme === 'dark') return 'dark';
        if (savedTheme === 'light') return 'light';
        // System preference:
        return window.matchMedia('(prefers-color-scheme: dark)').matches ?
            'dark' : 'light';
    }

    initViewer(content, contentType) {
        if (window.cherry) {
            window.cherry = null;
        }

        if (contentType.startsWith("text/plain")) {
            const cherryConfig = {
                id: 'qbin-viewer',
                value: content,
                editor: {
                    defaultModel: 'editOnly',
                    keepDocumentScrollAfterInit: false,
                    convertWhenPaste: false, // 粘贴时不转换HTML到Markdown
                    showFullWidthMark: false, // 不高亮全角符号
                    showSuggestList: false, // 不显示联想框
                    codemirror: {
                        autofocus: false, // 不自动聚焦
                        readOnly: true, // 设置为只读
                        mode: 'text/plain',
                        lineNumbers: false, // 不显示行号
                        lineWrapping: true, // 启用自动换行
                        theme: 'default',
                        styleActiveLine: false,
                        matchBrackets: false,
                    },

                },
                toolbars: {
                    toolbar: false, // 不显示工具栏
                    showToolbar: false,
                    bubble: false, // 禁用气泡工具栏
                    float: false, // 禁用浮动工具栏
                    sidebar: false,
                    toc: false,
                },
                previewer: {
                    dom: false,
                    enablePreviewerBubble: false, // 禁用预览区域编辑能力
                },
                autoScrollByHashAfterInit: false,
                autoScrollByCursor: false,  // 禁用自动滚动
                height: '100%',
                event: {
                    changeMainTheme: (theme) => {
                        const userPreference = localStorage.getItem('qbin-theme') || 'system';
                        if (userPreference === 'system') {
                            localStorage.setItem('qbin-theme', 'system');
                        }
                        document.documentElement.classList.remove('light-theme', 'dark-theme');
                        document.documentElement.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme');
                    }
                },
                engine: {
                    global: {
                        classicBr: false,
                        htmlWhiteList: '',
                        flowSessionContext: true,
                    },
                },
                themeSettings: {
                    mainTheme: this.currentTheme,
                    inlineCodeTheme: 'default',
                    codeBlockTheme: 'default',
                    toolbarTheme: 'default'
                },
            };
            window.cherry = new Cherry(cherryConfig);
            this.contentType = contentType;
        } else {
            Cherry.usePlugin(CherryCodeBlockMermaidPlugin, {
              mermaid: window.mermaid,
              mermaidAPI: window.mermaid,
              theme: 'default',
              sequence: {
                useMaxWidth: false,
                showSequenceNumbers: true,
                mirrorActors: true,
                messageAlign: 'center'
              },
              flowchart: {
                htmlLabels: true,
                curve: 'linear'
              }
            });
            Cherry.usePlugin(CherryTableEchartsPlugin, {
              mermaid: window.echarts,
            });
            const cherryConfig = {
                id: 'qbin-viewer',
                nameSpace: 'qbin',
                value: content,
                editor: {
                    defaultModel: 'previewOnly',
                },
                toolbars: {
                    toolbar: false, // 不显示工具栏
                    showToolbar: false,
                    bubble: false, // 禁用气泡工具栏
                    float: false, // 禁用浮动工具栏
                    sidebar: false,
                    toc: contentType.includes("markdown") ? {
                        updateLocationHash: false, // 更新URL的hash
                        defaultModel: 'pure', // 完整模式，会展示所有标题
                        position: 'fixed', // 悬浮目录
                        cssText: 'right: 20px;',
                    } : false,
                },
                previewer: {
                    enablePreviewerBubble: false, // 禁用预览区域编辑能力
                },
                autoScrollByHashAfterInit: false,
                externals: {
                    katex: window.katex, // 如果需要使用Katex的话
                },
                event: {
                    changeMainTheme: (theme) => {
                        const userPreference = localStorage.getItem('qbin-theme') || 'system';
                        if (userPreference === 'system') {
                            localStorage.setItem('qbin-theme', 'system');
                        }
                        document.documentElement.classList.remove('light-theme', 'dark-theme');
                        document.documentElement.classList.add(theme === 'dark' ? 'dark-theme' : 'light-theme');
                    }
                },
                engine: {
                    global: {
                        urlProcessor(url, srcType) {
                            return url;
                        },
                        flowSessionContext: true,
                    },
                    syntax: {
                        mathBlock: {
                            engine: 'katex',
                        },
                        inlineMath: {
                            engine: 'katex',
                        },
                        codeBlock: {
                            theme: 'dark',
                            lineNumber: false,
                            copyCode: false,
                        },
                    },
                },
                themeSettings: {
                    mainTheme: this.currentTheme,
                    codeBlockTheme: 'default',
                },
            };
            window.cherry = new Cherry(cherryConfig);
            this.contentType = contentType;
        }
    }

    async init() {
        try {
            const {key, pwd} = this.currentPath;
            if (!key) {
                this.hideLoading();
                return;
            }
            const url = `/r/${key}/${pwd}`;
            this.showLoading();
            const headResponse = await fetch(url, {method: 'HEAD'});
            if (!headResponse.ok) {
                const status = headResponse.status;
                if (status === 403) {
                    // 处理密码错误的情况 - 显示密码输入界面
                    this.showPasswordDialog(key, pwd);
                    return;
                } else if (status === 404) {
                    throw new Error('访问内容不存在');
                }
                throw new Error('内容加载失败');
            }
            await this.loadContent(headResponse);
        } catch (error) {
            console.error('Error loading content:', error);
            const debouncedHome = this.debounce(() => this.handleHome());
            const debouncedNew = this.debounce(() => this.handleNew());
            this.buttonBar.innerHTML = '';
            this.buttonBar.appendChild(this.addButton('Home', debouncedHome));
            this.buttonBar.appendChild(this.addButton('New', debouncedNew));
            await this.renderError(error.message || '内容加载失败')
        }
    }

    async loadContent(headResponse) {
        const contentType = headResponse.headers.get('Content-Type');
        const contentLength = headResponse.headers.get('Content-Length');
        const contentDisposition = headResponse.headers.get('Content-Disposition');
        if (contentDisposition && contentDisposition.includes('filename=')) {
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            if (filenameMatch && filenameMatch[1]) {
                this.title = decodeURIComponent(filenameMatch[1]);
                if(this.title){
                    document.title = `${this.title} - QBin`;
                }
            }
        }
        this.setupButtons(contentType);

        if (!(['text/', 'image/', 'audio/', 'video/'].some(type => contentType.startsWith(type)))) {
            return await this.renderOtherContent(contentType, contentLength);
        }

        this.showLoading();
        const url = `/r/${this.currentPath.key}/${this.currentPath.pwd}`;
        const response = await API.fetchNet(url);
        if (contentType?.startsWith('text/plain')) {
            await this.renderPlainTextContent(response, contentType, contentLength);
        } else if (contentType?.startsWith('text/')) {
            await this.renderTextContent(response, contentType, contentLength);
        } else if (contentType?.startsWith('image/')) {
            await this.renderImageContent(response, contentType, url, contentLength);
        } else if (contentType?.startsWith('audio/')) {
            await this.renderAudioContent(response, contentType, url, contentLength);
        } else if (contentType?.startsWith('video/')) {
            await this.renderVideoContent(response, contentType, url, contentLength);
        } else {
            await this.renderOtherContent(response, contentType, contentLength);
        }
    }

    async renderImageContent(response, contentType, sourceUrl, contentLength) {
        this.cherryContainer.innerHTML = '';
        const imageMarkdown = `::: center  
![images](${sourceUrl})
:::
`;
        this.initViewer(imageMarkdown, contentType);
        this.hideLoading();
    }

    async renderAudioContent(response, contentType, sourceUrl, contentLength) {
        this.cherryContainer.innerHTML = '';
        const audioMarkdown = `::: center  
<div class="modern-audio-player">
  <div class="audio-player-icon">🎵</div>
  <div class="audio-player-content">
    <div class="audio-title">Audio File</div>
    <audio controls src="${sourceUrl}" class="modern-audio-control"></audio>
  </div>
</div>
:::
`;
        this.initViewer(audioMarkdown, contentType);
        this.hideLoading();
    }

    async renderVideoContent(response, contentType, sourceUrl, contentLength) {
        this.cherryContainer.innerHTML = '';
        const videoMarkdown = `::: center  
!video[视频文件](${sourceUrl})
:::
`;
        this.initViewer(videoMarkdown, contentType);
        this.hideLoading();
    }

    async renderPlainTextContent(response, contentType) {
        const text = await response.text();
        this.initViewer(text, contentType);
        this.hideLoading();
    }

    async renderTextContent(response, contentType) {
        let language = contentType.includes("text/x-")? contentType.substring(7): contentType.substring(5);
        language = language.split(";")[0];
        const contentText = contentType.includes("markdown")?await response.text():`\`\`\`${language}\n${await response.text()}`;
        this.edit = contentType.includes("markdown")?'m':'c';
        this.initViewer(contentText, contentType);
        this.hideLoading();
    }

    async renderOtherContent(contentType, contentLength) {
        this.cherryContainer.innerHTML = '';
        const other = `
::: center  
!17 文件类型: ${contentType}!
!17 大小: ${formatSize(contentLength)}!
:::
`;
        this.initViewer(other, contentType);
        this.hideLoading();
    }

    async renderError(message) {
        this.cherryContainer.innerHTML = '';
        this.cherryContainer.innerHTML = `
<div class="modern-error-container">
    <div class="error-icon-wrapper">
        <div class="error-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24"><rect width="24" height="24" fill="none"/><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"><path stroke-dasharray="64" stroke-dashoffset="64" d="M12 3c4.97 0 9 4.03 9 9c0 4.97 -4.03 9 -9 9c-4.97 0 -9 -4.03 -9 -9c0 -4.97 4.03 -9 9 -9Z"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.18s" values="64;0"/></path><path stroke-dasharray="8" stroke-dashoffset="8" d="M12 7v6"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.18s" dur="0.06s" values="8;0"/><animate attributeName="stroke-width" begin="0.54s" dur="0.9s" keyTimes="0;0.1;0.2;0.3;1" repeatCount="indefinite" values="1.5;2;2;1.5;1.5"/></path><path stroke-dasharray="2" stroke-dashoffset="2" d="M12 17v0.01"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.24s" dur="0.06s" values="2;0"/><animate attributeName="stroke-width" begin="0.63s" dur="0.9s" keyTimes="0;0.1;0.2;0.3;1" repeatCount="indefinite" values="1.5;2;2;1.5;1.5"/></path></g></svg>
        </div>
    </div>
    <div class="error-content">
        <h3 class="error-title">404</h3>
        <p class="error-message">${message}</p>
    </div>
</div>
`;
        this.hideLoading();
    }

    debounce(func, wait = 5) {
        const key = func.name;
        return async (...args) => {
            // 如果正在处理中，直接返回
            if (this.isProcessing) {
                return;
            }

            // 清除已存在的计时器
            if (this.debounceTimeouts.has(key)) {
                clearTimeout(this.debounceTimeouts.get(key));
            }

            // 创建新的Promise
            return new Promise((resolve) => {
                const timeout = setTimeout(async () => {
                    this.isProcessing = true;
                    try {
                        await func.apply(this, args);
                        resolve();
                    } catch (error) {
                        console.error(error);
                    } finally {
                        this.isProcessing = false;
                        this.debounceTimeouts.delete(key);
                    }
                }, wait);

                this.debounceTimeouts.set(key, timeout);
            });
        };
    }

    setupButtons(contentType) {
        // 创建按钮组
        const primaryGroup = document.createElement('div');
        const secondaryGroup = document.createElement('div');
        primaryGroup.className = 'button-group';
        secondaryGroup.className = 'button-group';

        // 使用防抖包装按钮处理函数
        const debouncedFork = this.debounce(() => this.handleFork());
        const debouncedRaw = this.debounce(() => this.handleRaw());
        const debouncedNew = this.debounce(() => this.handleNew());
        const debouncedDelete = this.debounce(() => this.handleDelete());
        const debouncedDownload = this.debounce(() => this.handleDownload());

        const copyBtn = this.addButton('Copy', () => this.handleCopy());
        primaryGroup.appendChild(copyBtn);

        if (contentType?.startsWith('text/')) {
            primaryGroup.appendChild(this.addButton('Edit', debouncedFork));
            const rawBtn = this.addButton('Raw', debouncedRaw);
            primaryGroup.appendChild(rawBtn);
        } else if (['image/', 'audio/', 'video/'].some(type => contentType.startsWith(type))) {
            const rawBtn = this.addButton('Raw', debouncedRaw);
            primaryGroup.appendChild(rawBtn);
        } else {
            const downBtn = this.addButton('Download', debouncedDownload);
            primaryGroup.appendChild(downBtn);
        }

        primaryGroup.appendChild(this.addButton('New', debouncedNew));
        const HomeBtn = this.addButton('Home', () => this.handleHome());
        secondaryGroup.appendChild(HomeBtn);

        const qrBtn = this.addButton('Share', () => this.showQRCode());
        secondaryGroup.appendChild(qrBtn);

        // 删除按钮放在最后，使用危险样式
        const delBtn = this.addButton('Delete', debouncedDelete);
        delBtn.classList.add('danger');
        secondaryGroup.appendChild(delBtn);

        this.buttonBar.appendChild(primaryGroup);
        this.buttonBar.appendChild(secondaryGroup);
    }

    addButton(text, onClick) {
        const button = document.createElement('button');
        button.className = 'button';
        button.setAttribute('aria-label', text);
        
        // Create icon-text container
        const buttonContent = document.createElement('span');
        buttonContent.className = 'button-content';
        
        // Add icon based on button text
        const iconSvg = this.getButtonIcon(text);
        if (iconSvg) {
            const iconSpan = document.createElement('span');
            iconSpan.className = 'button-icon';
            iconSpan.innerHTML = iconSvg;
            buttonContent.appendChild(iconSpan);
        }
        
        // Add text
        const textSpan = document.createElement('span');
        textSpan.className = 'button-text';
        textSpan.textContent = text;
        buttonContent.appendChild(textSpan);
        
        // Add content to button
        button.appendChild(buttonContent);
        
        button.onclick = async (e) => {
            const btn = e.currentTarget;
            if (btn.disabled) return;
            btn.disabled = true;
            try {
                await onClick();
            } finally {
                btn.disabled = false;
            }
        };
        return button;
    }

    getButtonIcon(buttonType) {
        // Return appropriate SVG icon based on button type
        const icons = {
            'Home': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path stroke-dasharray="16" stroke-dashoffset="16" d="M4.5 21.5h15"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.1s" values="16;0"/></path><path stroke-dasharray="16" stroke-dashoffset="16" d="M4.5 21.5v-13.5M19.5 21.5v-13.5"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.1s" dur="0.1s" values="16;0"/></path><path stroke-dasharray="28" stroke-dashoffset="28" d="M2 10l10 -8l10 8"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.2s" dur="0.2s" values="28;0"/></path><path stroke-dasharray="24" stroke-dashoffset="24" d="M9.5 21.5v-9h5v9"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.35s" dur="0.2s" values="24;0"/></path></g></svg>',
            'Copy': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
            'Edit': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path stroke-dasharray="20" stroke-dashoffset="20" d="M3 21h18"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.1s" values="20;0"/></path><path stroke-dasharray="48" stroke-dashoffset="48" d="M7 17v-4l10 -10l4 4l-10 10h-4"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.1s" dur="0.3s" values="48;0"/></path><path stroke-dasharray="8" stroke-dashoffset="8" d="M14 6l4 4"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.4s" dur="0.1s" values="8;0"/></path></g></svg>',
            'Raw': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="0" fill="currentColor"><animate attributeName="r" dur="3s" keyTimes="0;0.03;0.97;1" repeatCount="indefinite" values="0;3;3;0"/></circle><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 12c1.38 -0.77 4.42 -1.3 8 -1.3c3.58 0 6.62 0.53 8 1.3c-1.38 0.77 -4.42 1.3 -8 1.3c-3.58 0 -6.62 -0.53 -8 -1.3Z"><animate attributeName="d" dur="3s" keyTimes="0;0.03;0.97;1" repeatCount="indefinite" values="M4 12c1.38 -0.77 4.42 -1.3 8 -1.3c3.58 0 6.62 0.53 8 1.3c-1.38 0.77 -4.42 1.3 -8 1.3c-3.58 0 -6.62 -0.53 -8 -1.3Z;M2 12c1.72 -3.83 5.53 -6.5 10 -6.5c4.47 0 8.28 2.67 10 6.5c-1.72 3.83 -5.53 6.5 -10 6.5c-4.47 0 -8.28 -2.67 -10 -6.5Z;M2 12c1.72 -3.83 5.53 -6.5 10 -6.5c4.47 0 8.28 2.67 10 6.5c-1.72 3.83 -5.53 6.5 -10 6.5c-4.47 0 -8.28 -2.67 -10 -6.5Z;M4 12c1.38 -0.77 4.42 -1.3 8 -1.3c3.58 0 6.62 0.53 8 1.3c-1.38 0.77 -4.42 1.3 -8 1.3c-3.58 0 -6.62 -0.53 -8 -1.3Z"/></path></svg>',
            'Share': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path stroke-dasharray="20" stroke-dashoffset="20" d="M21 5l-2.5 15M21 5l-12 8.5"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.2s" values="20;0"/></path><path stroke-dasharray="24" stroke-dashoffset="24" d="M21 5l-19 7.5"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.2s" values="24;0"/></path><path stroke-dasharray="14" stroke-dashoffset="14" d="M18.5 20l-9.5 -6.5"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.2s" dur="0.15s" values="14;0"/></path><path stroke-dasharray="10" stroke-dashoffset="10" d="M2 12.5l7 1"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.2s" dur="0.15s" values="10;0"/></path><path stroke-dasharray="8" stroke-dashoffset="8" d="M12 16l-3 3M9 13.5l0 5.5"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.35s" dur="0.15s" values="8;0"/></path></g></svg>',
            'New': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path stroke-dasharray="64" stroke-dashoffset="64" d="M13 3l6 6v12h-14v-18h8"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="64;0"/></path><path stroke-dasharray="14" stroke-dashoffset="14" stroke-width="1" d="M12.5 3v5.5h6.5"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.35s" dur="0.1s" values="14;0"/></path><path stroke-dasharray="8" stroke-dashoffset="8" d="M9 14h6"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.45s" dur="0.1s" values="8;0"/></path><path stroke-dasharray="8" stroke-dashoffset="8" d="M12 11v6"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.55s" dur="0.1s" values="8;0"/></path></g></svg>',
            'Delete': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path stroke-dasharray="24" stroke-dashoffset="24" d="M12 20h5c0.5 0 1 -0.5 1 -1v-14M12 20h-5c-0.5 0 -1 -0.5 -1 -1v-14"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.4s" values="24;0"/></path><path stroke-dasharray="20" stroke-dashoffset="20" d="M4 5h16"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.4s" dur="0.2s" values="20;0"/></path><path stroke-dasharray="8" stroke-dashoffset="8" d="M10 4h4M10 9v7M14 9v7"><animate fill="freeze" attributeName="stroke-dashoffset" begin="0.6s" dur="0.2s" values="8;0"/></path></g></svg>',
            'Download': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><mask id="lineMdCloudAltDownloadLoop0"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path stroke-dasharray="64" stroke-dashoffset="64" d="M7 19h11c2.21 0 4 -1.79 4 -4c0 -2.21 -1.79 -4 -4 -4h-1v-1c0 -2.76 -2.24 -5 -5 -5c-2.42 0 -4.44 1.72 -4.9 4h-0.1c-2.76 0 -5 2.24 -5 5c0 2.76 2.24 5 5 5Z"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.6s" values="64;0"/><set fill="freeze" attributeName="opacity" begin="0.7s" to="0"/></path><g fill="#fff" stroke="none" opacity="0"><circle cx="12" cy="10" r="6"><animate attributeName="cx" begin="0.7s" dur="30s" repeatCount="indefinite" values="12;11;12;13;12"/></circle><rect width="9" height="8" x="8" y="12"/><rect width="15" height="12" x="1" y="8" rx="6"><animate attributeName="x" begin="0.7s" dur="21s" repeatCount="indefinite" values="1;0;1;2;1"/></rect><rect width="13" height="10" x="10" y="10" rx="5"><animate attributeName="x" begin="0.7s" dur="17s" repeatCount="indefinite" values="10;9;10;11;10"/></rect><set fill="freeze" attributeName="opacity" begin="0.7s" to="1"/></g><g fill="#000" fill-opacity="0" stroke="none"><circle cx="12" cy="10" r="4"><animate attributeName="cx" begin="0.7s" dur="30s" repeatCount="indefinite" values="12;11;12;13;12"/></circle><rect width="9" height="6" x="8" y="12"/><rect width="11" height="8" x="3" y="10" rx="4"><animate attributeName="x" begin="0.7s" dur="21s" repeatCount="indefinite" values="3;2;3;4;3"/></rect><rect width="9" height="6" x="12" y="12" rx="3"><animate attributeName="x" begin="0.7s" dur="17s" repeatCount="indefinite" values="12;11;12;13;12"/></rect><set fill="freeze" attributeName="fill-opacity" begin="0.7s" to="1"/></g><g fill="#fff" stroke="none"><path d="M10.5 10h3v0h-3z"><animate fill="freeze" attributeName="d" begin="0.7s" dur="0.2s" values="M10.5 10h3v0h-3z;M10.5 10h3v4h-3z"/></path><path d="M8 13h8l-4 0z"><animate fill="freeze" attributeName="d" begin="0.9s" dur="0.1s" values="M8 13h8l-4 0z;M8 13h8l-4 4z"/><animateMotion begin="1s" calcMode="linear" dur="1.5s" keyPoints="0;0.25;0.5;0.75;1" keyTimes="0;0.1;0.5;0.8;1" path="M0 0v1v-2z" repeatCount="indefinite"/></path></g></g></mask><rect width="24" height="24" fill="currentColor" mask="url(#lineMdCloudAltDownloadLoop0)"/></svg>'
        };

        return icons[buttonType] || null;
    }

    handleRaw() {
        window.location.assign(`/r/${this.currentPath.key}/${this.currentPath.pwd}`);
    }

    handleFork() {
        try {
            // 如果使用cherry-markdown，从实例中获取内容
            let content = '';
            content = window.cherry.getMarkdown();
            if (!(this.contentType?.startsWith('text/plain') || this.contentType?.includes('markdown'))) {
                content = content.substring(content.indexOf('\n') + 1);
            }

            const cacheData = {
                content,
                timestamp: getTimestamp(),
                key: this.currentPath.key,
                pwd: this.currentPath.pwd,
                title: this.title,
                hash: cyrb53(content),
            };
            storage.setCache(this.CACHE_KEY + this.currentPath.key, cacheData);
            sessionStorage.setItem(this.CACHE_KEY + 'last', JSON.stringify(cacheData));
        } catch (e) {
            console.error('Fork处理失败:', e);
        }
        const originalEditor = this.edit || 'm';
        window.location.assign(`/${originalEditor}`);
    }

    async handleNew() {
        sessionStorage.removeItem(this.CACHE_KEY + 'last');
        const originalEditor = getCookie('qbin-editor') || 'm';
        window.location.assign(`/${originalEditor}`);
    }

    handleHome() {
        window.location.assign(`/home`);
    }

    handleCopy() {
        if (this.clickTimeout) {
            // 双击检测
            clearTimeout(this.clickTimeout);
            this.clickTimeout = null;
            this.copyLink();
        } else {
            // 单击处理
            this.clickTimeout = setTimeout(() => {
                this.copyContent();
                this.clickTimeout = null;
            }, 250);
        }
    }

    async copyLink() {
        const url = window.location.href.replace("/p/", "/r/");
        ClipboardUtil.copyToClipboard(url)
            .then(result => {
                if (result.success) {
                    this.showToast('链接已复制到剪贴板', {type: 'info'});
                } else {
                    this.showToast('复制失败，请手动复制', {type: 'error'});
                    const modal = ClipboardUtil.createManualCopyUI(url);
                    document.body.appendChild(modal);
                    modal.addEventListener('manualCopy', () => {
                        this.showToast("已手动复制");
                    });
                }
            });
    }

    async copyContent() {
        let content = window.cherry.getMarkdown();
        if (!(this.contentType?.startsWith('text/plain') || this.contentType?.includes('markdown'))) {
            content = content.substring(content.indexOf('\n') + 1);
        }
        let tips = "";
        if (this.contentType.startsWith("image/")) {
            const firstImage = document.querySelector('.cherry-markdown img');
            if (!firstImage) {
                console.error('未找到图片元素');
                return;
            }
            if (!firstImage.complete) {
                await new Promise(resolve => {
                    firstImage.onload = resolve;
                });
            }
            if (navigator.clipboard && navigator.clipboard.write) {
                try {
                    // 创建可分享的文件对象
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = firstImage.naturalWidth;
                    canvas.height = firstImage.naturalHeight;
                    ctx.drawImage(firstImage, 0, 0);
                    const blob = await new Promise(resolve => {
                        canvas.toBlob(resolve, 'image/png');
                    });
                    await navigator.clipboard.write([
                        new ClipboardItem({
                            [blob.type]: blob
                        })
                    ]);
                    this.showToast('图片已复制到剪贴板', {type: 'info'});
                    return;
                } catch (err) {
                    console.warn('复制图片失败:', err);
                }
            }
            content = window.location.href.replace("/p/", "/r/");
            tips = '已复制图片直链';
        } else if (this.contentType.startsWith("text/")) {
            tips = '内容已复制到剪贴板';
        } else {
            content = window.location.href.replace('/p/', '/r/');
            tips = '直链已复制到剪贴板';
        }
        ClipboardUtil.copyToClipboard(content)
            .then(result => {
                if (result.success) {
                    this.showToast(tips, {type: 'info'});
                } else {
                    this.showToast('复制失败，请手动复制', {type: 'error'});
                    const modal = ClipboardUtil.createManualCopyUI(content);
                    document.body.appendChild(modal);
                    modal.addEventListener('manualCopy', () => {
                        this.showToast("已手动复制");
                    });
                }
            });
    }

    showToast(message, options = {}) {
        const {
            type = 'info',
            duration = 3000
        } = options;

        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.setAttribute('data-status', type);
        toast.textContent = message;

        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                toast.classList.add('visible');
            });
        });
        toast.timeoutId = setTimeout(() => {
            toast.classList.remove('visible');

            // Remove from DOM after animation completes
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, duration);
        return toast;
    }

    async handleDelete() {
        const path = `/delete/${this.currentPath.key}/${this.currentPath.pwd}`;
        try {
            const response = await fetch(path, {method: 'DELETE'});
            if (response.ok) {
                await this.clearLocalCache();
                const originalEditor = getCookie('qbin-editor') || 'm';
                window.location.assign(`/${originalEditor}`);
            } else {
                const result = await response.json();
                this.showToast(result.message || '上传失败', {type: 'error'});
            }
        } catch (error) {
            this.showToast(error.message, {type: 'error'});
        }
    }

    handleDownload() {
        window.location.assign(window.location.pathname.replace('/p/', '/r/'));
    }

    async clearLocalCache() {
        await storage.removeCache(this.CACHE_KEY + this.currentPath.key);
    }

    async showQRCode() {
        try {
            const currentUrl = window.location.href;
            const existingModal = document.querySelector('.qr-modal');
            if (existingModal) {
                existingModal.remove();
            }
            const template = document.getElementById('qrModalTemplate');
            const modal = document.importNode(template.content, true).firstElementChild;
            const urlText = modal.querySelector('.url-text');
            urlText.textContent = currentUrl;
            document.body.appendChild(modal);
            const closeBtn = modal.querySelector('.qr-close');
            closeBtn.onclick = () => {
                modal.classList.add('fadeOut');
                setTimeout(() => modal.remove(), 200);
            };
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.classList.add('fadeOut');
                    setTimeout(() => modal.remove(), 200);
                }
            };
            const urlContainer = modal.querySelector('.url-container');
            const copyHint = urlContainer.querySelector('.copy-hint');
            urlContainer.onclick = async () => {
                ClipboardUtil.copyToClipboard(currentUrl)
                    .then(result => {
                        if (result.success) {
                            this.showToast("链接已复制", {type: 'info'});
                            urlContainer.classList.add('copied');
                            copyHint.textContent = '已复制';
                            this.showToast('链接已复制', {type: 'info'});
                            setTimeout(() => {
                                urlContainer.classList.remove('copied');
                                copyHint.textContent = '点击复制';
                            }, 2000);
                        } else {
                            this.showToast('复制失败，请手动复制', {type: 'error'});
                            const modal = ClipboardUtil.createManualCopyUI(currentUrl);
                            document.body.appendChild(modal);
                            modal.addEventListener('manualCopy', () => {
                                this.showToast("已手动复制");
                            });
                        }
                    });
            };

            if (typeof qrcode === 'undefined') {
                throw new Error('QR码库未加载，请稍后再试');
            }
            const qr = qrcode(0, 'M');
            qr.addData(currentUrl);
            qr.make();
            const qrImg = document.createElement('img');
            qrImg.src = qr.createDataURL(5, 4);
            qrImg.alt = 'QR Code';
            const qrcodeContent = modal.querySelector('.qrcode-content');
            qrcodeContent.appendChild(qrImg);
        } catch (error) {
            console.error('QR码生成失败:', error);
            this.showToast('QR码生成失败', {type: 'error'});
        }
    }

    showPasswordDialog(key, currentPwd = '') {
        this.hideLoading();
        this.cherryContainer.innerHTML = '';
        this.buttonBar.innerHTML = '';

        // Get the password dialog
        const passwordDialog = document.getElementById('passwordDialog');
        const passwordInput = document.getElementById('passwordInput');
        const passwordError = document.getElementById('passwordError');

        // Reset and configure
        passwordInput.value = currentPwd || '';
        passwordError.textContent = '';
        passwordError.classList.remove('visible');

        // Make it visible in the container
        passwordDialog.style.display = 'block';
        this.cherryContainer.appendChild(passwordDialog);

        // Show New button
        const newButton = this.addButton('New', this.debounce(() => this.handleNew()));
        this.buttonBar.appendChild(newButton);

        // Handle form submission
        const form = document.getElementById('passwordForm');
        form.onsubmit = async (e) => {
            e.preventDefault();

            const submitBtn = document.getElementById('submitPasswordBtn');
            const submitBtnText = document.getElementById('submitBtnText');
            const submitBtnSpinner = document.getElementById('submitBtnSpinner');
            const password = passwordInput.value.trim();

            if (!password) {
                passwordError.textContent = '请输入密码';
                passwordError.classList.add('visible');
                return;
            }

            submitBtn.disabled = true;
            submitBtnText.style.visibility = 'hidden';
            submitBtnSpinner.style.display = 'block';
            passwordError.classList.remove('visible');

            try {
                // Validate password
                const validationResult = await this.validatePassword(key, password);
                if (validationResult.valid) {
                    // Success - update path and URL
                    this.currentPath.pwd = password;

                    if (history.pushState) {
                        const newUrl = `/p/${key}/${password}`;
                        history.pushState({path: newUrl}, '', newUrl);
                    }

                    // Reset dialog display
                    passwordDialog.style.display = 'none';

                    // Re-fetch content
                    this.showLoading();
                    await this.loadContent(validationResult.headResponse);
                } else {
                    // Failed validation
                    passwordError.textContent = '密码错误，请重试';
                    passwordError.classList.add('visible');
                    passwordInput.focus();
                }
            } catch (error) {
                passwordError.textContent = error.message || '验证过程中出现错误';
                passwordError.classList.add('visible');
            } finally {
                submitBtn.disabled = false;
                submitBtnText.style.visibility = 'visible';
                submitBtnSpinner.style.display = 'none';
            }
        };

        // Focus on password input
        setTimeout(() => {
            passwordInput.focus();
            if (currentPwd) {
                passwordInput.select();
            }
        }, 100);
    }

    async validatePassword(key, password) {
        const url = `/r/${key}/${password}`;
        const headResponse = await fetch(url, {method: 'HEAD'});
        return {
            valid: headResponse.ok,
            headResponse: headResponse
        };
    }

    showLoading() {
        this.cherryContainer.innerHTML = '';
        const template = document.getElementById('loadingTemplate');
        const loadingEl = document.importNode(template.content, true).firstElementChild;
        this.cherryContainer.appendChild(loadingEl);
    }

    hideLoading() {
        const loadingEls = this.cherryContainer.querySelectorAll('.loading-container');
        loadingEls.forEach(el => el.remove());
    }
}

new QBinViewer();