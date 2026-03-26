import React, { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store';
import styles from './SpeedTooltip.module.css';

export type SpeedMode = 'fast' | 'precision' | null;

interface SpeedTooltipProps {
    mode: SpeedMode;
}

export const SpeedTooltip: React.FC<SpeedTooltipProps> = ({ mode }) => {
    const { t } = useTranslation();
    const sidebarCollapsed = useAppStore(state => state.sidebarCollapsed);
    
    // Keep track of the last non-null mode to prevent content flash during fadeout
    const lastModeRef = useRef<'fast' | 'precision'>('fast');
    
    useEffect(() => {
        if (mode) {
            lastModeRef.current = mode;
        }
    }, [mode]);
    
    // Use current mode if available, otherwise use last mode for fadeout
    const displayMode = mode || lastModeRef.current;
    const content = displayMode === 'fast' 
        ? `⚡ ${t('fastMode')}`
        : `🔍 ${t('precisionMode')}`;
    
    return (
        <div className={`${styles.tooltip} ${mode ? styles.visible : ''} ${!sidebarCollapsed ? styles.sidebarExpanded : ''}`}>
            {content}
        </div>
    );
};
