import { SymbolChangeType } from '../../types/cockpit';

export const formatDate = (value?: string | null) => {
    if (!value) return '';
    try {
        return new Date(value).toLocaleDateString();
    } catch {
        return value;
    }
};

export const getSymbolKindIcon = (kind: string): string => {
    const iconMap: Record<string, string> = {
        function: 'symbol-function',
        method: 'symbol-method',
        class: 'symbol-class',
        interface: 'symbol-interface',
        enum: 'symbol-enum',
        constant: 'symbol-constant',
        variable: 'symbol-variable',
        property: 'symbol-property',
        component: 'symbol-component',
        type: 'symbol-type'
    };
    return iconMap[kind.toLowerCase()] || 'symbol-misc';
};

export const getChangeTypeBadge = (changeType?: SymbolChangeType): string => {
    if (!changeType) return '';
    const badges: Record<SymbolChangeType, string> = {
        added: '➕',
        modified: '✏️',
        removed: '➖'
    };
    return badges[changeType] || '';
};
