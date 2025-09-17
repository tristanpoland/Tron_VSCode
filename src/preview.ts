import * as vscode from 'vscode';

export class TronPreview {
    private context: vscode.ExtensionContext;
    private previewPanel: vscode.WebviewPanel | undefined;
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }
    
    showPreview(document: vscode.TextDocument): void {
        if (this.previewPanel) {
            this.previewPanel.reveal(vscode.ViewColumn.Beside);
        } else {
            this.previewPanel = vscode.window.createWebviewPanel(
                'tronPreview',
                'Tron Template Preview',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            this.previewPanel.onDidDispose(() => {
                this.previewPanel = undefined;
            });
        }

        // Always update preview to match the active .tron/.tpl file
        this.updatePreview(document);

        // Listen for active editor changes to update preview to the new Tron file
        const updateForActiveEditor = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && (editor.document.languageId === 'tron')) {
                this.updatePreview(editor.document);
            }
        });
        this.previewPanel.onDidDispose(() => updateForActiveEditor.dispose());

        // Auto-refresh if enabled
        const config = vscode.workspace.getConfiguration('tron.preview');
        const autoRefresh = config.get<boolean>('autoRefresh', true);
        if (autoRefresh) {
            const disposable = vscode.workspace.onDidChangeTextDocument(event => {
                if (event.document.languageId === 'tron' && this.previewPanel) {
                    // Only update if the preview is showing the same file
                    const activeEditor = vscode.window.activeTextEditor;
                    if (activeEditor && activeEditor.document === event.document) {
                        this.updatePreview(event.document);
                    }
                }
            });
            this.previewPanel.onDidDispose(() => disposable.dispose());
        }
    }
    
    private updatePreview(document: vscode.TextDocument): void {
        if (!this.previewPanel) return;
        
        const templateContent = document.getText();
        const analysis = this.analyzeTemplate(templateContent);
        
        this.previewPanel.webview.html = this.getWebviewContent(templateContent, analysis);
    }
    
    private analyzeTemplate(content: string): TemplateAnalysis {
        const placeholderRegex = /@\[([^\]]+)\]@/g;
        const placeholders: string[] = [];
        const placeholderPositions: { name: string; line: number; char: number }[] = [];
        
        let match;
        const lines = content.split('\n');
        
        // Find all placeholders
        lines.forEach((line, lineIndex) => {
            const lineMatches = [...line.matchAll(new RegExp(placeholderRegex.source, 'g'))];
            lineMatches.forEach(m => {
                const placeholderName = m[1].trim();
                placeholders.push(placeholderName);
                placeholderPositions.push({
                    name: placeholderName,
                    line: lineIndex + 1,
                    char: m.index! + 1
                });
            });
        });
        
        // Get unique placeholders
        const uniquePlaceholders = [...new Set(placeholders)];
        
        // Detect template type
        const templateType = this.detectTemplateType(content);
        
        // Generate sample values
        const sampleValues = this.generateSampleValues(uniquePlaceholders);
        
        return {
            placeholders: uniquePlaceholders,
            placeholderPositions,
            templateType,
            sampleValues,
            lineCount: lines.length,
            characterCount: content.length
        };
    }
    
    private detectTemplateType(content: string): string {
        if (content.includes('fn ') && content.includes('->')) return 'Rust Function';
        if (content.includes('struct ') && content.includes('{')) return 'Rust Struct';
        if (content.includes('impl ')) return 'Rust Implementation';
        if (content.includes('mod ')) return 'Rust Module';
        if (content.includes('pub async fn')) return 'Async Function';
        if (content.includes('#[derive(')) return 'Derived Struct';
        if (content.includes('use ') && content.includes('::')) return 'Rust Module with Imports';
        return 'Generic Template';
    }
    
    private generateSampleValues(placeholders: string[]): Record<string, string> {
        const sampleValues: Record<string, string> = {};
        
        placeholders.forEach(placeholder => {
            const lower = placeholder.toLowerCase();
            
            if (lower.includes('name') && lower.includes('function')) {
                sampleValues[placeholder] = 'example_function';
            } else if (lower.includes('name') && lower.includes('struct')) {
                sampleValues[placeholder] = 'ExampleStruct';
            } else if (lower.includes('name') && lower.includes('mod')) {
                sampleValues[placeholder] = 'example_module';
            } else if (lower.includes('name')) {
                sampleValues[placeholder] = 'example_name';
            } else if (lower.includes('type') && lower.includes('return')) {
                sampleValues[placeholder] = 'Result<String, Error>';
            } else if (lower.includes('type')) {
                sampleValues[placeholder] = 'String';
            } else if (lower.includes('param')) {
                sampleValues[placeholder] = 'param: &str';
            } else if (lower.includes('body')) {
                sampleValues[placeholder] = 'todo!(\"Implement this\")';
            } else if (lower.includes('field')) {
                sampleValues[placeholder] = 'pub field: String,';
            } else if (lower.includes('import')) {
                sampleValues[placeholder] = 'use std::collections::HashMap;';
            } else if (lower.includes('content')) {
                sampleValues[placeholder] = '// Generated content here';
            } else if (lower.includes('description')) {
                sampleValues[placeholder] = 'Generated by Tron template engine';
            } else {
                // Generic fallback
                sampleValues[placeholder] = `sample_${placeholder.toLowerCase()}`;
            }
        });
        
        return sampleValues;
    }
    
    private getWebviewContent(templateContent: string, analysis: TemplateAnalysis): string {
        const logoUri = this.previewPanel?.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'branding', 'TRON_logo.png'));
        // The sample values will be editable in the webview. We'll use JS to update the rendered output live.
        // The default values are passed as a JS object.
        const defaultSampleValues = JSON.stringify(analysis.sampleValues);
        const placeholderInputs = analysis.placeholders.map(
            key => `<div class="sample-value"><strong>@[${key}]@</strong> → <input type="text" id="input-${key}" value="${analysis.sampleValues[key] ?? ''}" style="width: 220px;" /></div>`
        ).join('');
        return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Tron Template Preview</title>
            <style>
                body {
                    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                    margin: 0;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .header {
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }
                .tron-logo {
                    height: 40px;
                    width: 40px;
                    border-radius: 8px;
                    background: var(--vscode-sideBar-background);
                    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
                }
                .header-title {
                    font-size: 1.6em;
                    font-weight: bold;
                }
                .template-type {
                    color: var(--vscode-textPreformat-foreground);
                    background: var(--vscode-textBlockQuote-background);
                    padding: 4px 8px;
                    border-radius: 4px;
                    display: inline-block;
                    font-size: 12px;
                }
                .stats {
                    margin: 10px 0;
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                }
                .section {
                    margin: 20px 0;
                }
                .section-title {
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--vscode-textLink-foreground);
                }
                .placeholders {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin: 10px 0;
                }
                .placeholder-tag {
                    background: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 11px;
                }
                .code-block {
                    background: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 15px;
                    margin: 10px 0;
                    overflow-x: auto;
                    white-space: pre;
                    line-height: 1.4;
                }
                .template-source {
                    border-left: 3px solid var(--vscode-textLink-foreground);
                }
                .template-rendered {
                    border-left: 3px solid var(--vscode-testing-iconPassed);
                }
                .placeholder-highlight {
                    background: var(--vscode-editor-findMatchHighlightBackground);
                    border-radius: 2px;
                    padding: 1px 2px;
                }
                .sample-values {
                    font-size: 12px;
                    margin: 10px 0;
                }
                .sample-value {
                    margin: 4px 0;
                    color: var(--vscode-descriptionForeground);
                }
                .refresh-note {
                    font-size: 12px;
                    font-style: italic;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 20px;
                    text-align: center;
                    padding: 10px;
                    background: var(--vscode-notifications-background);
                    border-radius: 4px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <img class="tron-logo" src="${logoUri}" alt="Tron Logo" />
                <span class="header-title">Tron Template Preview</span>
            </div>
            <div class="template-type">${analysis.templateType}</div>
            <div class="stats">
                📊 ${analysis.lineCount} lines • ${analysis.characterCount} characters • ${analysis.placeholders.length} unique placeholders
            </div>

            <div class="section">
                <div class="section-title">📝 Template Source</div>
                <div class="code-block template-source">${this.highlightPlaceholders(templateContent)}</div>
            </div>

            <div class="section">
                <div class="section-title">🏷️ Placeholders (${analysis.placeholders.length})</div>
                <div class="placeholders">
                    ${analysis.placeholders.map(p => `<span class="placeholder-tag">@[${p}]@</span>`).join('')}
                </div>
            </div>

            <div class="section">
                <div class="section-title">🎯 Sample Values</div>
                <div class="sample-values" id="sample-values">
                    ${placeholderInputs}
                </div>
            </div>

            <div class="section">
                <div class="section-title">✨ Rendered Output (with sample values)</div>
                <div class="code-block template-rendered" id="rendered-output"></div>
            </div>

            <div class="refresh-note">
                💡 This preview updates automatically when you modify the template, switch files, or edit sample values
            </div>

            <script>
                const defaultSampleValues = ${defaultSampleValues};
                const templateContent = ${JSON.stringify(templateContent)};
                function renderTemplate(content, values) {
                    let rendered = content;
                    for (const [placeholder, value] of Object.entries(values)) {
                        // Escape regex special characters in placeholder
                        const safePlaceholder = placeholder.replace(/([.*+?^${'${}'}()|[\]\\])/g, '\\$1');
                        const regex = new RegExp('@\\[' + safePlaceholder + '\\]@', 'g');
                        rendered = rendered.replace(regex, value);
                    }
                    return rendered;
                }
                function getCurrentValues() {
                    const values = {};
                    for (const key of Object.keys(defaultSampleValues)) {
                        const input = document.getElementById('input-' + key);
                        values[key] = input && input.value !== '' ? input.value : defaultSampleValues[key];
                    }
                    return values;
                }
                function updateRendered() {
                    const values = getCurrentValues();
                    document.getElementById('rendered-output').textContent = renderTemplate(templateContent, values);
                }
                for (const key of Object.keys(defaultSampleValues)) {
                    const input = document.getElementById('input-' + key);
                    if (input) {
                        input.addEventListener('input', updateRendered);
                    }
                }
                // Initial render
                updateRendered();
            </script>
        </body>
        </html>
        `;
    }
    
    private highlightPlaceholders(content: string): string {
        return content.replace(
            /@\[[^\]]+\]@/g, 
            match => `<span class="placeholder-highlight">${match}</span>`
        );
    }
    
    private renderTemplate(content: string, sampleValues: Record<string, string>): string {
        let rendered = content;
        
        Object.entries(sampleValues).forEach(([placeholder, value]) => {
            const regex = new RegExp(`@\\[${placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]@`, 'g');
            rendered = rendered.replace(regex, value);
        });
        
        return rendered;
    }
}

interface TemplateAnalysis {
    placeholders: string[];
    placeholderPositions: { name: string; line: number; char: number }[];
    templateType: string;
    sampleValues: Record<string, string>;
    lineCount: number;
    characterCount: number;
}