[**English**](Platforms.md) | [**日本語**](Platforms.ja.md)

# プラットフォーム / 環境構築手順

## 概要

**太字**が必要環境です。

- ホストOS: **Ubuntu Server 24.04 LTS**
  - 他のLinuxディストリビューションでも動作しますがUbuntuが最もセットアップが容易です
- [**Podman**](#podman-on-linux)
  - [Podman](https://podman.io/docs/installation) `>=5.7.0`

> 過去にあったnode / pm2環境での実行は確認しておりません

## Podman on Linux

### ⚠️注意

- ⚠️ホストに `pcscd` がインストールされている場合、コンテナ内の `pcscd` と競合しますので、**無効化**してください。
  - ホストの `pcscd` を使う場合:
    - 環境変数 `DISABLE_PCSCD=1` を設定するとコンテナ内の `pcscd` が無効になります。
    - `/var/run/pcscd/pcscd.comm:/var/run/pcscd/pcscd.comm` をマウントしてください。

### 🍱準備: DVB を使用する場合

- 使用するチューナーが DVB ドライバーに対応していれば、最も手軽です。
- チューナー設定が空の状態でセットアップコマンドを走らせると、チューナーが自動的に検出・保存されます。
- 録画コマンドの用意が不要です。
- 下記のチューナーは大抵 Linux カーネルに含まれていますが、ラズパイ向け等の一部軽量ディストリビューションではビルドが必要です。それぞれ必要なモジュールを有効にしてビルドしてください。
  - PT1, PT2: `earth-pt1`
  - PT3: `earth-pt3`
  - PX-S1UD: `smsusb`
  - 他 (動作報告があれば追記します)

```sh
# DVB デバイスの認識を確認
ls -l /dev/dvb
```

### 🍱準備: chardev を使用する場合

- DVB を使用できない場合、従来方式の chardev を使用できます。

```sh
# USB接続のデバイスを利用
lsusb
```

### Podmanのインストール

```sh
# 新しいマシンの場合
sudo apt-get update
sudo apt-get install -y podman curl git
```

### ⚡インストール / アンインストール / アップデート
PLEX PX-M1UR と SCR3310-NTTCom USB スマートカードリーダーをUSB接続で利用する場合の例です

```sh
# 1. subuid/subgid が設定済みであること
grep "$(whoami)" /etc/subuid /etc/subgid

# 2. 実行ユーザを各デバイスの所有グループに追加 (例: チューナー=video, カードリーダー=pcscd)
#    追加後は再ログインして反映する
sudo usermod -aG video,pcscd "$(whoami)"

# 3. ボリュームを実行ユーザ所有で作成
#    (rootless ではコンテナ内 root = 実行ユーザにマップされる)
mkdir -p /opt/mirakurun/volumes/{run,opt,config,data}

# 4. カードリーダーのパーミッションをudevで変更させる
#    ここでは SCR3310-NTTCom USB SmartCard Reader(04e6:511a)の例
sudo tee /etc/udev/rules.d/60-bcas-reader.rules >/dev/null <<'_EOF_'
SUBSYSTEM=="usb", ATTRS{idVendor}=="04e6", ATTRS{idProduct}=="511a", MODE="0666"
_EOF_
sudo udevadm control --reload-rules
sudo udevadm trigger --action=add

# 5. PLEXなどのチューナドライバをインストール(省略)

# 6. Githubよりmirakurunとしてファイル取得
cd /opt
git clone https://github.com/m10i1986/mirakurun-reboot.git mirakurun
cd mirakurun

# main branch
git checkout main

## コンテナビルド
./container/podman.sh build

# 7. systemd user サービス登録
sudo loginctl enable-linger "$(whoami)"
mkdir -p ~/.config/containers/systemd
cp container/mirakurun.container ~/.config/containers/systemd/

# AddDevice= を実行環境に合わせて編集 & daemon-reload
vi ~/.config/containers/systemd/mirakurun.container
systemctl --user daemon-reload

```
rootlessで構築しているため、一般ユーザで動作可能です

## 起動 / 停止 / 再起動
### ⚡起動

```sh
systemctl --user start mirakurun
```

### ⚡停止

```sh
systemctl --user stop mirakurun
```

### ⚡再起動

```sh
systemctl --user restart mirakurun
```

### ⚡ログ

```sh
journalctl --user -u mirakurun.service

# 詳細なコンテナの動作ログを見る場合は下記
cd /opt/mirakurun
./container/podman.sh logs
```

### ⚡設定

- 主要な設定は Web UI から変更できます
- 全ての設定は [Configuration.ja.md](Configuration.ja.md) を参照してください

```
vim /opt/mirakurun/volumes/config/server.yml
vim /opt/mirakurun/volumes/config/tuners.yml
vim /opt/mirakurun/volumes/config/channels.yml
```

### 💡主なファイルパス (コンテナ)

- ソケット: `/var/run/mirakurun.sock`
- 設定: `/app-config/`
  - `server.yml`
  - `tuners.yml`
  - `channels.yml`
- データ: `/app-data/`
  - `services.json`
  - `programs.json`
- Opt: `/opt/`
  - `bin/`

### 💡主なファイルパス (ホスト) *変更可能

- ソケット: `/opt/mirakurun/volumes/run/mirakurun.sock`
- 設定: `/opt/mirakurun/volumes/config/`
  - `server.yml`
  - `tuners.yml`
  - `channels.yml`
- データ: `/opt/mirakurun/volumes/data/`
  - `services.json`
  - `programs.json`
- Opt: `/opt/mirakurun/volumes/opt/`
  - `bin/`
  - `bin/startup` - カスタム起動スクリプト (オプション)

---

## 試験用コマンド
### デバイスの渡し方

`DEVICES` 環境変数に空白区切りで渡します。未指定ならデバイスを渡しません
(デバイスの無い開発環境でもそのまま起動できます)。

```sh
# USB chardev チューナー (PX-M1UR 等) / USB カードリーダー
DEVICES="/dev/bus/usb" ./container/podman.sh up

# DVB チューナーも併用
DEVICES="/dev/dvb /dev/bus/usb" ./container/podman.sh up

# ホストの pcscd を共有する場合 (コンテナ内 pcscd は起動しない)
DISABLE_PCSCD=1 DEVICES="/dev/bus/usb" ./container/podman.sh up
```

### コマンド

```sh
./container/podman.sh build      # イメージをビルド
./container/podman.sh setup      # セットアップ用に一度だけ起動 (SETUP=true, --rm)
./container/podman.sh up         # デタッチ起動 (restart=always)
./container/podman.sh down       # 停止・削除
./container/podman.sh logs       # ログ追従
./container/podman.sh bash       # 起動中コンテナで bash
./container/podman.sh rebuild    # build + down + up
```
