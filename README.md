# uCeltic
All in one universal app for Medieval Irish text


Author: Zhou Dejian

# Project title: Web-based Annotator for Medieval Irish Text

## Overview

Celtic Finder is a web-based text annotation tool specifically designed for Medieval Irish texts. It provides text similarity search functionality and annotation capabilities to help researchers and scholars work with historical Irish texts.

## For End Users

### System Requirements
- **Windows:** Windows 10 or later
- **macOS:** macOS (apple silicon)
- **Port 8080** must be available (not used by other applications)

### Installation & Usage
The software is available for download from the releases page: https://github.com/Jamiedz999/MsC-CS-FYP-Dejian/releases NOT ON UCC git repository.
The project is set to private, email me(123109692@umail.ucc.ie) for the access.

#### Windows
1. Download `celtic-finder.zip` from the releases
2. Extract the zip file 
3. Run `celtic-finder.exe`
4. If Windows shows a security warning about harmful software, click "Run anyway"

#### macOS (apple silicon)
1. Download and install `Celtic Finder-1.0.0-arm64.dmg` from the releases
2. If macOS shows a security warning, go to **System Preferences > Security & Privacy** and allow the application to run

### Accessing the Application
- **Desktop App:** Use the application window that opens after launching
- **Web Browser:** Navigate to `http://localhost:8080` in your web browser



## For Developers

### Prerequisites
- **Node.js** (version 14 or later)
- **npm** (comes with Node.js)
- **Python** (version 3.7 or later) - for search algorithms

### Project Structure
```
MsC-CS-FYP-Dejian/
├── client/          # React frontend application
├── server/          # Express.js backend server
│   └── service/     # Python search algorithms and data
└── README           # This file
```

### Development Setup

#### 1. Clone and Setup
```bash
git clone 

#### 2. Backend Setup
```bash
cd server
npm install
node index.js
```
The backend server will start on `http://localhost:8080`

#### 3. Frontend Setup (Development)
Open a new terminal:
```bash
cd client
npm install
npm start
```
The development server will start on `http://localhost:3000` and proxy API requests to the backend on port 8080.

#### 4. Python Dependencies (for search algorithms)
```bash
cd server/service
pip install -r requirements.txt
```

