# Bino Music Player

A sleek, modern desktop music application built on top of Riff featuring fluid translucent themes, dynamic palette shifting based on active album artwork, and integrated scrolling lyrics. Built on top of the Electron framework for robust, native cross-platform performance. Bino features better performance, is more customizable and has more freedom with faster loading than Riff.

---

## App Specifications

| Attribute | Details |
| :--- | :--- |
| **Current Build Version** | `v43.0.0` |
| **Target Architecture** | Windows x64 Standalone (`.exe`) |
| **Development Engine** | Node.js / Electron Framework |
| **Core Integration Modules** | HTML5 Audio, CSS Custom Properties, Local Database Storage |

---

## Showcases

<img width="2560" height="1390" alt="{D302CE4D-CFD7-47D9-82CB-523ADCE03454}" src="https://github.com/user-attachments/assets/ba04264e-288c-4afc-bb58-9c5f73f31012" />

<img width="2560" height="1392" alt="{1D9B76FA-28A5-4D61-86B5-6AA3D4FE33D8}" src="https://github.com/user-attachments/assets/039adaaa-3b43-4a56-8641-cb3bf04adcc7" />

<img width="2560" height="1440" alt="{D5793480-7F8B-4E9B-B7C4-E9755681FD5F}" src="https://github.com/user-attachments/assets/b9dd11d3-9429-4993-84de-1fba25f260f9" />

<img width="2560" height="1440" alt="{D9687724-B05F-4163-B351-7C1E3C4C63F5}" src="https://github.com/user-attachments/assets/1fa240f2-0b65-4c1b-91dc-439705d9334d" />

---

## Installation

### For Regular Users
Follow these standard actions to run the completed program on a clean machine:
1. Navigate directly to the **Releases** tab on the right side of this repository page.
2. Download the compiled distribution file: **`Bino-43.0.0-win-x64.exe`**.
3. Launch the downloaded installer wizard.
4. If a Windows SmartScreen warning pops up, choose **"More Info"** and select **"Run anyway"**.
5. Access the app instantly via your new Desktop or Start Menu shortcuts.

SmartScreen pops up because this is an independent open-source project and the binary isn't digitally signed with a Microsoft certificate, Windows may flag it initially

### Local Source Code Build (for the nerds)
Follow these sequential actions to run a local source configuration or compile a custom binary modification:
1. Ensure **Node.js (LTS version)** is properly installed on your machine.
2. Initialize path permissions inside your terminal instance:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
   ```
3. Navigate directly to your local project directory root:
   ```powershell
   cd /path/to/your/bino-main
   ```
4. Extract and resolve target module packages:
   ```powershell
   npm install
   ```
5. Spin up a hot-reloading development preview instance:
   ```powershell
   npm start
   ```
6. Package a production installer package into the local `dist/` directory:
   ```powershell
   npm run dist
   ```
---
LINUX, MAC AND BSD SUPPORT COMING SOON!
