import * as vscode from 'vscode';

export class TronTemplateProvider implements vscode.CompletionItemProvider {
    
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // Check if we're typing a placeholder
        if (linePrefix.endsWith('@[') || linePrefix.includes('@[') && !linePrefix.includes(']@')) {
            return this.getPlaceholderCompletions();
        }
        
        // Check if we're typing after @
        if (linePrefix.endsWith('@')) {
            return this.getTemplateStartCompletions();
        }
        
        // General template completions
        return this.getGeneralCompletions();
    }
    
    private getPlaceholderCompletions(): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];
        
        // Common placeholder patterns
        const placeholders = [
            { name: 'function_name', description: 'Name of a function' },
            { name: 'struct_name', description: 'Name of a struct' },
            { name: 'module_name', description: 'Name of a module' },
            { name: 'variable_name', description: 'Name of a variable' },
            { name: 'type_name', description: 'Name of a type' },
            { name: 'parameters', description: 'Function parameters' },
            { name: 'return_type', description: 'Function return type' },
            { name: 'body', description: 'Function or block body' },
            { name: 'fields', description: 'Struct fields' },
            { name: 'methods', description: 'Impl block methods' },
            { name: 'imports', description: 'Import statements' },
            { name: 'content', description: 'Generic content' },
            { name: 'description', description: 'Documentation description' },
            { name: 'error_type', description: 'Error type' },
            { name: 'success_type', description: 'Success type' }
        ];
        
        placeholders.forEach(placeholder => {
            const item = new vscode.CompletionItem(placeholder.name, vscode.CompletionItemKind.Variable);
            item.detail = `Tron placeholder: ${placeholder.name}`;
            item.documentation = placeholder.description;
            item.insertText = `${placeholder.name}]@`;
            completions.push(item);
        });
        
        return completions;
    }
    
    private getTemplateStartCompletions(): vscode.CompletionItem[] {
        const item = new vscode.CompletionItem('[placeholder]@', vscode.CompletionItemKind.Snippet);
        item.detail = 'Tron placeholder';
        item.documentation = 'Create a new Tron template placeholder';
        item.insertText = new vscode.SnippetString('[${1:placeholder_name}]@');
        
        return [item];
    }
    
    private getGeneralCompletions(): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];
        
        // Template snippets
        const templates = [
            {
                name: 'fn template',
                snippet: 'fn @[${1:function_name}]@(${2:@[parameters]@}) -> ${3:@[return_type]@} {\n    ${4:@[body]@}\n}',
                description: 'Function template with placeholders'
            },
            {
                name: 'struct template',
                snippet: '#[derive(${1:Debug})]\npub struct @[${2:struct_name}]@ {\n    ${3:@[fields]@}\n}',
                description: 'Struct template with placeholders'
            },
            {
                name: 'impl template',
                snippet: 'impl @[${1:struct_name}]@ {\n    ${2:@[methods]@}\n}',
                description: 'Impl block template with placeholders'
            },
            {
                name: 'mod template',
                snippet: 'pub mod @[${1:module_name}]@ {\n    ${2:@[imports]@}\n\n    ${3:@[content]@}\n}',
                description: 'Module template with placeholders'
            }
        ];
        
        templates.forEach(template => {
            const item = new vscode.CompletionItem(template.name, vscode.CompletionItemKind.Snippet);
            item.detail = 'Tron template';
            item.documentation = template.description;
            item.insertText = new vscode.SnippetString(template.snippet);
            completions.push(item);
        });
        
        return completions;
    }
}