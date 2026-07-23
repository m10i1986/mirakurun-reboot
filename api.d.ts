/*
   Copyright 2016 kanreisa

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

export interface Error {
    code?: number;
    reason?: string;
    errors?: ErrorOfOpenAPI[];
}

export interface ErrorOfOpenAPI {
    errorCode?: string;
    message?: string;
    location?: string;
}

export type ProgramId = number;

export type EventId = number;

export type ServiceId = number;

export type NetworkId = number;

export type ServiceItemId = number;

export type UnixtimeMS = number;

export interface Channel {
    type: ChannelType;
    channel: string;
    name?: string;
    services?: Service[];
}

export type ChannelType = "GR" | "BS" | "CS" | "SKY";

export interface Service {
    id: ServiceItemId;
    serviceId: ServiceId;
    networkId: NetworkId;
    name: string;
    type: number;
    logoId?: number;
    hasLogoData?: boolean;
    remoteControlKeyId?: number;
    epgReady?: boolean;
    epgUpdatedAt?: number;
    channel?: Channel;
}

export interface Program {
    id: ProgramId;
    eventId: EventId;
    serviceId: ServiceId;
    networkId: NetworkId;
    startAt: UnixtimeMS;
    duration: number;
    isFree: boolean;

    name?: string;
    description?: string;
    genres?: ProgramGenre[];
    video?: ProgramVideo;
    audios?: ProgramAudio[];

    series?: ProgramSeries;

    extended?: {
        [description: string]: string;
    };

    relatedItems?: ProgramRelatedItem[];
}

export interface ProgramGenre {
    lv1: number;
    lv2: number;
    un1: number;
    un2: number;
}

export interface ProgramVideo {
    type: ProgramVideoType;
    resolution: ProgramVideoResolution;
    streamContent: number;
    componentType: number;
}

export type ProgramVideoType = "mpeg2" | "h.264" | "h.265";

export type ProgramVideoResolution = (
    "240p" |
    "480i" |
    "480p" |
    "720p" |
    "1080i" |
    "1080p" |
    "2160p" |
    "4320p"
);

export interface ProgramAudio {
    /** component_type
     * - 0x01 - 1/0 mode (single-mono)
     * - 0x02 - 1/0 + 1/0 mode (dual-mono)
     * - 0x03 - 2/0 mode (stereo)
     * - 0x07 - 3/1 mode
     * - 0x08 - 3/2 mode
     * - 0x09 - 3/2 + LFE mode
     */
    componentType: number;
    componentTag: number;
    isMain: boolean;
    samplingRate: ProgramAudioSamplingRate;
    /** ISO_639_language_code, ISO_639_language_code_2
     * - this `#length` will `2` if dual-mono multi-lingual.
     */
    langs: ProgramAudioLanguageCode[];
}

export type ProgramAudioSamplingRate = (
    16000 |
    22050 |
    24000 |
    32000 |
    44100 |
    48000
);

export type ProgramAudioLanguageCode = (
    "jpn" |
    "eng" |
    "deu" |
    "fra" |
    "ita" |
    "rus" |
    "zho" |
    "kor" |
    "spa" |
    "etc"
);

export interface ProgramSeries {
    id: number;
    repeat: number;
    pattern: number;
    expiresAt: number;
    episode: number;
    lastEpisode: number;
    name: string;
}

export type ProgramRelatedItemType = "shared" | "relay" | "movement";

export interface ProgramRelatedItem {
    type: ProgramRelatedItemType;
    networkId?: number;
    serviceId: number;
    eventId: number;
}

export interface TunerDevice {
    index: number;
    name: string;
    types: ChannelType[];
    command: string | null;
    pid: number | null;
    users: TunerUser[];
    isAvailable: boolean;
    isRemote: boolean;
    isFree: boolean;
    isUsing: boolean;
    isFault: boolean;
}

export interface TunerUser {
    id: string;
    priority: number;
    agent?: string;
    url?: string;
    disableDecoder?: boolean;
    streamSetting?: StreamSetting;
    streamInfo?: StreamInfo;
}

interface StreamSetting {
    channel: ConfigChannelsItem;
    networkId?: number;
    serviceId?: number;
    eventId?: number;
    noProvide?: boolean;
    parseNIT?: boolean;
    parseSDT?: boolean;
    parseEIT?: boolean;
}

export interface StreamInfo {
    [PID: string]: {
        packet: number;
        drop: number;
    }
}

export interface TunerProcess {
    pid: number | null;
}

export interface JobScheduleItem {
    key: string;
    schedule: string;
    job: Pick<JobItem, "key" | "name">;
}

export interface JobItem {
    key: string;
    name: string;
    id: string;
    status: "queued" | "standby" | "running" | "finished";
    retryCount: number;

    isRerunnable?: boolean;
    retryOnAbort?: boolean;
    retryOnFail?: boolean;
    retryMax?: number;
    retryDelay?: number;

    isAborting: boolean;
    hasAborted?: boolean;
    hasSkipped?: boolean;
    hasFailed?: boolean;
    error?: string;

    createdAt: number;
    updatedAt: number;
    startedAt?: number;
    finishedAt?: number;
    duration?: number;
}

export interface Event<T = any> {
    resource: EventResource;
    type: EventType;
    data: T;
    time: UnixtimeMS;
}

export type EventResource = "program" | "service" | "tuner" | "job" | "job_schedule" | "reserve" | "rule" | "recorded" | "encode";

export type EventType = "create" | "update" | "remove";

export interface ConfigServer {
    path?: string;
    port?: number;
    hostname?: string;
    disableIPv6?: boolean;
    logLevel?: LogLevel;
    maxLogHistory?: number;
    jobMaxRunning?: number;
    jobMaxStandby?: number;
    maxBufferBytesBeforeReady?: number;
    eventEndTimeout?: number;
    programGCJobSchedule?: string;
    epgGatheringJobSchedule?: string;
    epgRetrievalTime?: number;
    logoDataInterval?: number;
    disableEITParsing?: boolean;
    disableWebUI?: boolean;
    allowIPv4CidrRanges?: string[];
    allowIPv6CidrRanges?: string[];
    allowOrigins: string[];
    allowPNA: boolean;
    tsplayEndpoint: string;
    recording?: ConfigRecording;
}

export interface ConfigGuide {
    /** service ids hidden in the Program Guide / Search views. */
    hiddenServiceIds?: number[];
}

export interface ConfigRecording {
    /** directory path to store recorded files. */
    recordedDirPath?: string;
    /**
     * recorded filename format.
     * @example "<year><month><day>-<hour><min>_<service>_<name>.m2ts"
     */
    recordedFormat?: string;
    /** start recording earlier than program start time. (ms) */
    startMarginMs?: number;
    /** keep recording after program end time. (ms) */
    endMarginMs?: number;
    /** default tuner priority for recording. */
    priority?: number;
    /** ffmpeg executable path for thumbnail / streaming / encode. */
    ffmpegPath?: string;
    /** thumbnail capture position. (sec) */
    thumbnailPositionSec?: number;
    /**
     * streaming transcode command template.
     * `%FFMPEG%`, `<ss>`, `<input>` are replaced. must output mp4 to `pipe:1`.
     */
    streamCommand?: string;
    /** max number of concurrent encodes. */
    maxEncode?: number;
    /** encoder presets. */
    encoders?: ConfigRecordingEncoder[];
}

export interface ConfigRecordingEncoder {
    /** preset name for identifying. */
    name: string;
    /** command template. `%FFMPEG%`, `<input>`, `<output>` are replaced. */
    command: string;
    /**
     * output filename suffix.
     * @example ".mp4"
     */
    suffix: string;
}

/**
 * FATAL: -1
 * ERROR: 0
 * WARN: 1
 * INFO: 2
 * DEBUG: 3
 */
export type LogLevel = -1 | 0 | 1 | 2 | 3;

export type ConfigTuners = ConfigTunersItem[];

export interface ConfigTunersItem {
    /** tuner name for identifying. */
    name: string;
    /** channel type. */
    types: ChannelType[];
    /** [chardev][dvb] command to get TS. */
    command?: string;
    /** [dvb] dvr adapter device path */
    dvbDevicePath?: string;
    /** [remote] specify to use remote Mirakurun host like as `192.168.1.x`. */
    remoteMirakurunHost?: string;
    /** [remote] specify to use remote Mirakurun port number (default: 40772). */
    remoteMirakurunPort?: number;
    /** [remote] `true` to use remote decoder. `false` to use local decoder. (if decoder specified) */
    remoteMirakurunDecoder?: boolean;
    /** CAS processor command if needed. */
    decoder?: string;
    /** `true` to **disable** this tuner. */
    isDisabled?: boolean;
}

export type ConfigChannels = ConfigChannelsItem[];

export interface ConfigChannelsItem {
    name: string;
    type: ChannelType;
    /** passed to tuning command */
    channel: string;
    serviceId?: number;
    /** TSMF (MPEG-TS Multi Frame) relative TS number config for CATV */
    tsmfRelTs?: number;
    /**
     * passed to tuning command variables.
     * @example { "freq": 123456, "polarity": "H", "space": 6, "extra-args": "..." }
     */
    commandVars?: Record<string, string | number>;
    isDisabled?: boolean;
    /** @deprecated typo of "satellite". */
    readonly satelite?: string;
    /** @deprecated from 4.0.0, use `commandVars` instead. */
    readonly satellite?: string;
    /** @deprecated from 4.0.0, use `commandVars` instead. */
    readonly space?: number;
    /** @deprecated from 4.0.0, use `commandVars` instead. */
    readonly freq?: number;
    /** @deprecated from 4.0.0, use `commandVars` instead. */
    readonly polarity?: "H" | "V";
}

export interface ChannelScanStatus {
    isScanning: boolean;
    status: ChannelScanPhase;
    type?: ChannelType;
    dryRun?: boolean;
    progress?: number;
    currentChannel?: string;
    scanLog?: string[];
    newCount?: number;
    takeoverCount?: number;
    result?: ConfigChannelsItem[];
    startTime?: number;
    updateTime?: number;
}

export type ChannelScanMode = "Channel" | "Service";

export type ChannelScanPhase = (
    "not_started" |
    "scanning" |
    "completed" |
    "cancelled" |
    "error"
);

export type ChannelScanStep = (
    "started" |
    "scanning_channel" |
    "takeover" |
    "skipped" |
    "services_found" |
    "channels_found" |
    "error"
);

export type ChannelScanResultType = (
    "summary" |
    "summary_new" |
    "summary_takeover" |
    "restart_required" |
    "final_result"
);

export interface Version {
    current: string;
    latest: string;
}

export interface Status {
    time: number;
    version: string;
    process: {
        arch: string;
        platform: string;
        versions: any;
        env: any;
        pid: number;
        memoryUsage: NodeJS.MemoryUsage;
    };
    epg: {
        gatheringNetworks: NetworkId[];
        storedEvents: number;
    };
    rpcCount: number;
    streamCount: {
        tunerDevice: number;
        tsFilter: number;
        decoder: number;
    };
    errorCount: {
        uncaughtException: number;
        unhandledRejection: number;
        bufferOverflow: number;
        tunerDeviceRespawn: number;
        decoderRespawn: number;
    };
    timerAccuracy: {
        last: number;
        m1: {
            avg: number;
            min: number;
            max: number;
        };
        m5: {
            avg: number;
            min: number;
            max: number;
        };
        m15: {
            avg: number;
            min: number;
            max: number;
        };
    };
}

// recording (EPGStation) ------------------------------------------------------

export type ReserveId = number;

export type RuleId = number;

export type RecordedId = number;

export type ReserveState = "reserved" | "recording" | "finished" | "failed" | "canceled";

export type ReserveType = "manual" | "rule";

export interface Reserve {
    id: ReserveId;
    type: ReserveType;
    ruleId?: RuleId;
    programId: ProgramId;
    /** snapshot of the target program. */
    program: Program;
    priority: number;
    isEnabled: boolean;
    state: ReserveState;
    recordedId?: RecordedId;
    createdAt: UnixtimeMS;
    updatedAt: UnixtimeMS;
}

export interface RuleSearchOption {
    /** space-separated keywords. matches program name / description. */
    keyword?: string;
    /** space-separated keywords. excludes matched programs. */
    ignoreKeyword?: string;
    /** Mirakurun Service#id list. */
    serviceIds?: ServiceItemId[];
    channelTypes?: ChannelType[];
    /** ARIB genre lv1 list. */
    genreLv1s?: number[];
    /** 0 (Sunday) - 6 (Saturday). */
    weekdays?: number[];
    /** 0-23. inclusive. */
    startHour?: number;
    /** 0-24. exclusive. supports over-midnight range like 25. */
    endHour?: number;
}

export interface Rule {
    id: RuleId;
    name: string;
    isEnabled: boolean;
    search: RuleSearchOption;
    priority?: number;
    createdAt: UnixtimeMS;
    updatedAt: UnixtimeMS;
}

export type RecordedState = "recording" | "finished" | "failed";

export interface Recorded {
    id: RecordedId;
    programId: ProgramId;
    reserveId?: ReserveId;
    ruleId?: RuleId;
    name: string;
    serviceName?: string;
    startAt: UnixtimeMS;
    duration: number;
    /** relative path from ConfigRecording#recordedDirPath. */
    filePath: string;
    /** id of the recorded item this item was encoded from (set on encode output only). */
    sourceRecordedId?: RecordedId;
    fileSize?: number;
    state: RecordedState;
    createdAt: UnixtimeMS;
    updatedAt: UnixtimeMS;
}

export interface StorageInfo {
    /** bytes */
    total: number;
    /** bytes */
    used: number;
    /** bytes */
    available: number;
}

export interface Schedule {
    service: Service;
    programs: Program[];
}

export type EncodeId = number;

export type EncodeState = "waiting" | "encoding" | "finished" | "failed" | "canceled";

export interface EncodeItem {
    id: EncodeId;
    recordedId: RecordedId;
    encoderName: string;
    state: EncodeState;
    /** 0.0 - 1.0 */
    progress: number;
    removeOriginal: boolean;
    error?: string;
    createdAt: UnixtimeMS;
    startedAt?: UnixtimeMS;
    finishedAt?: UnixtimeMS;
}
