# Bino Music Player

A sleek, modern desktop music application featuring fluid translucent themes, dynamic palette shifting based on active album artwork, and integrated scrolling lyrics. Built on top of the Electron framework for robust, native cross-platform performance.

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

<img width="2560" height="1440" alt="{40A9E9FE-37C9-4891-BD4A-484F3C8056BB}" src="https://github.com/user-attachments/assets/4a11a766-9198-4373-8965-7874370a0957" />

<img width="2560" height="1440" alt="{FC6C9147-4C62-45DE-AEB3-5BAB61387653}" src="https://github.com/user-attachments/assets/e49c2097-ba35-463c-af35-19da442c6a13" />

<img width="2560" height="1440" alt="{CAEA05DC-BAE4-44F6-93E6-72FDE26A8FC3}" src="https://github.com/user-attachments/assets/8e530f72-17df-42a7-9eeb-85d6f40b1426" />


Here is a look at the application interface variants, dynamic color processing engine, and playlist controls.


---

## Step-by-Step Installation

### For Regular Users
Follow these standard actions to run the completed program on a clean machine:
1. Navigate directly to the **Releases** tab on the right side of this repository page.
2. Download the compiled distribution file: **`Bino-43.0.0-win-x64.exe`**.
3. Launch the downloaded installer wizard.
4. If a Windows SmartScreen warning pops up, choose **"More Info"** and select **"Run anyway"**.
5. Access the app instantly via your new Desktop or Start Menu shortcuts.
(I swear this isn't a virus just check the source code)

### For Developers (Local Source Code Build)
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
