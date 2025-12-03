# Tic-Tac-Toe Browser

A real-time Tic-Tac-Toe game with single-player and multiplayer modes. Available in **English** (default), **Español**, and **Français**.

![Tic-Tac-Toe](https://img.shields.io/badge/Game-Tic--Tac--Toe-667eea)
![React](https://img.shields.io/badge/React-18.2.0-61dafb)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.7.2-010101)
![Languages](https://img.shields.io/badge/Languages-EN%20|%20ES%20|%20FR-green)

## 🌍 Available Languages

| Language | Flag | Game Name |
|----------|------|-----------|
| **English** (default) | 🇺🇸 | Tic-Tac-Toe |
| Español | 🇪🇸 | Tres en Raya |
| Français | 🇫🇷 | Morpion |

## ✨ Features

- 🎮 **Single Player** - Play against AI (Easy, Medium, Hard)
- 👥 **Multiplayer** - Real-time online matches with other players
- 📐 **Board Size** - Choose from 3x3, 4x4, 5x5, 6x6
- 💬 **In-game Chat** - Chat with your opponent in multiplayer mode
- ⏱️ **Timer** - 35 seconds per turn in multiplayer
- 🔄 **Rematch** - Vote to play another game
- 📱 **Responsive Design** - Works on desktop and mobile
- 🌍 **Multi-language** - English, Spanish, and French

## 🚀 Local Development

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/austindatascientist/tic-tac-toe-browser.git
cd tic-tac-toe-browser
```

2. Install server dependencies:
```bash
npm install
```

3. Install client dependencies:
```bash
cd client
npm install
cd ..
```

### Running Locally

1. Start the server (in the root directory):
```bash
npm run dev:server
```

2. In a new terminal, start the client:
```bash
npm run dev:client
```

3. Open http://localhost:3000 in your browser

## ☁️ Deploy to Render.com

### Method 1: Using the Dashboard

1. **Create a Render Account**
   - Go to [render.com](https://render.com) and sign up

2. **Push Your Code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/austindatascientist/tic-tac-toe-browser.git
   git push -u origin main
   ```

3. **Create a New Web Service on Render**
   - Go to your Render Dashboard
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure the service:
     - **Name**: `tic-tac-toe-browser`
     - **Environment**: `Node`
     - **Build Command**: `npm install && cd client && npm install && npm run build`
     - **Start Command**: `npm start`
   - Add Environment Variables:
     - Key: `NODE_ENV` Value: `production`
     - Key: `NODE_VERSION` Value: `18.19.0`
   - Click "Create Web Service"

4. **Wait for Deployment**
   - Render will automatically build and deploy your app
   - Your game will be available at `https://tic-tac-toe-browser.onrender.com`

### Method 2: Using render.yaml (Blueprint)

1. Push your code to GitHub (include the `render.yaml` file)

2. Go to Render Dashboard → "Blueprints"

3. Connect your repository

4. Render will automatically detect the `render.yaml` and configure the service

## 📁 Project Structure

```
tic-tac-toe-browser/
├── server/
│   └── index.js           # Express + Socket.IO server
├── client/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js         # Main React component
│       ├── translations.js # EN/ES/FR translations
│       ├── index.js       # React entry point
│       └── index.css      # Styles
├── package.json           # Server dependencies
├── render.yaml            # Render.com configuration
└── README.md
```

## 🎯 Game Rules

### Standard Tic-Tac-Toe (3x3)
- Players take turns placing X or O
- First to get 3 in a row (horizontal, vertical, or diagonal) wins
- If all cells are filled with no winner, it's a draw

### Larger Boards (4x4, 5x5, 6x6)
- Need 5 in a row to win on boards 5x5 and larger
- Need 3 in a row on smaller boards

## 🛠️ Technologies Used

- **Frontend**: React.js, Socket.IO Client, CSS3
- **Backend**: Node.js, Express, Socket.IO
- **Deployment**: Render.com

## 📜 License

MIT License - feel free to use and modify!

## 🙏 Acknowledgments

Inspired by [OGUMAN's Tic-Tac-Toe Online](https://github.com/OGUMAN/tic-tac-toe-online)
