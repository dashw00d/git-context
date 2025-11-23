"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskDetector = void 0;
class RiskDetector {
    /**
     * Analyze a commit and detect risk flags
     */
    detectRisks(files, symbols, edges) {
        const risks = [];
        // Check for breaking changes
        if (this.hasBreakingChanges(symbols.modified)) {
            risks.push('breaking-api');
        }
        // Check for migrations
        if (this.hasMigrations(files)) {
            risks.push('schema-migration');
        }
        // Check for refactors
        if (this.hasRefactor(files, symbols)) {
            risks.push('refactor');
        }
        // Check for security-related changes
        if (this.hasSecurityChanges(files, symbols)) {
            risks.push('security');
        }
        // Check for performance-related changes
        if (this.hasPerformanceChanges(files, symbols)) {
            risks.push('performance');
        }
        // Check for authentication changes
        if (this.hasAuthChanges(files, symbols)) {
            risks.push('auth');
        }
        // Check for payment-related changes
        if (this.hasPaymentChanges(files, symbols)) {
            risks.push('payment');
        }
        return risks;
    }
    /**
     * Check for breaking API changes
     */
    hasBreakingChanges(modifiedSymbols) {
        for (const delta of modifiedSymbols) {
            // Public function/method signature changes
            if ((delta.symbol.kind === 'function' || delta.symbol.kind === 'method') &&
                delta.changeType === 'signature_changed' &&
                this.isPublicSymbol(delta.symbol)) {
                return true;
            }
            // Removed public exports
            if (delta.changeType === 'removed' && this.isPublicSymbol(delta.symbol)) {
                return true;
            }
        }
        return false;
    }
    /**
     * Check for database/schema migrations
     */
    hasMigrations(files) {
        const migrationPatterns = [
            /migration/i,
            /schema/i,
            /database/i,
            /db/i,
            /\.sql$/,
            /alter\s+table/i,
            /create\s+table/i,
            /drop\s+table/i,
            /migration\.php$/,
            /migration\.js$/,
            /migration\.ts$/
        ];
        return files.some(file => {
            const fileName = file.path.toLowerCase();
            return migrationPatterns.some(pattern => pattern.test(fileName));
        });
    }
    /**
     * Check for large refactoring operations
     */
    hasRefactor(files, symbols) {
        // Many files changed
        if (files.length > 10) {
            return true;
        }
        // Many symbols renamed or moved
        const renamedSymbols = symbols.modified.filter(delta => delta.changeType === 'signature_changed' &&
            this.isRename(delta.symbol, delta.previousSymbol));
        if (renamedSymbols.length > 5) {
            return true;
        }
        // Large number of symbol changes
        const totalSymbolChanges = symbols.added.length + symbols.removed.length + symbols.modified.length;
        if (totalSymbolChanges > 20) {
            return true;
        }
        return false;
    }
    /**
     * Check for security-related changes
     */
    hasSecurityChanges(files, symbols) {
        const securityPatterns = [
            /password/i,
            /secret/i,
            /token/i,
            /auth/i,
            /security/i,
            /encrypt/i,
            /decrypt/i,
            /hash/i,
            /ssl/i,
            /tls/i,
            /certificate/i,
            /vulnerability/i,
            /exploit/i
        ];
        // Check file names
        if (files.some(file => securityPatterns.some(pattern => pattern.test(file.path)))) {
            return true;
        }
        // Check symbol names
        const allSymbols = [...symbols.added, ...symbols.modified.map(s => s.symbol)];
        if (allSymbols.some(symbol => securityPatterns.some(pattern => pattern.test(symbol.name)))) {
            return true;
        }
        return false;
    }
    /**
     * Check for performance-related changes
     */
    hasPerformanceChanges(files, symbols) {
        const performancePatterns = [
            /performance/i,
            /optimize/i,
            /cache/i,
            /memory/i,
            /speed/i,
            /latency/i,
            /throughput/i,
            /bottleneck/i,
            /slow/i,
            /fast/i
        ];
        // Check file names
        if (files.some(file => performancePatterns.some(pattern => pattern.test(file.path)))) {
            return true;
        }
        // Check symbol names
        const allSymbols = [...symbols.added, ...symbols.modified.map(s => s.symbol)];
        if (allSymbols.some(symbol => performancePatterns.some(pattern => pattern.test(symbol.name)))) {
            return true;
        }
        return false;
    }
    /**
     * Check for authentication-related changes
     */
    hasAuthChanges(files, symbols) {
        const authPatterns = [
            /auth/i,
            /login/i,
            /logout/i,
            /session/i,
            /user/i,
            /permission/i,
            /role/i,
            /access/i,
            /authenticate/i,
            /authorization/i
        ];
        // Check file names
        if (files.some(file => authPatterns.some(pattern => pattern.test(file.path)))) {
            return true;
        }
        // Check symbol names
        const allSymbols = [...symbols.added, ...symbols.modified.map(s => s.symbol)];
        if (allSymbols.some(symbol => authPatterns.some(pattern => pattern.test(symbol.name)))) {
            return true;
        }
        return false;
    }
    /**
     * Check for payment-related changes
     */
    hasPaymentChanges(files, symbols) {
        const paymentPatterns = [
            /payment/i,
            /billing/i,
            /invoice/i,
            /charge/i,
            /refund/i,
            /stripe/i,
            /paypal/i,
            /checkout/i,
            /transaction/i,
            /money/i,
            /currency/i
        ];
        // Check file names
        if (files.some(file => paymentPatterns.some(pattern => pattern.test(file.path)))) {
            return true;
        }
        // Check symbol names
        const allSymbols = [...symbols.added, ...symbols.modified.map(s => s.symbol)];
        if (allSymbols.some(symbol => paymentPatterns.some(pattern => pattern.test(symbol.name)))) {
            return true;
        }
        return false;
    }
    /**
     * Check if a symbol is public (not private)
     */
    isPublicSymbol(symbol) {
        // Symbols starting with underscore are typically private
        return !symbol.name.startsWith('_');
    }
    /**
     * Check if a symbol change represents a rename
     */
    isRename(current, previous) {
        // Same signature structure but different name
        return current.name !== previous.name &&
            current.signature.replace(current.name, 'X') === previous.signature.replace(previous.name, 'X');
    }
}
exports.RiskDetector = RiskDetector;
//# sourceMappingURL=heuristics.js.map