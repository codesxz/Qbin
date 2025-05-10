class QBinEditorBase {
    constructor() {
        this.currentEditor = "";
        this.currentPath = parsePath(window.location.pathname);
        this.CACHE_KEY = 'qbin/';
        this.isUploading = false;
        this.lastUploadedHash = '';
        this.autoUploadTimer = null;
        this.loadContent().then();
        if (this.currentPath.key.length < 2) {
            const newKey = API.generateKey(6);
            this.updateURL(newKey, this.currentPath.pwd);
        }
    }

    async initialize() {
        this.setupWindowsCloseSave();
        this.initializePasswordPanel();
        this.initializeKeyAndPasswordSync();
        await this.initEditor();
        if (this.currentEditor === "multi") this.initializeUI();
    }

    async initEditor() {
        throw new Error('initEditor must be implemented by subclass');
    }

    getEditorContent() {
        throw new Error('getEditorContent must be implemented by subclass');
    }

    setEditorContent(content) {
        throw new Error('setEditorContent must be implemented by subclass');
    }

    setupWindowsCloseSave() {
        window.addEventListener('beforeunload', () => {
            this.saveToLocalCache();
        });
    }

    saveToLocalCache(force = false) {
        const content = this.getEditorContent();
        if (force || (content && cyrb53(content) !== this.lastUploadedHash)) {
            const cacheData = {
                content,
                timestamp: getTimestamp(),
                path: this.currentPath.key,
                hash: cyrb53(content)
            };
            storage.setCache(this.CACHE_KEY + this.currentPath.key, cacheData);
        }
    }

    async loadFromLocalCache(key) {
        try {
            const cacheData = await storage.getCache(this.CACHE_KEY + (key || this.currentPath.key));
            if (cacheData) {
                const currentPath = parsePath(window.location.pathname);
                const isNewPage = currentPath.key.length < 2 || key;
                const isSamePath = currentPath.key === cacheData.path;
                if (isNewPage || isSamePath) {
                    this.setEditorContent(cacheData.content);
                    this.lastUploadedHash = cyrb53(cacheData.content);
                    return [true, cacheData.timestamp];
                }
            }
            return [false, 0];
        } catch (error) {
            console.error('加载缓存失败:', error);
            return [false, 0];
        }
    }

    async loadContent() {
        const {key, pwd, render} = this.currentPath;
        if (key.length > 1) {
            const [isCache, last] = await this.loadFromLocalCache();
            this.updateURL(key, pwd, "replaceState");
            if (getTimestamp() - last > 3) {
                await this.loadOnlineCache(key, pwd, isCache);
            }
        } else {
            const cacheData = JSON.parse(sessionStorage.getItem('qbin/last') || '{"key": null}');
            if (!cacheData.key) return null;
            await this.loadFromLocalCache(cacheData.key);
            this.updateURL(cacheData.key, cacheData.pwd, "replaceState");
            document.getElementById('key-input').value = cacheData.key.trim() || '';
            document.getElementById('password-input').value = cacheData.pwd.trim() || '';
        }
    }

    initializeUI() {
        let saveTimeout;
        // 编辑器内容变化：保存缓存并自动上传
        this.editor.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveToLocalCache();
            }, 1000);
            clearTimeout(this.autoUploadTimer);
            this.autoUploadTimer = setTimeout(() => {
                const content = this.getEditorContent();
                if (content && cyrb53(content) !== this.lastUploadedHash) {
                    this.handleUpload(content, "text/plain; charset=UTF-8");
                }
            }, 2000);
        });

        // 添加编辑器焦点处理
        this.editor.addEventListener('focus', () => {
            document.body.classList.add('editor-focused');
        });

        this.editor.addEventListener('blur', () => {
            document.body.classList.remove('editor-focused');
        });
    }

    async loadOnlineCache(key, pwd, isCache, isSuccess = true) {
        if (this.isUploading) return;
        try {
            this.isUploading = true;
            this.updateUploadStatus("数据加载中…");
            let tips = "";
            const {status, content} = await API.getContent(key, pwd);

            if (!content && status !== 200 && status !== 404) {
                throw new Error('加载失败');
            }

            this.lastUploadedHash = cyrb53(content || "");
            const currentContent = this.getEditorContent();
            const currentHash = cyrb53(currentContent || "");
            const uploadArea = document.querySelector('.upload-area');

            // 处理404情况
            if (status === 404) {
                this.saveToLocalCache(true);
                tips = "这是可用的访问路径";
                if (uploadArea) {
                    uploadArea.classList.add('visible');
                }
                this.updateUploadStatus(tips, "success");
                return true;
            }

            // 检查内容差异
            const needsConfirmation = isCache &&
                                    content &&
                                    currentContent &&
                                    this.lastUploadedHash !== currentHash;

            if (needsConfirmation) {
                const result = await this.showConfirmDialog(
                    "检测到本地缓存与服务器数据不一致，您想使用哪个版本？\n\n" +
                    "• 本地版本：保留当前编辑器中的内容\n" +
                    "• 服务器版本：加载服务器上的最新内容"
                );

                if (result) {
                    this.setEditorContent(content);
                    this.saveToLocalCache(true);
                    tips = "远程数据加载成功";
                } else {
                    this.saveToLocalCache(true);
                    tips = "保留本地版本";
                }
            } else {
                // 如果本地为空或远程为空，直接加载远程内容
                if (!currentContent || !isCache) {
                    this.setEditorContent(content || "");
                }
                this.saveToLocalCache(true);
                tips = "数据加载成功";
            }

            // 更新上传区域可见性
            if (uploadArea) {
                uploadArea.classList.toggle('visible', !content);
            }

            this.updateUploadStatus(tips, "success");
            return true;
        } catch (error) {
            isSuccess = false;
            this.updateUploadStatus("加载失败：" + error.message);
            console.error(error);
            const uploadArea = document.querySelector('.upload-area');
            if (uploadArea && !this.lastUploadedHash) {
                uploadArea.classList.add('visible');
            }
            return false;
        } finally {
            this.isUploading = false;
            setTimeout(() => {
                this.updateUploadStatus("");
            }, isSuccess ? 2000 : 5000);
        }
    }

    async handleUpload(content, mimetype, isSuccess = true) {
        if (this.isUploading) return;
        if (!content) return;

        const isFile = !mimetype.includes("text/");
        let statusMessage = "保存中…";
        let statusType = "loading";

        // Get upload UI elements once
        const uploadIcon = document.querySelector('.upload-icon');
        const uploadText = document.querySelector('.upload-text');

        if (isFile) {
            const fileSize = content.size / 1024;
            const sizeText = fileSize < 1024 ?
                `${fileSize.toFixed(1)}KB` :
                `${(fileSize / 1024).toFixed(1)}MB`;
            statusMessage = `上传中 ${content.name} (${sizeText})`;
        }

        this.updateUploadStatus(statusMessage, statusType);
        // Set upload UI to loading state for large files
        let isUploadIconLoading = false;
        if (isFile && content.size > 1024 * 1024) {
            document.querySelector('.upload-icon').innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"48\" height=\"48\" viewBox=\"0 0 24 24\"><g fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path stroke-dasharray=\"2 4\" stroke-dashoffset=\"6\" d=\"M12 21c-4.97 0 -9 -4.03 -9 -9c0 -4.97 4.03 -9 9 -9\"><animate attributeName=\"stroke-dashoffset\" dur=\"0.3s\" repeatCount=\"indefinite\" values=\"6;0\"/></path><path stroke-dasharray=\"32\" stroke-dashoffset=\"32\" d=\"M12 3c4.97 0 9 4.03 9 9c0 4.97 -4.03 9 -9 9\"><animate fill=\"freeze\" attributeName=\"stroke-dashoffset\" begin=\"0.05s\" dur=\"0.2s\" values=\"32;0\"/></path><path stroke-dasharray=\"10\" stroke-dashoffset=\"10\" d=\"M12 16v-7.5\"><animate fill=\"freeze\" attributeName=\"stroke-dashoffset\" begin=\"0.25s\" dur=\"0.1s\" values=\"10;0\"/></path><path stroke-dasharray=\"6\" stroke-dashoffset=\"6\" d=\"M12 8.5l3.5 3.5M12 8.5l-3.5 3.5\"><animate fill=\"freeze\" attributeName=\"stroke-dashoffset\" begin=\"0.35s\" dur=\"0.1s\" values=\"6;0\"/></path></g></svg>";
            document.querySelector('.upload-text').textContent = "正在处理，请稍候...";
            isUploadIconLoading = true;
        }

        try {
            this.isUploading = true;
            const keyInput = document.getElementById('key-input');
            const passwordInput = document.getElementById('password-input');
            let key = this.currentPath.key || keyInput.value.trim() || API.generateKey(6);
            const action = this.currentPath.key === key ? "replaceState" : "pushState";
            const pwd = passwordInput.value.trim();
            const chash = cyrb53(content);

            const success = await API.uploadContent(content, key, pwd, mimetype);
            if (success) {
                if (!isFile) {
                    this.lastUploadedHash = chash;
                }

                // Show more descriptive success message
                if (isFile) {
                    this.updateUploadStatus(`文件 ${content.name} 上传成功`, "success");
                } else {
                    this.updateUploadStatus("内容保存成功", "success");
                }

                this.updateURL(key, pwd, action);
                if (isFile) {
                    setTimeout(() => {
                        window.location.assign(`/p/${key}/${pwd}`);
                    }, 800); // Give more time to see the success message
                }
            }
        } catch (error) {
            isSuccess = false;

            // More detailed error message
            let errorMsg = "保存失败";
            if (error.message.includes("size")) {
                errorMsg = "文件大小超出限制";
            } else if (error.message.includes("network") || error.message.includes("connect")) {
                errorMsg = "网络连接失败，请检查网络";
            } else {
                errorMsg = error.message;
            }

            this.updateUploadStatus(errorMsg, "error");
            console.error(error);
        } finally {
            this.isUploading = false;

            // Reset upload button if needed
            if (isFile && isUploadIconLoading) {
                document.querySelector('.upload-icon').innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"48\" height=\"48\" viewBox=\"0 0 24 24\"><mask id=\"lineMdFolderArrowUp0\"><g fill=\"none\" stroke=\"#fff\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"1.5\"><path stroke-dasharray=\"64\" stroke-dashoffset=\"64\" d=\"M12 7h8c0.55 0 1 0.45 1 1v10c0 0.55 -0.45 1 -1 1h-16c-0.55 0 -1 -0.45 -1 -1v-11Z\"><animate fill=\"freeze\" attributeName=\"stroke-dashoffset\" dur=\"0.3s\" values=\"64;0\"/></path><path d=\"M12 7h-9v0c0 0 0.45 0 1 0h6z\" opacity=\"0\"><animate fill=\"freeze\" attributeName=\"d\" begin=\"0.3s\" dur=\"0.1s\" values=\"M12 7h-9v0c0 0 0.45 0 1 0h6z;M12 7h-9v-1c0 -0.55 0.45 -1 1 -1h6z\"/><set fill=\"freeze\" attributeName=\"opacity\" begin=\"0.3s\" to=\"1\"/></path><path fill=\"#000\" fill-opacity=\"0\" stroke=\"none\" d=\"M19 13c3.31 0 6 2.69 6 6c0 3.31 -2.69 6 -6 6c-3.31 0 -6 -2.69 -6 -6c0 -3.31 2.69 -6 6 -6Z\"><set fill=\"freeze\" attributeName=\"fill-opacity\" begin=\"0.4s\" to=\"1\"/></path><path stroke-dasharray=\"6\" stroke-dashoffset=\"6\" d=\"M19 21v-5\"><animate fill=\"freeze\" attributeName=\"stroke-dashoffset\" begin=\"0.4s\" dur=\"0.1s\" values=\"6;0\"/></path><path stroke-dasharray=\"4\" stroke-dashoffset=\"4\" d=\"M19 16l2 2M19 16l-2 2\"><animate fill=\"freeze\" attributeName=\"stroke-dashoffset\" begin=\"0.5s\" dur=\"0.1s\" values=\"4;0\"/></path></g></mask><rect width=\"24\" height=\"24\" fill=\"currentColor\" mask=\"url(#lineMdFolderArrowUp0)\"/></svg>";
                document.querySelector('.upload-text').textContent = "Ctrl+V或拖放上传";
            }

            setTimeout(() => {
                this.updateUploadStatus("");
            }, isSuccess ? 2000 : 5000);
        }
    }

    // 添加确认对话框方法
    showConfirmDialog(message) {
        return new Promise((resolve) => {
            const overlay = document.querySelector('.confirm-overlay');
            const dialog = document.querySelector('.confirm-dialog');
            const content = dialog.querySelector('.confirm-dialog-content');

            content.textContent = message;

            const showDialog = () => {
                overlay.classList.add('active');
                dialog.classList.add('active');
            };

            const hideDialog = () => {
                overlay.classList.remove('active');
                dialog.classList.remove('active');
            };

            const handleClick = (e) => {
                const button = e.target.closest('.confirm-button');
                if (!button) return;

                const action = button.dataset.action;
                hideDialog();

                // 移除事件监听
                dialog.removeEventListener('click', handleClick);
                overlay.removeEventListener('click', handleOverlayClick);
                document.removeEventListener('keydown', handleKeydown);

                resolve(action === 'confirm');
            };

            const handleOverlayClick = () => {
                hideDialog();
                resolve(false);
            };

            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    hideDialog();
                    resolve(false);
                } else if (e.key === 'Enter') {
                    hideDialog();
                    resolve(true);
                }
            };

            // 添加事件监听
            dialog.addEventListener('click', handleClick);
            overlay.addEventListener('click', handleOverlayClick);
            document.addEventListener('keydown', handleKeydown);
            showDialog();
        });
    }

    updateUploadStatus(message, type) {
        const statusEl = document.getElementById('upload-status');
        if (!statusEl) return;

        // If empty message, hide the status
        if (!message) {
            statusEl.textContent = '';
            statusEl.classList.remove('visible');
            return;
        }

        // Set the status type
        statusEl.removeAttribute('data-status');
        if (message.includes('成功')) {
            statusEl.setAttribute('data-status', 'success');
        } else if (message.includes('失败')) {
            statusEl.setAttribute('data-status', 'error');
        } else if (message.includes('加载')) {
            statusEl.setAttribute('data-status', 'info');
        } else {
            statusEl.setAttribute('data-status', 'info');
        }

        statusEl.textContent = message;
        requestAnimationFrame(() => {
            statusEl.classList.add('visible');
        });
    }

    initializePasswordPanel() {
        const bookmark = document.querySelector('.bookmark');
        const passwordPanel = document.querySelector('.password-panel');
        let isInputActive = false;
        let hoverTimeout = null;
        let hideTimeout = null;
        // 设置复选框交互
        const checkbox = document.getElementById('encrypt-checkbox');
        const hiddenCheckbox = document.getElementById('encryptData');
        const optionToggle = document.querySelector('.option-toggle');

        const showPanel = () => {
            clearTimeout(hideTimeout);
            passwordPanel.classList.add('active');
        };

        const hidePanel = () => {
            if (!isInputActive) {
                passwordPanel.classList.remove('active');
                passwordPanel.style.transform = '';
            }
        };

        if (isMobile()) {
            bookmark.style.cursor = 'pointer';
            let touchStartTime;
            let touchStartY;
            let isTouchMoved = false;
            bookmark.addEventListener('touchstart', (e) => {
                touchStartTime = getTimestamp();
                touchStartY = e.touches[0].clientY;
                isTouchMoved = false;
            }, {passive: true});
            bookmark.addEventListener('touchmove', (e) => {
                if (Math.abs(e.touches[0].clientY - touchStartY) > 10) {
                    isTouchMoved = true;
                }
            }, {passive: true});
            bookmark.addEventListener('touchend', (e) => {
                const touchDuration = getTimestamp() - touchStartTime;
                if (!isTouchMoved && touchDuration < 250) {
                    e.preventDefault();
                    if (passwordPanel.classList.contains('active')) {
                        hidePanel();
                    } else {
                        showPanel();
                    }
                }
            });
            document.addEventListener('click', (e) => {
                if (passwordPanel.classList.contains('active')) {
                    const isOutsideClick = !passwordPanel.contains(e.target) &&
                        !bookmark.contains(e.target);
                    if (isOutsideClick) {
                        hidePanel();
                    }
                }
            }, true);
            let startY = 0;
            let currentY = 0;
            passwordPanel.addEventListener('touchstart', (e) => {
                if (e.target === passwordPanel || e.target.closest('.password-panel-title')) {
                    startY = e.touches[0].clientY;
                    currentY = startY;
                }
            }, {passive: true});
            passwordPanel.addEventListener('touchmove', (e) => {
                if (startY !== 0) {
                    currentY = e.touches[0].clientY;
                    const deltaY = currentY - startY;
                    if (deltaY > 0) {
                        e.preventDefault();
                        passwordPanel.style.transform = `translateY(${deltaY}px)`;
                        passwordPanel.style.transition = 'none';
                    }
                }
            }, {passive: false});
            passwordPanel.addEventListener('touchend', () => {
                if (startY !== 0) {
                    const deltaY = currentY - startY;
                    passwordPanel.style.transition = 'all 0.3s ease';
                    if (deltaY > 50) {
                        hidePanel();
                    } else {
                        passwordPanel.style.transform = '';
                    }
                    startY = 0;
                }
            });
        } else {
            bookmark.addEventListener('mouseenter', () => {
                clearTimeout(hideTimeout);
                hoverTimeout = setTimeout(showPanel, 100);
            });
            bookmark.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimeout);
                hideTimeout = setTimeout(hidePanel, 500);
            });
            passwordPanel.addEventListener('mouseenter', () => {
                clearTimeout(hideTimeout);
                clearTimeout(hoverTimeout);
            });
            passwordPanel.addEventListener('mouseleave', () => {
                if (!isInputActive) {
                    hideTimeout = setTimeout(hidePanel, 500);
                }
            });
        }

        const inputs = passwordPanel.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                isInputActive = true;
                clearTimeout(hideTimeout);
            });
            input.addEventListener('blur', () => {
                isInputActive = false;
                if (!isMobile() && !passwordPanel.matches(':hover')) {
                    hideTimeout = setTimeout(hidePanel, 800);
                }
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && passwordPanel.classList.contains('active')) {
                hidePanel();
            }
        });

        // 将点击事件从checkbox移到整个optionToggle区域
        optionToggle.addEventListener('click', function() {
            if (checkbox.classList.contains('checked')) {
                checkbox.classList.remove('checked');
                hiddenCheckbox.checked = false;
            } else {
                checkbox.classList.add('checked');
                hiddenCheckbox.checked = true;
            }
        });

        // 初始化复选框状态
        if (hiddenCheckbox.checked) {
            checkbox.classList.add('checked');
        }
    }

    initializeKeyAndPasswordSync() {
        const keyInput = document.getElementById('key-input');
        const passwordInput = document.getElementById('password-input');
        const generateKeyBtn = document.getElementById('generate-key-btn');
        const generatePwdBtn = document.getElementById('generate-pwd-btn');
        const undoSettingsBtn = document.getElementById('undo-settings');
        const applySettingsBtn = document.getElementById('apply-settings');

        // Store original values for reset functionality
        let originalKey = this.currentPath.key;
        let originalPwd = this.currentPath.pwd;

        // 初始化输入框值
        keyInput.value = this.currentPath.key;
        passwordInput.value = this.currentPath.pwd;

        // 监听输入变化，更新地址栏
        const updateURLHandler = () => {
            const trimmedKey = keyInput.value.trim();
            const trimmedPwd = passwordInput.value.trim();

            // 只有在 key 长度大于等于 2 时才更新 URL
            if (trimmedKey.length >= 2) {
                this.updateURL(trimmedKey, trimmedPwd, "replaceState");
            }
        };

        // Track if inputs are modified
        const markInputAsModified = (input) => {
            input.classList.add('input-modified');
        };

        const resetInputModification = (input) => {
            input.classList.remove('input-modified');
        };

        keyInput.addEventListener('input', () => {
            updateURLHandler();
            if (keyInput.value.trim() !== originalKey) {
                markInputAsModified(keyInput);
            } else {
                resetInputModification(keyInput);
            }
        });

        passwordInput.addEventListener('input', () => {
            updateURLHandler();
            if (passwordInput.value.trim() !== originalPwd) {
                markInputAsModified(passwordInput);
            } else {
                resetInputModification(passwordInput);
            }
        });

        // 添加按钮旋转动画效果
        const addRotationAnimation = (button) => {
            button.classList.add('rotating');
            setTimeout(() => {
                button.classList.remove('rotating');
            }, 600);
        };

        // 生成随机访问路径
        const generateRandomKey = () => {
            const newKey = API.generateKey(6);
            keyInput.value = newKey;
            updateURLHandler();
            
            // 添加动画效果
            keyInput.classList.add('highlight-input');
            addRotationAnimation(generateKeyBtn);
            setTimeout(() => {
                keyInput.classList.remove('highlight-input');
            }, 500);
            markInputAsModified(keyInput);
        };

        // 生成随机密码
        const generateRandomPassword = () => {
            // 生成8-12位包含字母数字的随机密码
            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            const length = Math.floor(Math.random() * 5) + 8; // 8-12位
            let password = "";
            for (let i = 0; i < length; i++) {
                const randomIndex = Math.floor(Math.random() * charset.length);
                password += charset[randomIndex];
            }
            
            passwordInput.value = password;
            updateURLHandler();
            
            // 添加动画效果
            passwordInput.classList.add('highlight-input');
            addRotationAnimation(generatePwdBtn);
            setTimeout(() => {
                passwordInput.classList.remove('highlight-input');
            }, 500);
            markInputAsModified(passwordInput);
        };

        // 重置设置
        const resetSettings = () => {
            keyInput.value = originalKey;
            passwordInput.value = originalPwd;
            updateURLHandler();
            
            // 添加动画效果
            keyInput.classList.add('highlight-input');
            passwordInput.classList.add('highlight-input');
            setTimeout(() => {
                keyInput.classList.remove('highlight-input');
                passwordInput.classList.remove('highlight-input');
            }, 500);
            
            resetInputModification(keyInput);
            resetInputModification(passwordInput);
            
            this.updateUploadStatus("已撤销设置", "success");
        };

        // 保存内容
        const saveContent = () => {
            const content = this.getEditorContent();
            if (content) {
                this.handleUpload(content, "text/plain; charset=UTF-8");
                this.saveToLocalCache(true);
                originalKey = this.currentPath.key;
                originalPwd = this.currentPath.pwd;
                resetInputModification(keyInput);
                resetInputModification(passwordInput);
            } else {
                this.updateUploadStatus("无法保存空内容", "info");
            }
        };

        // 为生成按钮添加点击事件
        if (generateKeyBtn) {
            generateKeyBtn.addEventListener('click', generateRandomKey);
        }
        
        if (generatePwdBtn) {
            generatePwdBtn.addEventListener('click', generateRandomPassword);
        }

        // 添加重置和保存按钮事件
        if (undoSettingsBtn) {
            undoSettingsBtn.addEventListener('click', resetSettings);
        }
        
        if (applySettingsBtn) {
            applySettingsBtn.addEventListener('click', saveContent);
        }

        // 根据当前编辑器类型确定跳转映射
        const getEditorMapping = () => {
            const mappings = {
                'multi': { // 在通用编辑器时
                    'edit1-button': 'c',  // edit1 跳转到代码编辑器
                    'edit2-button': 'm',  // edit2 跳转到md编辑器
                },
                'code': { // 在代码编辑器时
                    'edit1-button': 'e',  // edit1 跳转到通用编辑器
                    'edit2-button': 'm',  // edit2 跳转到md编辑器
                },
                'md': { // 在md编辑器时
                    'edit1-button': 'e',  // edit1 跳转到通用编辑器
                    'edit2-button': 'c',  // edit2 跳转到代码编辑器
                }
            };
            return mappings[this.currentEditor] || mappings['multi'];
        };

        // 添加预览按钮功能
        const previewButton = document.getElementById('preview-button');
        if (previewButton) {
            previewButton.addEventListener('click', () => {
                const key = this.currentPath.key.trim();
                const pwd = this.currentPath.pwd.trim();
                if (key) {
                    this.saveToLocalCache(true);
                    sessionStorage.setItem('qbin/last', JSON.stringify({
                        key: key,
                        pwd: pwd,
                        timestamp: getTimestamp()
                    }));
                    window.location.href = `/p/${key}/${pwd}`;
                }
            });
        }

        // 处理编辑器跳转按钮
        const editorMapping = getEditorMapping();
        Object.entries(editorMapping).forEach(([buttonId, editorType]) => {
            const button = document.getElementById(buttonId);
            if (button) {
                button.addEventListener('click', () => {
                    const key = this.currentPath.key.trim();
                    const pwd = this.currentPath.pwd.trim();
                    if (key) {
                        this.saveToLocalCache(true);
                        sessionStorage.setItem('qbin/last', JSON.stringify({
                            key: key,
                            pwd: pwd,
                            timestamp: getTimestamp()
                        }));
                        window.location.href = `/${editorType}/${key}/${pwd}`;
                    }
                });
            }
        });
    }

    updateURL(key, pwd, action = "replaceState") {
        // action: replaceState | pushState
        if (key && key.length < 2) return;
        const {render} = parsePath(window.location.pathname);
        const defaultRender = getCookie('qbin-editor') || 'm';
        const renderPath = ["e", "p", "c", "m"].includes(render) ? `/${render}` : `/${defaultRender}`;

        const pathSegments = [renderPath, key, pwd].filter(Boolean);
        const newPath = pathSegments.join('/');

        this.currentPath = {render, key, pwd};

        const historyMethod = window.history[action];
        if (!historyMethod) {
            console.error(`Invalid history action: ${action}`);
            return;
        }
        historyMethod.call(window.history, null, '', newPath);
    }
}
