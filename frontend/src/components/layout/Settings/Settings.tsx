import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/store/useAppStore';
import { fetchSettings, saveSettings, browseFolder, restartServer, convertAllToSpz } from '@/api';
import type { ModelFormat } from '@/types';
import styles from './Settings.module.css';

// Folder icon
const FolderIcon = () => (
    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
);

export const Settings: React.FC = () => {
    const { t } = useTranslation();
    const { settingsModalOpen, setSettingsModalOpen, setLoading, serverModelFormat, setServerModelFormat, setLocalModelFormat, effectiveModelFormat, isLocalAccess, isLodEnabled, toggleLod, isHighFidelity, toggleHighFidelity, currentModelId, currentModelUrl, currentModelFormat: storeModelFormat, setCurrentModel } = useAppStore();
    const [workspaceFolder, setWorkspaceFolder] = useState('');
    const [modelFormat, setModelFormat] = useState<ModelFormat>('spz');
    const [isSaving, setIsSaving] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    // Track if workspace_folder changed (needs restart)
    const [originalWorkspace, setOriginalWorkspace] = useState('');

    // Load settings when modal opens
    useEffect(() => {
        if (settingsModalOpen) {
            setModelFormat(effectiveModelFormat());
            loadSettings();
        }
    }, [settingsModalOpen]);

    const loadSettings = async () => {
        try {
            const data = await fetchSettings();
            if (data.workspace_folder) {
                setWorkspaceFolder(data.workspace_folder);
                setOriginalWorkspace(data.workspace_folder);
            }
            // We do not overwrite modelFormat here because effectiveModelFormat() 
            // already handles client-side overrides.
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    };

    const handleClose = () => {
        setSettingsModalOpen(false);
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            handleClose();
        }
    };

    const handleBrowse = async () => {
        try {
            const result = await browseFolder('Select Workspace Folder', workspaceFolder);
            if (result.path) {
                setWorkspaceFolder(result.path);
            }
        } catch (error) {
            console.error('Browse failed:', error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            // For non-local users, simply save format preference to localStorage and close.
            if (!isLocalAccess) {
                setLocalModelFormat(modelFormat);
                handleClose();
                return;
            }

            const payload: Record<string, string> = {};

            // Always save model_format
            if (modelFormat !== serverModelFormat) {
                payload.model_format = modelFormat;
            }

            // Only include workspace if changed
            const workspaceChanged = workspaceFolder !== originalWorkspace;
            if (workspaceChanged) {
                payload.workspace_folder = workspaceFolder;
            }

            // If nothing changed, just close
            if (Object.keys(payload).length === 0) {
                handleClose();
                return;
            }

            const result = await saveSettings(payload);
            if (result.success) {
                // Update store with new format
                if (payload.model_format) {
                    setServerModelFormat(modelFormat);
                    // Local user changing global default, so we can clear their local override
                    setLocalModelFormat(null);
                }

                if (result.needs_restart) {
                    handleClose();
                    setLoading(true, 'Restarting server...');
                    try {
                        await restartServer();
                    } catch {
                        // Restart will close connection, this is expected
                    }
                    setTimeout(() => {
                        window.location.reload();
                    }, 3000);
                } else {
                    handleClose();
                }
            } else {
                alert('Error: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
            alert('Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleConvertAll = async () => {
        setIsConverting(true);
        try {
            const result = await convertAllToSpz();
            if (result.success) {
                const msg = t('convertAllResult', {
                    converted: result.converted,
                    skipped: result.skipped,
                    failed: result.failed,
                    total: result.total
                });
                alert(msg);
            }
        } catch (error) {
            console.error('Batch conversion failed:', error);
            alert('Batch conversion failed');
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <div
            className={`${styles.modal} ${settingsModalOpen ? styles.visible : ''}`}
            onClick={handleBackdropClick}
        >
            <div className={styles.panel}>
                <h3 className={styles.title}>⚙️ {t('settings')}</h3>

                {isLocalAccess && (
                    <div className={styles.group}>
                        <label className={styles.label}>
                            Workspace Folder ({t('workspaceFolder') || '工作目录'})
                        </label>
                        <div className={styles.inputWrapper}>
                            <input
                                type="text"
                                className={styles.input}
                                value={workspaceFolder}
                                onChange={(e) => setWorkspaceFolder(e.target.value)}
                                placeholder="/path/to/workspace"
                            />
                            <button
                                className={styles.browseBtn}
                                onClick={handleBrowse}
                                title="Browse"
                            >
                                <FolderIcon />
                            </button>
                        </div>
                        <p className={styles.hint}>
                            📁 inputs/ ({t('images') || '图片'}) &nbsp;&nbsp; 📁 outputs/ ({t('models') || '模型'})
                        </p>
                    </div>
                )}

                {/* LOD (Level-of-Detail) Toggle */}
                <div className={styles.group}>
                    <label className={styles.label}>
                        {t('lodLabel')}
                    </label>
                    <div className={styles.segmentedControl}>
                        <button
                            className={`${styles.segmentBtn} ${!isLodEnabled ? styles.segmentActive : ''}`}
                            onClick={() => {
                                if (isLodEnabled) {
                                    toggleLod();
                                    if (currentModelId && currentModelUrl) {
                                        const fmt = storeModelFormat;
                                        setCurrentModel(null, null);
                                        setTimeout(() => setCurrentModel(currentModelId, currentModelUrl, fmt), 50);
                                    }
                                }
                            }}
                        >
                            {t('lodOff')}
                        </button>
                        <button
                            className={`${styles.segmentBtn} ${isLodEnabled ? styles.segmentActive : ''}`}
                            onClick={() => {
                                if (!isLodEnabled) {
                                    toggleLod();
                                    if (currentModelId && currentModelUrl) {
                                        const fmt = storeModelFormat;
                                        setCurrentModel(null, null);
                                        setTimeout(() => setCurrentModel(currentModelId, currentModelUrl, fmt), 50);
                                    }
                                }
                            }}
                        >
                            {t('lodOn')}
                        </button>
                    </div>
                    <p className={styles.hint}>
                        {t('lodHint')}
                    </p>
                </div>

                {/* High Fidelity (最高保真度) Toggle */}
                <div className={styles.group}>
                    <label className={styles.label}>
                        {t('highFidelityLabel')}
                    </label>
                    <div className={styles.segmentedControl}>
                        <button
                            className={`${styles.segmentBtn} ${!isHighFidelity ? styles.segmentActive : ''}`}
                            onClick={() => {
                                if (isHighFidelity) {
                                    toggleHighFidelity();
                                    if (currentModelId && currentModelUrl) {
                                        const fmt = storeModelFormat;
                                        setCurrentModel(null, null);
                                        setTimeout(() => setCurrentModel(currentModelId, currentModelUrl, fmt), 50);
                                    }
                                }
                            }}
                        >
                            {t('hfOff')}
                        </button>
                        <button
                            className={`${styles.segmentBtn} ${isHighFidelity ? styles.segmentActive : ''}`}
                            onClick={() => {
                                if (!isHighFidelity) {
                                    toggleHighFidelity();
                                    if (currentModelId && currentModelUrl) {
                                        const fmt = storeModelFormat;
                                        setCurrentModel(null, null);
                                        setTimeout(() => setCurrentModel(currentModelId, currentModelUrl, fmt), 50);
                                    }
                                }
                            }}
                        >
                            {t('hfOn')}
                        </button>
                    </div>
                    <p className={styles.hint}>
                        {t('hfHint')}
                    </p>
                </div>

                {/* Model Format Preference */}
                <div className={styles.group}>
                    <label className={styles.label}>
                        {t('modelFormatLabel')}
                    </label>
                    <div className={styles.segmentedControl}>
                        <button
                            className={`${styles.segmentBtn} ${modelFormat === 'spz' ? styles.segmentActive : ''}`}
                            onClick={() => setModelFormat('spz')}
                        >
                            SPZ {t('formatCompact')}
                        </button>
                        <button
                            className={`${styles.segmentBtn} ${modelFormat === 'ply' ? styles.segmentActive : ''}`}
                            onClick={() => setModelFormat('ply')}
                        >
                            PLY {t('formatOriginal')}
                        </button>
                    </div>
                    <p className={styles.hint}>
                        {t('modelFormatHint')}
                    </p>
                </div>

                {/* Batch Convert */}
                <div className={styles.group}>
                    <button
                        className={styles.convertBtn}
                        onClick={handleConvertAll}
                        disabled={isConverting}
                    >
                        {isConverting ? '⏳ ' + t('converting') : '📦 ' + t('convertAllToSpz')}
                    </button>
                </div>

                {isLocalAccess && workspaceFolder !== originalWorkspace && (
                    <p className={styles.warning}>
                        ⚠️ {t('settingsRestartWarning') || '修改工作目录后需重启服务器生效'}
                    </p>
                )}

                <div className={styles.actions}>
                    <button className={styles.cancelBtn} onClick={handleClose}>
                        {t('cancel')}
                    </button>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={isSaving}
                    >
                        {isSaving ? '...' : t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
