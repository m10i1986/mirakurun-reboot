[**English**](Platforms.md) | [**日本語**](Platforms.ja.md)

# Platforms / Environment Setup Guide

## Overview

**Bold** indicates required environments.

- Host OS: **Ubuntu Server 24.04 LTS**
  - Other Linux distributions also work, but Ubuntu is the easiest to set up
- [**Podman**](#podman-on-linux)
  - [Podman](https://podman.io/docs/installation) `>=5.7.0`

> Execution on the previously available node / pm2 environment has not been verified.

## Podman on Linux

### ⚠️Caution

- ⚠️If `pcscd` is installed on the host, it will conflict with the `pcscd` inside the container, so please **disable** it.
  - If you want to use the host's `pcscd`:
    - Setting the environment variable `DISABLE_PCSCD=1` disables `pcscd` inside the container.
    - Mount `/var/run/pcscd/pcscd.comm:/var/run/pcscd/pcscd.comm`.

### 🍱Preparation: When using DVB

- If the tuner you use supports DVB drivers, this is the easiest method.
- If you run the setup command while the tuner configuration is empty, tuners will be automatically detected and saved.
- No recording commands need to be prepared.
- The following tuners are usually included in the Linux kernel, but some lightweight distributions, such as those for Raspberry Pi, may require building. Enable the necessary modules and build for each:
  - PT1, PT2: `earth-pt1`
  - PT3: `earth-pt3`
  - PX-S1UD: `smsusb`
  - Others (will be added as operation reports come in)

```sh
# Check DVB device recognition
ls -l /dev/dvb
```

### 🍱Preparation: When using chardev

- If DVB cannot be used, you can use the traditional chardev method.

```sh
# Use a USB-connected device
lsusb
```

### Installing Podman

```sh
# For a new machine
sudo apt-get update
sudo apt-get install -y podman curl git
```

### ⚡Installation / Uninstallation / Update
This is an example of using a PLEX PX-M1UR and a SCR3310-NTTCom USB smart card reader over USB.

```sh
# 1. Make sure subuid/subgid are configured
grep "$(whoami)" /etc/subuid /etc/subgid

# 2. Add the running user to the owner group of each device (e.g., tuner=video, card reader=pcscd)
#    Log in again after adding to apply the change
sudo usermod -aG video,pcscd "$(whoami)"

# 3. Create the volumes owned by the running user
#    (in rootless mode, container root = the running user)
mkdir -p /opt/mirakurun/volumes/{run,opt,config,data}

# 4. Change the card reader permission via udev
#    Here is an example for the SCR3310-NTTCom USB SmartCard Reader (04e6:511a)
sudo tee /etc/udev/rules.d/60-bcas-reader.rules >/dev/null <<'_EOF_'
SUBSYSTEM=="usb", ATTRS{idVendor}=="04e6", ATTRS{idProduct}=="511a", MODE="0666"
_EOF_
sudo udevadm control --reload-rules
sudo udevadm trigger --action=add

# 5. Install the tuner driver such as PLEX (omitted)

# 6. Get the files from GitHub as mirakurun
cd /opt
git clone https://github.com/m10i1986/mirakurun-reboot.git mirakurun
cd mirakurun

# main branch
git checkout main

## Build the container
./container/podman.sh build

# 7. Register the systemd user service
sudo loginctl enable-linger "$(whoami)"
mkdir -p ~/.config/containers/systemd
cp container/mirakurun.container ~/.config/containers/systemd/

# Edit AddDevice= to match your environment & daemon-reload
vi ~/.config/containers/systemd/mirakurun.container
systemctl --user daemon-reload

```
Because it is built rootless, it can run as a regular user.

## Start / Stop / Restart
### ⚡Start

```sh
systemctl --user start mirakurun
```

### ⚡Stop

```sh
systemctl --user stop mirakurun
```

### ⚡Restart

```sh
systemctl --user restart mirakurun
```

### ⚡Logs

```sh
journalctl --user -u mirakurun.service

# To view detailed container operation logs, use the following
cd /opt/mirakurun
./container/podman.sh logs
```

### ⚡Configuration

- Major settings can be changed from the Web UI
- For all settings, refer to [Configuration.md](Configuration.md)

```
vim /opt/mirakurun/volumes/config/server.yml
vim /opt/mirakurun/volumes/config/tuners.yml
vim /opt/mirakurun/volumes/config/channels.yml
```

### 💡Main File Locations (Container)

- Socket: `/var/run/mirakurun.sock`
- Configuration: `/app-config/`
  - `server.yml`
  - `tuners.yml`
  - `channels.yml`
- Data: `/app-data/`
  - `services.json`
  - `programs.json`
- Opt: `/opt/`
  - `bin/`

### 💡Main File Locations (Host) *Customizable

- Socket: `/opt/mirakurun/volumes/run/mirakurun.sock`
- Configuration: `/opt/mirakurun/volumes/config/`
  - `server.yml`
  - `tuners.yml`
  - `channels.yml`
- Data: `/opt/mirakurun/volumes/data/`
  - `services.json`
  - `programs.json`
- Opt: `/opt/mirakurun/volumes/opt/`
  - `bin/`
  - `bin/startup` - Custom startup script (optional)

---

## Test Commands
### How to pass devices

Pass them to the `DEVICES` environment variable, separated by spaces. If unspecified, no devices are passed
(so it can start as-is even in a development environment without devices).

```sh
# USB chardev tuner (e.g., PX-M1UR) / USB card reader
DEVICES="/dev/bus/usb" ./container/podman.sh up

# Also use a DVB tuner
DEVICES="/dev/dvb /dev/bus/usb" ./container/podman.sh up

# To share the host's pcscd (pcscd inside the container will not start)
DISABLE_PCSCD=1 DEVICES="/dev/bus/usb" ./container/podman.sh up
```

### Commands

```sh
./container/podman.sh build      # Build the image
./container/podman.sh setup      # Start once for setup (SETUP=true, --rm)
./container/podman.sh up         # Detached start (restart=always)
./container/podman.sh down       # Stop and remove
./container/podman.sh logs       # Follow logs
./container/podman.sh bash       # bash in a running container
./container/podman.sh rebuild    # build + down + up
```
