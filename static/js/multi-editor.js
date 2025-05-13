class QBinMultiEditor extends QBinEditorBase {
    constructor() {
        super();
        this.currentEditor = "multi";
        this.contentType = "text/plain; charset=UTF-8";
        this.initialize();
    }

    async initEditor() {
        this.editor = document.getElementById('editor');
        this.setupDragAndPaste();
        this.updateUploadAreaVisibility();

        // 监听编辑器内容变化
        this.editor.addEventListener('input', () => {
            this.updateUploadAreaVisibility();
        });
    }

    getEditorContent() {
        return this.editor.value;
    }

    setEditorContent(content) {
        this.editor.value = content;
        this.updateUploadAreaVisibility();
    }

    updateUploadAreaVisibility() {
        const uploadArea = document.querySelector('.upload-area');
        if (uploadArea) {
            const isEmpty = !this.getEditorContent().trim();
            uploadArea.classList.toggle('visible', isEmpty);
        }
    }

    setupDragAndPaste() {
        // 粘贴上传（图片）
        this.editor.addEventListener('paste', (e) => {
            const items = e.clipboardData.items;
            for (let item of items) {
                if (item.type.indexOf('image/') === 0) {
                    e.preventDefault();
                    const file = item.getAsFile();
                    this.handleUpload(file, file.type);
                    return;
                }
            }
        });
        
        // 使用事件委托，只在content容器上添加拖放事件监听器
        const contentContainer = document.querySelector('.content');
        if (!contentContainer) return;
        
        // 跟踪拖动状态
        let dragCounter = 0;
        
        // 验证拖放目标是否有效（编辑器或上传按钮）
        const isValidDropTarget = (target) => {
            return (
                target === this.editor || 
                target.closest('.upload-button') !== null
            );
        };
        
        // 使用事件委托处理所有拖放事件
        contentContainer.addEventListener('dragenter', (e) => {
            if (!isValidDropTarget(e.target)) return;
            
            e.preventDefault();
            dragCounter++;
            
            // 检查拖动的是否为文件
            if (e.dataTransfer.types.includes('Files')) {
                this.editor.classList.add('drag-over');
            }
        });
        
        contentContainer.addEventListener('dragover', (e) => {
            if (!isValidDropTarget(e.target)) return;
            
            e.preventDefault();
        });
        
        contentContainer.addEventListener('dragleave', (e) => {
            if (!isValidDropTarget(e.target)) return;
            
            e.preventDefault();
            dragCounter--;
            
            // 只有当计数器为0时才移除状态
            if (dragCounter <= 0) {
                dragCounter = 0;
                this.editor.classList.remove('drag-over');
            }
        });
        
        contentContainer.addEventListener('drop', (e) => {
            if (!isValidDropTarget(e.target)) return;
            
            e.preventDefault();
            dragCounter = 0;
            this.editor.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                const file = files[0];
                
                // 显示处理中状态
                this.editor.classList.add('processing');
                
                // 处理完成后移除处理中状态
                setTimeout(() => {
                    this.editor.classList.remove('processing');
                }, 500);
                
                this.handleUpload(file, file.type);
                if (file.type.includes("text/")) {
                    this.appendTextContent(file);
                }
            }
        });
        
        // dragend - 全局确保状态清除
        document.addEventListener('dragend', () => {
            dragCounter = 0;
            this.editor.classList.remove('drag-over');
        });
        
        // 文件上传区域
        const uploadArea = document.querySelector('.upload-area');
        const fileInput = document.getElementById('file-input');
        
        // 恢复更新上传区域可见性的代码
        const updateUploadAreaVisibility = () => {
            if (uploadArea) {
                const isEmpty = !this.editor.value.trim();
                uploadArea.classList.toggle('visible', isEmpty);
            }
        };
        
        updateUploadAreaVisibility();
        this.editor.addEventListener('input', updateUploadAreaVisibility);
        
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    const file = e.target.files[0];
                    this.handleUpload(file, file.type);
                    if (file.type.includes("text/")) {
                        this.appendTextContent(file);
                    }
                }
            });
        }
    }

    appendTextContent(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const textContent = event.target.result;
            this.setEditorContent(this.getEditorContent() + textContent);
        };
        reader.onerror = () => {
            console.error("读取文件内容时出错");
        };
        reader.readAsText(file);
    }
}
new QBinMultiEditor();
