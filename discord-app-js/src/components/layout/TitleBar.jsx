import React, { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "../../styles/titlebar.css";

const TitleBar = () => {
    const [appWindow, setAppWindow] = useState(null);
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        let unlisten = null;
        
        async function setupWindow() {
            try {
                // In Tauri v2, we get the window proxy
                const win = getCurrentWindow();
                setAppWindow(win);

                // Initial check
                const maximized = await win.isMaximized();
                setIsMaximized(maximized);

                // Listen for resizing
                unlisten = await win.onResized(async () => {
                    const maximizedStatus = await win.isMaximized();
                    setIsMaximized(maximizedStatus);
                });
            } catch (err) {
                console.error("Failed to setup Tauri TitleBar. Are you in a browser?", err);
            }
        }

        setupWindow();

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, []);

    const onMinimize = async () => {
        try {
            await appWindow?.minimize();
        } catch (err) {
            console.error("Minimize failed:", err);
        }
    };

    const onMaximize = async () => {
        if (!appWindow) return;
        try {
            if (await appWindow.isMaximized()) {
                await appWindow.unmaximize();
                setIsMaximized(false);
            } else {
                await appWindow.maximize();
                setIsMaximized(true);
            }
        } catch (err) {
            console.error("Maximize operation failed:", err);
        }
    };

    const onClose = async () => {
        try {
            await appWindow?.close();
        } catch (err) {
            console.error("Close failed:", err);
        }
    };

    return (
        <div className="titlebar" onDoubleClick={onMaximize}>
            <div data-tauri-drag-region className="titlebar-drag-region">
                <div className="titlebar-logo-container">
                    <img src="/logo.png" alt="Voxify Logo" className="titlebar-logo" />
                    <span className="titlebar-title-text">Voxify</span>
                </div>
            </div>
            <div className="titlebar-controls">
                <button className="titlebar-button" onClick={onMinimize} title="Küçült">
                    <svg width="10" height="10" viewBox="0 0 12 12">
                        <rect fill="currentColor" width="10" height="1" x="1" y="6"></rect>
                    </svg>
                </button>
                <button className="titlebar-button" onClick={onMaximize} title={isMaximized ? "Eski Boyuta Getir" : "Ekranı Kapla"}>
                    <svg width="10" height="10" viewBox="0 0 12 12">
                        {isMaximized ? (
                            <path
                                fill="none"
                                stroke="currentColor"
                                d="M3.5,3.5 L3.5,1.5 L10.5,1.5 L10.5,8.5 L8.5,8.5 M1.5,3.5 L8.5,3.5 L8.5,10.5 L1.5,10.5 L1.5,3.5 Z"
                            />
                        ) : (
                            <rect
                                width="9"
                                height="9"
                                x="1.5"
                                y="1.5"
                                fill="none"
                                stroke="currentColor"
                            ></rect>
                        )}
                    </svg>
                </button>
                <button className="titlebar-button close" onClick={onClose} title="Kapat">
                    <svg width="10" height="10" viewBox="0 0 12 12">
                        <polygon
                            fill="currentColor"
                            fillRule="evenodd"
                            points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"
                        ></polygon>
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default TitleBar;
