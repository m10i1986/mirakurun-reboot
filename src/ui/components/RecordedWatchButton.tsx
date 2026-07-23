/*
   Copyright 2026 MINETA "m10i" Hiroki

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
import * as React from "react";
import { useEffect, useState } from "react";
import {
    Button,
    type ButtonProps,
    Menu,
    MenuDivider,
    MenuItem,
    type Placement,
    Popover,
    type PopoverTargetProps,
} from "@blueprintjs/core";
import { copyToClipboard } from "../modules/common";
import { state } from "../modules/state";

type RecordedWatchButtonProps = {
    recordedId: number;
    fileName?: string;
    popoverPlacement?: Placement;
} & Omit<ButtonProps, "onClick">;

/**
 * 録画済みアイテムの視聴メニュー。
 * 録画ファイルをブラウザ単体では再生できないため、外部プレイヤー連携 / URL コピー /
 * M3U プレイリスト書き出しを提供する (生番組向け WatchButton の録画版)。
 */
export const RecordedWatchButton: React.FC<RecordedWatchButtonProps> = ({
    recordedId,
    fileName,
    popoverPlacement,
    ...props
}) => {
    console.debug("components", "RecordedWatchButton");

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            if (state.serverConfig) {
                setLoading(false);
                return;
            }
            await state.fetchServerConfig();
            if (state.serverConfig) {
                setLoading(false);
            }
        })();
    }, []);

    const streamEndpoint = `${location.protocol}//${location.host}/api/recorded/${recordedId}/stream`;
    const tsplayEndpoint = state.serverConfig?.tsplayEndpoint;
    const tsplayEnabled = !!tsplayEndpoint && !!state.serverConfig?.allowPNA;

    const openExternalPlayer = () => {
        if (!tsplayEnabled) {
            return;
        }
        const width = 1280;
        const height = 770;
        const top = window.screenTop + window.innerHeight / 2 - height / 2;
        const left = window.screenLeft + window.innerWidth / 2 - width / 2;
        const features = `noreferrer,popup,width=${width},height=${height},top=${top},left=${left},resizable=yes`;
        window.open(`${tsplayEndpoint}#${streamEndpoint}`, "_blank", features);
    };

    const downloadM3U = () => {
        const label = fileName ?? `recorded_${recordedId}`;
        const m3u8Content = `#EXTM3U\n#EXTINF:-1,${label}\n${streamEndpoint}\n`;
        const blob = new Blob([m3u8Content], { type: "application/x-mpegURL" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Mirakurun_recorded_${recordedId}.m3u8`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    };

    return (
        <Popover
            hasBackdrop={true}
            captureDismiss={true}
            placement={popoverPlacement}
            positioningStrategy="absolute"
            content={
                <Menu>
                    <MenuItem
                        icon="desktop"
                        text="外部プレイヤーで開く"
                        disabled={!tsplayEnabled}
                        onClick={openExternalPlayer}
                    />
                    <MenuDivider />
                    <MenuItem icon="clipboard" text="ストリーム URL をコピー" onClick={() => copyToClipboard(streamEndpoint)} />
                    <MenuItem icon="download" text="M3U プレイリスト..." onClick={downloadM3U} />
                </Menu>
            }
            renderTarget={({ isOpen, ref, ...targetProps }: PopoverTargetProps) => (
                <Button
                    {...props}
                    {...targetProps}
                    active={isOpen}
                    ref={ref}
                    icon="play"
                    intent="primary"
                    title="視聴"
                    className={loading ? "bp5-skeleton" : ""}
                />
            )}
        />
    );
};
