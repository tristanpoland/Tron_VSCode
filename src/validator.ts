import * as vscode from 'vscode';

export class TronValidator {
    private diagnosticCollection: vscode.DiagnosticCollection;
    
    constructor(diagnosticCollection: vscode.DiagnosticCollection) {
        this.diagnosticCollection = diagnosticCollection;
    }
    
    validateDocument(document: vscode.TextDocument): void {
        if (document.languageId !== 'tron') {
            return;
        }
        
        const diagnostics: vscode.Diagnostic[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        // Get configuration
        const config = vscode.workspace.getConfiguration('tron.validation');
        const minPlaceholderLength = config.get<number>('minPlaceholderLength', 2);
        const validationEnabled = config.get<boolean>('enabled', true);
        const checkTrailingWhitespace = config.get<boolean>('checkTrailingWhitespace', false);
        
        if (!validationEnabled) {
            this.diagnosticCollection.set(document.uri, []);
            return;
        }
        
        // Validate each line
        lines.forEach((line, lineIndex) => {
            // Check for malformed placeholders
            this.checkMalformedPlaceholders(line, lineIndex, diagnostics);
            
            // Check placeholder naming conventions
            this.checkPlaceholderNaming(line, lineIndex, diagnostics, minPlaceholderLength);
            
            // Check for common issues
            this.checkCommonIssues(line, lineIndex, diagnostics, checkTrailingWhitespace);
        });
        
        // Check for unused placeholders (simplified)
        this.checkUnusedPlaceholders(text, diagnostics);
        
        this.diagnosticCollection.set(document.uri, diagnostics);
    }
    
    private checkMalformedPlaceholders(line: string, lineIndex: number, diagnostics: vscode.Diagnostic[]): void {
        // Check for empty placeholders
        const emptyPlaceholderRegex = /@\[\s*\]@/g;
        let match;
        while ((match = emptyPlaceholderRegex.exec(line)) !== null) {
            const range = new vscode.Range(
                lineIndex,
                match.index,
                lineIndex,
                match.index + match[0].length
            );
            diagnostics.push(new vscode.Diagnostic(
                range,
                'Empty placeholder detected',
                vscode.DiagnosticSeverity.Error
            ));
        }
        
        // Check for unmatched @ symbols
        const unmatchedAtRegex = /@@|@\[|\]@/g;
        const matches = line.match(unmatchedAtRegex) || [];
        const openCount = matches.filter(m => m === '@[').length;
        const closeCount = matches.filter(m => m === ']@').length;
        const doubleAt = matches.filter(m => m === '@@').length;
        
        if (openCount !== closeCount) {
            const range = new vscode.Range(lineIndex, 0, lineIndex, line.length);
            diagnostics.push(new vscode.Diagnostic(
                range,
                'Unmatched placeholder brackets',
                vscode.DiagnosticSeverity.Error
            ));
        }
        
        if (doubleAt > 0) {
            let index = line.indexOf('@@');
            while (index !== -1) {
                const range = new vscode.Range(lineIndex, index, lineIndex, index + 2);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Double @ symbols detected - possible malformed placeholder',
                    vscode.DiagnosticSeverity.Warning
                ));
                index = line.indexOf('@@', index + 1);
            }
        }
    }
    
    private checkPlaceholderNaming(
        line: string, 
        lineIndex: number, 
        diagnostics: vscode.Diagnostic[], 
        minLength: number
    ): void {
        const placeholderRegex = /@\[([^\]]+)\]@/g;
        let match;
        
        while ((match = placeholderRegex.exec(line)) !== null) {
            const placeholderName = match[1].trim();
            const placeholderStart = match.index + 2; // After '@['
            const placeholderEnd = placeholderStart + placeholderName.length;
            
            // Check minimum length
            if (placeholderName.length < minLength) {
                const range = new vscode.Range(
                    lineIndex,
                    placeholderStart,
                    lineIndex,
                    placeholderEnd
                );
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Placeholder name '${placeholderName}' is shorter than minimum length of ${minLength}`,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            
            // Check naming conventions
            if (placeholderName.includes(' ')) {
                const range = new vscode.Range(
                    lineIndex,
                    placeholderStart,
                    lineIndex,
                    placeholderEnd
                );
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Placeholder name '${placeholderName}' contains spaces`,
                    vscode.DiagnosticSeverity.Error
                ));
            }
            
            // Check for uppercase (suggest snake_case)
            if (placeholderName.match(/[A-Z]/)) {
                const range = new vscode.Range(
                    lineIndex,
                    placeholderStart,
                    lineIndex,
                    placeholderEnd
                );
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Consider using snake_case for placeholder '${placeholderName}'`,
                    vscode.DiagnosticSeverity.Information
                ));
            }
            
            // Check for numbers-only names
            if (/^\d+$/.test(placeholderName)) {
                const range = new vscode.Range(
                    lineIndex,
                    placeholderStart,
                    lineIndex,
                    placeholderEnd
                );
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    `Placeholder '${placeholderName}' consists only of numbers - consider using descriptive names`,
                    vscode.DiagnosticSeverity.Information
                ));
            }
        }
    }
    
    private checkCommonIssues(line: string, lineIndex: number, diagnostics: vscode.Diagnostic[], checkTrailingWhitespace: boolean): void {
        // Check for trailing whitespace (only if enabled in config)
        if (checkTrailingWhitespace && line.match(/\s+$/)) {
            const trimmedLength = line.trimEnd().length;
            const range = new vscode.Range(
                lineIndex,
                trimmedLength,
                lineIndex,
                line.length
            );
            diagnostics.push(new vscode.Diagnostic(
                range,
                'Trailing whitespace detected',
                vscode.DiagnosticSeverity.Information
            ));
        }
        
        // Check for potential security issues
        const securityPatterns = [
            { pattern: /eval\s*\(/i, message: 'Potential security risk: eval() usage' },
            { pattern: /password\s*=\s*[\"'][^\"']*[\"']/i, message: 'Potential hardcoded password' },
            { pattern: /api_?key\s*=\s*[\"'][^\"']*[\"']/i, message: 'Potential hardcoded API key' },
            { pattern: /<script/i, message: 'Potential XSS risk: script tag' }
        ];
        
        securityPatterns.forEach(({ pattern, message }) => {
            const match = line.match(pattern);
            if (match) {
                const index = line.indexOf(match[0]);
                const range = new vscode.Range(
                    lineIndex,
                    index,
                    lineIndex,
                    index + match[0].length
                );
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    message,
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        });
    }
    
    private checkUnusedPlaceholders(text: string, diagnostics: vscode.Diagnostic[]): void {
        // This is a simplified check - in a real implementation,
        // you'd integrate with the actual Tron validator
        const placeholderRegex = /@\[([^\]]+)\]@/g;
        const placeholders = new Set<string>();
        let match;
        
        while ((match = placeholderRegex.exec(text)) !== null) {
            placeholders.add(match[1].trim());
        }
        
        // For demonstration, flag single-letter placeholders as potentially unused
        placeholders.forEach(placeholder => {
            if (placeholder.length === 1) {
                // Find first occurrence for diagnostic location
                const firstOccurrence = text.indexOf(`@[${placeholder}]@`);
                if (firstOccurrence !== -1) {
                    const lines = text.substring(0, firstOccurrence).split('\n');
                    const lineIndex = lines.length - 1;
                    const charIndex = lines[lines.length - 1].length + 2; // After '@['
                    
                    const range = new vscode.Range(
                        lineIndex,
                        charIndex,
                        lineIndex,
                        charIndex + placeholder.length
                    );
                    
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        `Single-letter placeholder '${placeholder}' might be unclear`,
                        vscode.DiagnosticSeverity.Information
                    ));
                }
            }
        });
    }
}