import * as vscode from 'vscode';
import { TronTemplateProvider } from './templateProvider';
import { TronValidator } from './validator';
import { TronPreview } from './preview';

let diagnosticCollection: vscode.DiagnosticCollection;

export function activate(context: vscode.ExtensionContext) {
    console.log('Tron Template Engine extension is now active!');

    // Create diagnostic collection for validation errors
    diagnosticCollection = vscode.languages.createDiagnosticCollection('tron');
    context.subscriptions.push(diagnosticCollection);

    // Initialize components
    const templateProvider = new TronTemplateProvider();
    const validator = new TronValidator(diagnosticCollection);
    const preview = new TronPreview(context);

    // Register commands
    const validateCommand = vscode.commands.registerCommand('tron.validateTemplate', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            validator.validateDocument(editor.document);
            vscode.window.showInformationMessage('Template validation completed!');
        }
    });

    const previewCommand = vscode.commands.registerCommand('tron.previewTemplate', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            preview.showPreview(editor.document);
        }
    });

    const insertSnippetCommand = vscode.commands.registerCommand('tron.insertSnippet', async () => {
        const snippets = [
            { label: 'Function Template', detail: 'tron-fn', description: 'Rust function with Tron placeholders' },
            { label: 'Struct Template', detail: 'tron-struct', description: 'Rust struct with Tron placeholders' },
            { label: 'Module Template', detail: 'tron-mod', description: 'Rust module with Tron placeholders' },
            { label: 'API Handler Template', detail: 'tron-api', description: 'Async REST API handler' },
            { label: 'Database Model Template', detail: 'tron-db', description: 'CRUD database model' }
        ];

        const selected = await vscode.window.showQuickPick(snippets, {
            placeHolder: 'Select a Tron template snippet'
        });

        if (selected && vscode.window.activeTextEditor) {
            await vscode.commands.executeCommand('editor.action.insertSnippet', {
                name: selected.detail
            });
        }
    });

    // Register providers
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'tron' },
            templateProvider,
            '@', '[', ']'
        )
    );

    // Auto-validate on document changes
    const validateOnChange = vscode.workspace.onDidChangeTextDocument(event => {
        if (event.document.languageId === 'tron') {
            // Debounce validation to avoid excessive calls
            setTimeout(() => {
                validator.validateDocument(event.document);
            }, 500);
        }
    });

    // Validate when opening Tron files
    const validateOnOpen = vscode.workspace.onDidOpenTextDocument(document => {
        if (document.languageId === 'tron') {
            validator.validateDocument(document);
        }
    });

    // Register subscriptions
    context.subscriptions.push(
        validateCommand,
        previewCommand,
        insertSnippetCommand,
        validateOnChange,
        validateOnOpen
    );

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(file-code) Tron";
    statusBarItem.tooltip = "Tron Template Engine";
    statusBarItem.command = 'tron.validateTemplate';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Show welcome message
    vscode.window.showInformationMessage('Tron Template Engine extension loaded successfully!');
}

export function deactivate() {
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}