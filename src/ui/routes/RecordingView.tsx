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
import { useState, useEffect } from "react";
import { Alignment, Breadcrumbs, Navbar, NonIdealState, NonIdealStateProps, Section, Button, Dialog, DialogBody, DialogFooter, Tooltip, Icon, ProgressBar, Checkbox, HTMLSelect } from "@blueprintjs/core";
import { DateTime } from "luxon";
import { useLocalStorageState } from "../hooks/useWebStorageState";
import { RecordedWatchButton } from "../components/RecordedWatchButton";
import { LazyCaller } from "../modules/common";
import { state } from "../modules/state";
import * as ui from "../modules/ui";
import { Reserve, Recorded, ReserveState, RecordedState, EncodeItem, EncodeState, Error as ApiError } from "../../../api.d";

import "./RecordingView.sass";

type DialogType = "cancel_reserve" | "remove_reserve" | "delete_recorded" | "encode_recorded" | "cancel_encode";

// エンコーダー未設定時のフォールバック (Recording/config.ts の DEFAULT_ENCODERS の名前と対応)
const FALLBACK_ENCODER_NAME = "H.264";

function getEncoderNames(): string[] {
    const encoders = state.serverConfig?.recording?.encoders;
    if (encoders && encoders.length > 0) {
        return encoders.map((e) => e.name);
    }
    return [FALLBACK_ENCODER_NAME];
}

function downloadRecorded(item: Recorded): void {
    const a = document.createElement("a");
    a.href = `/api/recorded/${item.id}/file`;
    // ファイル名はサーバーの Content-Disposition に従う
    a.setAttribute("download", "");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

export const RecordingView: React.FC = () => {
    console.debug("routes", "RecordingView");

    const { navigate } = state;

    const [nonIdealState, setNonIdealState] = useState<NonIdealStateProps | null>(null);
    const [reload, setReload] = useState<number>(0);
    const [reservesIsOpen, setReservesIsOpen] = useLocalStorageState<boolean>("RecordingView.reservesIsOpen", true);
    const [historyIsOpen, setHistoryIsOpen] = useLocalStorageState<boolean>("RecordingView.historyIsOpen", true);
    const [recordedIsOpen, setRecordedIsOpen] = useLocalStorageState<boolean>("RecordingView.recordedIsOpen", true);
    const [encodesIsOpen, setEncodesIsOpen] = useLocalStorageState<boolean>("RecordingView.encodesIsOpen", true);
    const [reserveItems, setReserveItems] = useState<JSX.Element[]>([]);
    const [historyItems, setHistoryItems] = useState<JSX.Element[]>([]);
    const [recordedItems, setRecordedItems] = useState<JSX.Element[]>([]);
    const [encodeItems, setEncodeItems] = useState<JSX.Element[]>([]);

    // 確認ダイアログ
    const [isDialogOpen, setIsDialogOpen] = useState<boolean>(false);
    const [dialogType, setDialogType] = useState<DialogType | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [isActionLoading, setIsActionLoading] = useState<boolean>(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // エンコード開始ダイアログ用
    const [selectedEncoder, setSelectedEncoder] = useState<string>("");
    const [removeOriginal, setRemoveOriginal] = useState<boolean>(false);

    ui.setTitle("録画");

    const requestAction = async (method: string, path: string): Promise<boolean> => {
        try {
            const res = await fetch(path, {
                method,
                headers: { "Content-Type": "application/json" },
            });

            if (!res.ok) {
                let reason = `Error: ${res.status}`;
                try {
                    const errorData = await res.json() as ApiError;
                    reason = errorData.reason || reason;
                } catch {
                    // ボディなし (204 等) はそのまま
                }
                setActionError(reason);
                return false;
            }

            await state.fetchReserves();
            await state.fetchRecorded();
            await state.fetchEncodes();
            setActionError(null);
            return true;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setActionError(`リクエスト失敗: ${message}`);
            return false;
        }
    };

    const handleConfirm = async () => {
        if (dialogType === null || selectedId === null) {
            return;
        }
        setIsActionLoading(true);
        let success = false;

        try {
            if (dialogType === "cancel_reserve") {
                success = await requestAction("PUT", `/api/reserves/${selectedId}/cancel`);
            } else if (dialogType === "remove_reserve") {
                success = await requestAction("DELETE", `/api/reserves/${selectedId}`);
            } else if (dialogType === "delete_recorded") {
                success = await requestAction("DELETE", `/api/recorded/${selectedId}`);
            } else if (dialogType === "encode_recorded") {
                const params = new URLSearchParams({
                    encoder: selectedEncoder,
                    removeOriginal: String(removeOriginal),
                });
                success = await requestAction("POST", `/api/recorded/${selectedId}/encode?${params.toString()}`);
            } else if (dialogType === "cancel_encode") {
                success = await requestAction("DELETE", `/api/encode/${selectedId}`);
            }

            if (success) {
                setIsDialogOpen(false);
                setDialogType(null);
                setSelectedId(null);
            }
        } finally {
            setIsActionLoading(false);
        }
    };

    const openDialog = (type: DialogType, id: number) => {
        setActionError(null);
        setDialogType(type);
        setSelectedId(id);
        if (type === "encode_recorded") {
            setSelectedEncoder(getEncoderNames()[0] ?? "");
            setRemoveOriginal(false);
        }
        setIsDialogOpen(true);
    };

    useEffect(() => {
        // エンコーダー選択肢のため server config を確保しておく
        if (!state.serverConfig) {
            state.fetchServerConfig();
        }

        const onUpdated = () => {
            setReload(Date.now());
        };
        const onUpdatedLazy = new LazyCaller(0, 500, onUpdated);
        state.on("reserves", onUpdatedLazy.caller);
        state.on("recorded", onUpdatedLazy.caller);
        state.on("encode", onUpdatedLazy.caller);
        state.on("services", onUpdatedLazy.caller);

        return () => {
            state.off("reserves", onUpdatedLazy.caller);
            state.off("recorded", onUpdatedLazy.caller);
            state.off("encode", onUpdatedLazy.caller);
            state.off("services", onUpdatedLazy.caller);
            onUpdatedLazy.destroy();
        };
    }, []);

    useEffect(() => {
        const reserves = [...state.reserves].sort((a, b) => a.program.startAt - b.program.startAt);
        const active = reserves.filter((r) => r.state === "reserved" || r.state === "recording");
        const history = reserves
            .filter((r) => r.state !== "reserved" && r.state !== "recording")
            .sort((a, b) => b.program.startAt - a.program.startAt);
        const recorded = [...state.recorded].sort((a, b) => b.startAt - a.startAt);
        const encodes = [...state.encodes].sort((a, b) => b.id - a.id);

        setReserveItems(active.map((reserve) => createReserveItem(reserve)));
        setHistoryItems(history.map((reserve) => createReserveItem(reserve)));
        setRecordedItems(recorded.map((item) => createRecordedItem(item)));
        setEncodeItems(encodes.map((item) => createEncodeItem(item)));

        if (active.length === 0 && history.length === 0 && recorded.length === 0 && encodes.length === 0) {
            setNonIdealState({
                icon: "mobile-video",
                title: "録画はありません",
                description: "EPG の番組詳細から「予約」すると、ここに表示されます。",
            });
        } else {
            setNonIdealState(null);
        }
    }, [reload]);

    const createReserveItem = (reserve: Reserve) => {
        const program = reserve.program;
        const serviceName = getServiceName(program.networkId, program.serviceId);
        const startAt = program.startAt;
        const endAt = program.startAt + program.duration;
        const stateLabel = getReserveStateLabel(reserve.state);
        const canCancel = reserve.state === "reserved" || reserve.state === "recording";

        return (
            <Navbar key={reserve.id}>
                <Navbar.Group align={Alignment.START}>
                    <Icon icon={getReserveStateIcon(reserve.state)} intent={getReserveStateIntent(reserve.state)} title={stateLabel} />
                    <span
                        className="reserve-name"
                        style={{ marginLeft: "0.5rem", cursor: "pointer" }}
                        title="番組詳細を開く"
                        onClick={() => navigate?.(`/epg/programs/${program.id}`)}
                    >
                        {program.name || `event${program.eventId}`}
                    </span>
                    {serviceName && (
                        <span className="bp5-text-muted" style={{ marginLeft: "0.5rem" }}>
                            {serviceName}
                        </span>
                    )}
                </Navbar.Group>

                <Navbar.Group align={Alignment.END}>
                    <span className="bp5-text-muted" style={{ marginRight: "0.5rem" }}>
                        {DateTime.fromMillis(startAt).toFormat("MM/dd HH:mm")}〜{DateTime.fromMillis(endAt).toFormat("HH:mm")}
                    </span>

                    {canCancel ? (
                        <Button
                            variant="minimal"
                            small
                            icon="cross"
                            intent="warning"
                            title={reserve.state === "recording" ? "録画を停止 (キャンセル)" : "予約をキャンセル"}
                            onClick={() => openDialog("cancel_reserve", reserve.id)}
                        />
                    ) : (
                        <Button
                            variant="minimal"
                            small
                            icon="trash"
                            intent="danger"
                            title="予約エントリを削除"
                            onClick={() => openDialog("remove_reserve", reserve.id)}
                        />
                    )}
                </Navbar.Group>
            </Navbar>
        );
    };

    const createRecordedItem = (item: Recorded) => {
        // エンコード済み出力 (sourceRecordedId 有り) で、かつ元の MPEG2-TS が削除済みの場合は再エンコードを禁止する
        const reEncodeForbidden =
            item.sourceRecordedId !== undefined &&
            state.recorded.find((r) => r.id === item.sourceRecordedId) === undefined;
        return (
            <Navbar key={item.id}>
                <Navbar.Group align={Alignment.START}>
                    <Icon icon={getRecordedStateIcon(item.state)} intent={getRecordedStateIntent(item.state)} title={getRecordedStateLabel(item.state)} />
                    <span className="recorded-name" style={{ marginLeft: "0.5rem" }} title={item.filePath}>
                        {item.name}
                    </span>
                    {item.serviceName && (
                        <span className="bp5-text-muted" style={{ marginLeft: "0.5rem" }}>
                            {item.serviceName}
                        </span>
                    )}
                </Navbar.Group>

                <Navbar.Group align={Alignment.END}>
                    <span className="bp5-text-muted" style={{ marginRight: "0.5rem" }}>
                        {formatFileSize(item.fileSize)}
                    </span>
                    <Tooltip content={DateTime.fromMillis(item.startAt).toFormat("yyyy/MM/dd HH:mm:ss")}>
                        <span className="bp5-text-muted" style={{ marginRight: "0.5rem" }}>
                            {DateTime.fromMillis(item.startAt).toRelative()}
                        </span>
                    </Tooltip>
                    <RecordedWatchButton
                        recordedId={item.id}
                        fileName={item.name}
                        variant="minimal"
                        small
                        disabled={item.state !== "finished"}
                        popoverPlacement="bottom-end"
                    />
                    <Button
                        variant="minimal"
                        small
                        icon="cog"
                        title={reEncodeForbidden ? "再エンコード不可 (元のMPEG2-TSが削除済み)" : "エンコード"}
                        disabled={item.state !== "finished" || reEncodeForbidden}
                        onClick={() => openDialog("encode_recorded", item.id)}
                    />
                    <Button
                        variant="minimal"
                        small
                        icon="download"
                        title="ダウンロード"
                        disabled={item.state === "recording"}
                        onClick={() => downloadRecorded(item)}
                    />
                    <Button
                        variant="minimal"
                        small
                        icon="trash"
                        intent="danger"
                        title="録画ファイルごと削除"
                        disabled={item.state === "recording"}
                        onClick={() => openDialog("delete_recorded", item.id)}
                    />
                </Navbar.Group>
            </Navbar>
        );
    };

    const createEncodeItem = (item: EncodeItem) => {
        const recorded = state.recorded.find((r) => r.id === item.recordedId);
        const name = recorded?.name ?? `recorded#${item.recordedId}`;
        const canCancel = item.state === "waiting" || item.state === "encoding";

        return (
            <Navbar key={item.id}>
                <Navbar.Group align={Alignment.START}>
                    <Icon
                        icon={getEncodeStateIcon(item.state)}
                        intent={getEncodeStateIntent(item.state)}
                        title={getEncodeStateLabel(item.state)}
                    />
                    <span className="recorded-name" style={{ marginLeft: "0.5rem" }} title={item.error}>
                        {name}
                    </span>
                    <span className="bp5-text-muted" style={{ marginLeft: "0.5rem" }}>
                        {item.encoderName}
                    </span>
                </Navbar.Group>

                <Navbar.Group align={Alignment.END}>
                    {item.state === "encoding" ? (
                        <div style={{ width: "120px", marginRight: "0.5rem" }}>
                            <ProgressBar value={item.progress} intent="primary" stripes={false} />
                        </div>
                    ) : (
                        <span className="bp5-text-muted" style={{ marginRight: "0.5rem" }}>
                            {getEncodeStateLabel(item.state)}
                        </span>
                    )}
                    {canCancel && (
                        <Button
                            variant="minimal"
                            small
                            icon="cross"
                            intent="warning"
                            title="エンコードをキャンセル"
                            onClick={() => openDialog("cancel_encode", item.id)}
                        />
                    )}
                </Navbar.Group>
            </Navbar>
        );
    };

    return (
        <div className="route" id="route-recording-view">
            <Navbar className="toolbar">
                <Navbar.Group align={Alignment.START}>
                    <Navbar.Heading>
                        <Breadcrumbs items={[
                            {
                                text: "録画"
                            }
                        ]} />
                    </Navbar.Heading>
                </Navbar.Group>

                <Navbar.Group align={Alignment.END}>
                </Navbar.Group>
            </Navbar>

            <div className="content">
                {!nonIdealState && <>
                    <Section
                        title={`予約 (${reserveItems.length})`}
                        icon="calendar"
                        collapsible
                        collapseProps={{
                            isOpen: reservesIsOpen,
                            onToggle: () => setReservesIsOpen(!reservesIsOpen),
                        }}
                        compact
                    >
                        {reserveItems.length > 0
                            ? reserveItems.map((item) => item)
                            : <div className="empty-row bp5-text-muted">予約中の番組はありません</div>}
                    </Section>

                    {historyItems.length > 0 && (
                        <Section
                            title={`履歴 (${historyItems.length})`}
                            icon="history"
                            collapsible
                            collapseProps={{
                                isOpen: historyIsOpen,
                                onToggle: () => setHistoryIsOpen(!historyIsOpen),
                            }}
                            compact
                        >
                            {historyItems.map((item) => item)}
                        </Section>
                    )}

                    {encodeItems.length > 0 && (
                        <Section
                            title={`エンコード (${encodeItems.length})`}
                            icon="cog"
                            collapsible
                            collapseProps={{
                                isOpen: encodesIsOpen,
                                onToggle: () => setEncodesIsOpen(!encodesIsOpen),
                            }}
                            compact
                        >
                            {encodeItems.map((item) => item)}
                        </Section>
                    )}

                    <Section
                        title={`録画済み (${recordedItems.length})`}
                        icon="mobile-video"
                        collapsible
                        collapseProps={{
                            isOpen: recordedIsOpen,
                            onToggle: () => setRecordedIsOpen(!recordedIsOpen),
                        }}
                        compact
                    >
                        {recordedItems.length > 0
                            ? recordedItems.map((item) => item)
                            : <div className="empty-row bp5-text-muted">録画済みファイルはありません</div>}
                    </Section>
                </>}

                {nonIdealState && <>
                    <NonIdealState {...nonIdealState} />
                </>}
            </div>

            <Dialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                title={
                    dialogType === "cancel_reserve" ? "予約キャンセル" :
                    dialogType === "remove_reserve" ? "予約削除" :
                    dialogType === "delete_recorded" ? "録画削除" :
                    dialogType === "encode_recorded" ? "エンコード" :
                    dialogType === "cancel_encode" ? "エンコードキャンセル" :
                    "確認"
                }
                canEscapeKeyClose={!isActionLoading}
            >
                <DialogBody>
                    {actionError && (
                        <div className="bp5-text-intent-danger" style={{ marginBottom: "16px" }}>
                            {actionError}
                        </div>
                    )}
                    <div>
                        {dialogType === "cancel_reserve" && "この予約をキャンセルしてもよろしいですか？（録画中の場合は停止します）"}
                        {dialogType === "remove_reserve" && "この予約エントリを削除してもよろしいですか？"}
                        {dialogType === "delete_recorded" && "この録画を録画ファイルごと削除してもよろしいですか？この操作は取り消せません。"}
                        {dialogType === "cancel_encode" && "このエンコードをキャンセルしてもよろしいですか？"}
                        {dialogType === "encode_recorded" && (
                            <>
                                <p>この録画をエンコードします。エンコード結果は新しい録画済みとして追加されます。</p>
                                <label className="bp5-label">
                                    エンコーダー
                                    <HTMLSelect
                                        fill
                                        value={selectedEncoder}
                                        onChange={(e) => setSelectedEncoder(e.currentTarget.value)}
                                    >
                                        {getEncoderNames().map((encoderName) => (
                                            <option key={encoderName} value={encoderName}>
                                                {encoderName}
                                            </option>
                                        ))}
                                    </HTMLSelect>
                                </label>
                                <Checkbox
                                    checked={removeOriginal}
                                    label="エンコード後に元の録画ファイルを削除する"
                                    onChange={(e) => setRemoveOriginal(e.currentTarget.checked)}
                                    style={{ marginTop: "12px" }}
                                />
                            </>
                        )}
                    </div>
                </DialogBody>
                <DialogFooter
                    actions={
                        <>
                            <Button text="キャンセル" onClick={() => setIsDialogOpen(false)} disabled={isActionLoading} />
                            <Button
                                text={dialogType === "encode_recorded" ? "エンコード開始" : "実行"}
                                intent={dialogType === "encode_recorded" ? "primary" : "danger"}
                                onClick={handleConfirm}
                                loading={isActionLoading}
                                disabled={dialogType === "encode_recorded" && selectedEncoder === ""}
                            />
                        </>
                    }
                />
            </Dialog>
        </div>
    );
};

function getServiceName(networkId: number, serviceId: number): string {
    const service = state.services.find((s) => s.networkId === networkId && s.serviceId === serviceId);
    return service?.name ?? "";
}

function formatFileSize(bytes?: number): string {
    if (!bytes || bytes <= 0) {
        return "-";
    }
    const units = ["B", "KiB", "MiB", "GiB", "TiB"];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        ++unitIndex;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getReserveStateLabel(reserveState: ReserveState): string {
    switch (reserveState) {
        case "reserved": return "予約済み";
        case "recording": return "録画中";
        case "finished": return "完了";
        case "failed": return "失敗";
        case "canceled": return "キャンセル";
        default: return reserveState;
    }
}

function getReserveStateIcon(reserveState: ReserveState): any {
    switch (reserveState) {
        case "reserved": return "time";
        case "recording": return "record";
        case "finished": return "tick";
        case "failed": return "error";
        case "canceled": return "disable";
        default: return "help";
    }
}

function getReserveStateIntent(reserveState: ReserveState): "none" | "primary" | "success" | "warning" | "danger" {
    switch (reserveState) {
        case "reserved": return "primary";
        case "recording": return "danger";
        case "finished": return "success";
        case "failed": return "danger";
        case "canceled": return "warning";
        default: return "none";
    }
}

function getRecordedStateLabel(recordedState: RecordedState): string {
    switch (recordedState) {
        case "recording": return "録画中";
        case "finished": return "完了";
        case "failed": return "失敗";
        default: return recordedState;
    }
}

function getRecordedStateIcon(recordedState: RecordedState): any {
    switch (recordedState) {
        case "recording": return "record";
        case "finished": return "tick";
        case "failed": return "error";
        default: return "help";
    }
}

function getRecordedStateIntent(recordedState: RecordedState): "none" | "primary" | "success" | "warning" | "danger" {
    switch (recordedState) {
        case "recording": return "danger";
        case "finished": return "success";
        case "failed": return "danger";
        default: return "none";
    }
}

function getEncodeStateLabel(encodeState: EncodeState): string {
    switch (encodeState) {
        case "waiting": return "待機中";
        case "encoding": return "エンコード中";
        case "finished": return "完了";
        case "failed": return "失敗";
        case "canceled": return "キャンセル";
        default: return encodeState;
    }
}

function getEncodeStateIcon(encodeState: EncodeState): any {
    switch (encodeState) {
        case "waiting": return "time";
        case "encoding": return "cog";
        case "finished": return "tick";
        case "failed": return "error";
        case "canceled": return "disable";
        default: return "help";
    }
}

function getEncodeStateIntent(encodeState: EncodeState): "none" | "primary" | "success" | "warning" | "danger" {
    switch (encodeState) {
        case "waiting": return "primary";
        case "encoding": return "primary";
        case "finished": return "success";
        case "failed": return "danger";
        case "canceled": return "warning";
        default: return "none";
    }
}
