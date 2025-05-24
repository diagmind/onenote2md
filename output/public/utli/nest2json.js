// 生成JSON的功能
function generateDocumentJSON() {
    // 獲取頁面資訊
    const pageUrl = window.location.href;
    const pageTitle = document.getElementById('thePageTitle')?.textContent || '';

    // 遞迴函式來創建巢狀的文檔樹結構
    function buildDocTree(element) {
        // 確保只處理可見的段落
        if (!element || getComputedStyle(element).display === 'none') {
            return null;
        }

        // 創建當前節點的基本資訊
        const nodeInfo = {
            DOMnodeID: Math.random().toString(36).substr(2, 9), // 生成隨機ID
            DOMnodeClass: element.className,
            DOMinnerText: element.innerText.trim(),
            DOMfirstChildInnerText: element.firstChild?.innerText?.trim() || '',
            DOMinnerHtml: element.innerHTML.trim(),
            DOMattributes: Array.from(element.attributes).map(attr => ({ name: attr.name, value: attr.value }))
        };

        // 找出所有子元素，這裡僅處理 .ui.segment 元素
        const childSegments = Array.from(element.querySelectorAll(':scope > .ui.segment'));//TODO:我不確定這裡不吃P會不會有問題

        if (childSegments.length > 0) {
            nodeInfo.DOMchildArray = childSegments
                .map(buildDocTree)
                .filter(item => item !== null);
        }

        return nodeInfo;
    }

    // 獲取所有最上層的可見段落
    const docxWrapper = document.querySelector('.docx-wrapper.ui.segment');
    const topLevelSegments = Array.from(docxWrapper.querySelectorAll('.level-2'));

    // 構建文檔樹
    const docTree = topLevelSegments
        .map(buildDocTree)
        .filter(item => item !== null);

    // 建立最終的JSON物件
    const jsonResult = {
        pageUrl: pageUrl,
        pageH1: pageTitle,
        docTree: docTree
    };

    return jsonResult;
}

// 下載JSON的功能
function document_getElementById_DEVgenJSON_addEventListener_click_function() {
    const jsonResult = generateDocumentJSON();
    const jsonString = JSON.stringify(jsonResult, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // 創建下載連結並點擊觸發下載
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document_structure.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 在JsonCrack中檢視JSON的功能
function document_getElementById_DEVviewJSON_addEventListener_click_function() {
    const jsonResult = generateDocumentJSON();

    // 創建一個全屏的容器
    const viewerContainer = document.createElement('div');
    viewerContainer.style.position = 'fixed';
    viewerContainer.style.top = '0';
    viewerContainer.style.left = '0';
    viewerContainer.style.width = '100vw';
    viewerContainer.style.height = '100vh';
    viewerContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    viewerContainer.style.zIndex = '10000';
    viewerContainer.style.display = 'flex';
    viewerContainer.style.flexDirection = 'column';

    // 創建一個關閉按鈕
    const closeButton = document.createElement('button');
    closeButton.textContent = '關閉檢視器';
    closeButton.style.margin = '10px';
    closeButton.style.padding = '10px';
    closeButton.style.fontSize = '16px';
    closeButton.style.backgroundColor = '#f44336';
    closeButton.style.color = 'white';
    closeButton.style.border = 'none';
    closeButton.style.borderRadius = '5px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.alignSelf = 'flex-end';

    // 創建iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'jsoncrackEmbed';
    iframe.src = 'https://jsoncrack.com/widget';
    iframe.style.width = '100%';
    iframe.style.height = 'calc(100% - 60px)';
    iframe.style.border = 'none';

    // 添加到容器
    viewerContainer.appendChild(closeButton);
    viewerContainer.appendChild(iframe);
    document.body.appendChild(viewerContainer);

    // 設置關閉按鈕的事件
    closeButton.addEventListener('click', function () {
        document.body.removeChild(viewerContainer);
    });

    // 將JSON傳送到iframe
    const jsonString = JSON.stringify(jsonResult, null, 2);
    window.addEventListener('message', function messageHandler(event) {
        iframe.contentWindow.postMessage({
            json: jsonString
        }, '*');
        // 移除監聽器以避免重複處理
        window.removeEventListener('message', messageHandler);
    });
}

// 生成並下載Markdown的功能
function generateMarkdown(docTree) {
    let markdownContent = '';
    
    // 遞迴處理文檔樹結構
    function processNode(node, depth = 0) {
        if (!node) return '';
        
        let nodeContent = '';
        const nodeClass = node.DOMnodeClass || '';
        const text = node.DOMfirstChildInnerText;
        
        // 根據不同層級格式化輸出
        if (nodeClass.includes('level-2') || nodeClass.includes('level-3') || nodeClass.includes('level-4')) {
            // 針對 level-2 ~ level-4 使用標題格式
            const headingLevel = nodeClass.includes('level-2') ? 2 : 
                                nodeClass.includes('level-3') ? 3 : 4;
            nodeContent += `${'#'.repeat(headingLevel)} ${text}\n\n`;
        } else if (nodeClass.includes('level-5')) {
            // 針對 level-5 使用無縮進列表
            nodeContent += `- ${text}\n`;
        } else if (nodeClass.includes('level-6')) {
            // 針對 level-6 使用縮進列表（用tab縮進）
            nodeContent += `\t- ${text}\n`;
        } else if (depth > 6 || (nodeClass.includes('level-') && parseInt(nodeClass.match(/level-(\d+)/)?.[1]) > 6)) {
            // 針對大於level-6的使用info區塊
            //nodeContent += `:::info\n${text}\n:::\n\n`;
            //TODO i think this is better
            for(var i = 0; i < parseInt(nodeClass.match(/level-(\d+)/)?.[1])-5; i++){
                nodeContent += `\t`;
            }
            nodeContent += `- ${text}\n`;
        } else if (text) {
            // 其他有文本的元素
            nodeContent += `${text}\n\n`;
        }
        
        // 處理子節點
        if (node.DOMchildArray && node.DOMchildArray.length > 0) {
            node.DOMchildArray.forEach(child => {
                nodeContent += processNode(child, depth + 1);
            });
        }
        
        return nodeContent;
    }
    
    // 處理整個文檔樹
    docTree.forEach(node => {
        markdownContent += processNode(node);
    });
    
    return markdownContent;
}

// 下載Markdown的功能
function document_getElementById_DEVdownloadMarkdown_addEventListener_click_function() {
    const jsonResult = generateDocumentJSON();
    const markdownContent = generateMarkdown(jsonResult.docTree);
    
    // 添加頁面標題作為Markdown的標題
    const pageTitle = jsonResult.pageH1 || 'Document';
    const fullMarkdown = `# ${pageTitle}\n\n${markdownContent}`;
    
    // 創建下載
    const blob = new Blob([fullMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    // 創建下載連結並點擊觸發下載
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pageTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
