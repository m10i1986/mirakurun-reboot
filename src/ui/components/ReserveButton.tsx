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
import { Button, ButtonProps, Tooltip } from "@blueprintjs/core";
import { state } from "../modules/state";
import { Error as ApiError, Reserve } from "../../../api.d";

type ReserveButtonProps = {
    programId: number;
} & ButtonProps & React.HTMLAttributes<HTMLButtonElement>;

/** 指定番組の有効な予約 (キャンセル・失敗・完了以外) を返す */
function findActiveReserve(programId: number): Reserve | null {
    return state.reserves.find(
        (r) => r.programId === programId && (r.state === "reserved" || r.state === "recording"),
    ) ?? null;
}

export const ReserveButton: React.FC<ReserveButtonProps> = ({ programId, ...props }) => {
    console.debug("components", "ReserveButton", programId);

    const [reserve, setReserve] = useState<Reserve | null>(findActiveReserve(programId));
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const onReserves = () => setReserve(findActiveReserve(programId));
        onReserves();
        state.on("reserves", onReserves);
        return () => {
            state.off("reserves", onReserves);
        };
    }, [programId]);

    const request = async (method: string, path: string, body?: object): Promise<boolean> => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(path, {
                method,
                headers: { "Content-Type": "application/json" },
                body: body ? JSON.stringify(body) : undefined,
            });

            if (!res.ok) {
                let reason = `Error: ${res.status}`;
                try {
                    const errorData = await res.json() as ApiError;
                    reason = errorData.reason || reason;
                } catch {
                    // ボディなしはそのまま
                }
                setError(reason);
                return false;
            }

            await state.fetchReserves();
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            return false;
        } finally {
            setLoading(false);
        }
    };

    const createReserve = () => request("POST", "/api/reserves", { programId });
    const cancelReserve = () => {
        if (reserve) {
            request("PUT", `/api/reserves/${reserve.id}/cancel`);
        }
    };

    let button: JSX.Element;
    if (reserve?.state === "recording") {
        button = (
            <Button
                {...props}
                intent="danger"
                icon="record"
                text="録画中"
                loading={loading}
                title="クリックで録画を停止"
                onClick={cancelReserve}
            />
        );
    } else if (reserve?.state === "reserved") {
        button = (
            <Button
                {...props}
                intent="success"
                icon="tick"
                text="予約済み"
                loading={loading}
                title="クリックで予約を解除"
                onClick={cancelReserve}
            />
        );
    } else {
        button = (
            <Button
                {...props}
                intent="primary"
                icon="calendar"
                text="予約"
                loading={loading}
                title="この番組を録画予約"
                onClick={createReserve}
            />
        );
    }

    if (error) {
        return (
            <Tooltip content={error} intent="danger" isOpen>
                {button}
            </Tooltip>
        );
    }

    return button;
};
