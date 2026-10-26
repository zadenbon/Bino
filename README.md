# Bino Music Player

A sleek, modern desktop music application featuring fluid translucent themes, dynamic palette shifting based on active album artwork, and integrated scrolling lyrics. Built on top of the Electron framework for robust, native cross-platform performance.

---

## 🚀 Key App Specifications

| Attribute | Details |
| :--- | :--- |
| **Current Build Version** | `v43.0.0` |
| **Target Architecture** | Windows x64 Standalone (`.exe`) |
| **Development Engine** | Node.js / Electron Framework |
| **Core Integration Modules** | HTML5 Audio, CSS Custom Properties, Local Database Storage |

---

## 📸 Interface Showcases

Here is a look at the application interface variants, dynamic color processing engine, and playlist controls.

| Interface View | Visual Demonstration |
| :--- | :--- |
| **Primary Theme View** | ![Main Layout View](https://placeholder.com) |
| **Dynamic Palette Swapping** | ![Dynamic Theme View](https://placeholder.com) |
| **Playlist View ("H")** | ![Playlist Control View](https://placeholder.com) |

> 💡 **Tip for your images:** For the cleanest look, create an `assets/` folder inside your repository, save your app screenshots there (e.g., `assets/main.png`), and update the markdown image paths to match (e.g., `![](./assets/main.png)`).

---

## 🛠️ Step-by-Step Installation

### For Regular Users (Production Setup)
Follow these standard actions to run the completed program on a clean machine:
1. Navigate directly to the **Releases** tab on the right side of this repository page.
2. Download the compiled distribution file: **`Bino-43.0.0-win-x64.exe`**.
3. Launch the downloaded installer wizard.
4. If a Windows SmartScreen warning pops up, choose **"More Info"** and select **"Run anyway"**.
5. Access the app instantly via your new Desktop or Start Menu shortcuts.

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

---

## 🔧 Core Requirements Checklist

| Module Requirement | Target Destination Path | Operational Scope |
| :--- | :--- | :--- |
| **`yt-dlp.exe` Binary** | `/bin/yt-dlp.exe` | Manages external media payload requests. |
| **`ffmpeg.exe` Engine** | `/bin/ffmpeg.exe` | Processes underlying streaming audio encoding. |
