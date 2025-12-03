const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Build path - resolve from project root
const buildPath = path.join(__dirname, '../client/build');

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('Build path:', buildPath);
console.log('Build exists:', fs.existsSync(buildPath));

// Configure CORS for Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? false 
      : ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Serve static files from React build
if (fs.existsSync(buildPath)) {
  console.log('Serving static files from:', buildPath);
  app.use(express.static(buildPath));
}

// Game state management
const games = new Map();
const waitingPlayers = [];
const playerGames = new Map();

// Game utility functions
function createEmptyBoard(size = 3) {
  return Array(size * size).fill(null);
}

function checkWinner(board, size = 3) {
  const winLength = size >= 5 ? 5 : 3;
  
  // Check rows
  for (let row = 0; row < size; row++) {
    for (let col = 0; col <= size - winLength; col++) {
      const start = row * size + col;
      const cells = [];
      for (let i = 0; i < winLength; i++) {
        cells.push(board[start + i]);
      }
      if (cells[0] && cells.every(c => c === cells[0])) {
        return { winner: cells[0], line: cells.map((_, i) => start + i) };
      }
    }
  }
  
  // Check columns
  for (let col = 0; col < size; col++) {
    for (let row = 0; row <= size - winLength; row++) {
      const start = row * size + col;
      const cells = [];
      for (let i = 0; i < winLength; i++) {
        cells.push(board[start + i * size]);
      }
      if (cells[0] && cells.every(c => c === cells[0])) {
        return { winner: cells[0], line: cells.map((_, i) => start + i * size) };
      }
    }
  }
  
  // Check diagonals (top-left to bottom-right)
  for (let row = 0; row <= size - winLength; row++) {
    for (let col = 0; col <= size - winLength; col++) {
      const start = row * size + col;
      const cells = [];
      for (let i = 0; i < winLength; i++) {
        cells.push(board[start + i * size + i]);
      }
      if (cells[0] && cells.every(c => c === cells[0])) {
        return { winner: cells[0], line: cells.map((_, i) => start + i * size + i) };
      }
    }
  }
  
  // Check diagonals (top-right to bottom-left)
  for (let row = 0; row <= size - winLength; row++) {
    for (let col = winLength - 1; col < size; col++) {
      const start = row * size + col;
      const cells = [];
      for (let i = 0; i < winLength; i++) {
        cells.push(board[start + i * size - i]);
      }
      if (cells[0] && cells.every(c => c === cells[0])) {
        return { winner: cells[0], line: cells.map((_, i) => start + i * size - i) };
      }
    }
  }
  
  return null;
}

function isBoardFull(board) {
  return board.every(cell => cell !== null);
}

// AI Bot logic
function getBotMove(board, size, difficulty) {
  const emptyCells = board.map((cell, index) => cell === null ? index : -1).filter(i => i !== -1);
  
  if (emptyCells.length === 0) return -1;
  
  if (difficulty === 'easy') {
    // Random move
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }
  
  if (difficulty === 'medium') {
    // 50% chance of optimal move, 50% random
    if (Math.random() < 0.5) {
      return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }
  }
  
  // Hard difficulty or medium's optimal chance - use minimax
  return findBestMove(board, size);
}

function findBestMove(board, size) {
  let bestScore = -Infinity;
  let bestMove = -1;
  const emptyCells = board.map((cell, index) => cell === null ? index : -1).filter(i => i !== -1);
  
  // Limit search depth for larger boards
  const maxDepth = size <= 3 ? 9 : 4;
  
  for (const cell of emptyCells) {
    board[cell] = 'O';
    const score = minimax(board, size, 0, false, -Infinity, Infinity, maxDepth);
    board[cell] = null;
    
    if (score > bestScore) {
      bestScore = score;
      bestMove = cell;
    }
  }
  
  return bestMove;
}

function minimax(board, size, depth, isMaximizing, alpha, beta, maxDepth) {
  const result = checkWinner(board, size);
  
  if (result) {
    return result.winner === 'O' ? 10 - depth : depth - 10;
  }
  
  if (isBoardFull(board) || depth >= maxDepth) {
    return 0;
  }
  
  const emptyCells = board.map((cell, index) => cell === null ? index : -1).filter(i => i !== -1);
  
  if (isMaximizing) {
    let maxScore = -Infinity;
    for (const cell of emptyCells) {
      board[cell] = 'O';
      const score = minimax(board, size, depth + 1, false, alpha, beta, maxDepth);
      board[cell] = null;
      maxScore = Math.max(score, maxScore);
      alpha = Math.max(alpha, score);
      if (beta <= alpha) break;
    }
    return maxScore;
  } else {
    let minScore = Infinity;
    for (const cell of emptyCells) {
      board[cell] = 'X';
      const score = minimax(board, size, depth + 1, true, alpha, beta, maxDepth);
      board[cell] = null;
      minScore = Math.min(score, minScore);
      beta = Math.min(beta, score);
      if (beta <= alpha) break;
    }
    return minScore;
  }
}

function generateGameId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Set player nickname
  socket.on('setNickname', (nickname) => {
    socket.nickname = nickname || `Player${socket.id.substring(0, 4)}`;
    socket.emit('nicknameSet', socket.nickname);
  });
  
  // Single player game
  socket.on('startSinglePlayer', ({ size = 3, difficulty = 'medium' }) => {
    const gameId = `single_${socket.id}`;
    const game = {
      id: gameId,
      board: createEmptyBoard(size),
      size,
      difficulty,
      currentPlayer: 'X',
      players: { X: socket.id, O: 'bot' },
      playerNames: { X: 'You', O: 'Bot' },
      status: 'playing',
      type: 'single'
    };
    
    games.set(gameId, game);
    playerGames.set(socket.id, gameId);
    
    socket.emit('gameStarted', {
      gameId,
      board: game.board,
      size: game.size,
      currentPlayer: game.currentPlayer,
      yourSymbol: 'X',
      playerNames: game.playerNames,
      type: 'single'
    });
  });
  
  // Find multiplayer game
  socket.on('findMultiplayerGame', ({ size = 3 }) => {
    // Check if there's a waiting player with same size preference
    const waitingIndex = waitingPlayers.findIndex(p => p.size === size && p.socketId !== socket.id);
    
    if (waitingIndex !== -1) {
      // Match found
      const opponent = waitingPlayers.splice(waitingIndex, 1)[0];
      const opponentSocket = io.sockets.sockets.get(opponent.socketId);
      
      if (!opponentSocket) {
        // Opponent disconnected, add current player to waiting
        waitingPlayers.push({ socketId: socket.id, size, nickname: socket.nickname });
        socket.emit('waitingForOpponent');
        return;
      }
      
      const gameId = generateGameId();
      const firstPlayer = Math.random() < 0.5 ? socket.id : opponent.socketId;
      
      const game = {
        id: gameId,
        board: createEmptyBoard(size),
        size,
        currentPlayer: 'X',
        players: {
          X: firstPlayer,
          O: firstPlayer === socket.id ? opponent.socketId : socket.id
        },
        playerNames: {
          X: firstPlayer === socket.id ? (socket.nickname || 'Player 1') : (opponentSocket.nickname || 'Player 1'),
          O: firstPlayer === socket.id ? (opponentSocket.nickname || 'Player 2') : (socket.nickname || 'Player 2')
        },
        status: 'playing',
        type: 'multiplayer',
        turnTimer: null,
        turnStartTime: Date.now(),
        votes: { rematch: new Set() },
        chat: []
      };
      
      games.set(gameId, game);
      playerGames.set(socket.id, gameId);
      playerGames.set(opponent.socketId, gameId);
      
      // Join both players to a room
      socket.join(gameId);
      opponentSocket.join(gameId);
      
      // Send game info to both players
      const gameInfo = {
        gameId,
        board: game.board,
        size: game.size,
        currentPlayer: game.currentPlayer,
        playerNames: game.playerNames,
        type: 'multiplayer'
      };
      
      socket.emit('gameStarted', { ...gameInfo, yourSymbol: game.players.X === socket.id ? 'X' : 'O' });
      opponentSocket.emit('gameStarted', { ...gameInfo, yourSymbol: game.players.X === opponent.socketId ? 'X' : 'O' });
      
      // Start turn timer
      startTurnTimer(gameId);
    } else {
      // No match, add to waiting list
      waitingPlayers.push({ socketId: socket.id, size, nickname: socket.nickname });
      socket.emit('waitingForOpponent');
    }
  });
  
  // Cancel matchmaking
  socket.on('cancelMatchmaking', () => {
    const index = waitingPlayers.findIndex(p => p.socketId === socket.id);
    if (index !== -1) {
      waitingPlayers.splice(index, 1);
      socket.emit('matchmakingCancelled');
    }
  });
  
  // Make a move
  socket.on('makeMove', ({ cellIndex }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    
    const game = games.get(gameId);
    if (!game || game.status !== 'playing') return;
    
    // Check if it's the player's turn
    const playerSymbol = game.players.X === socket.id ? 'X' : 'O';
    if (game.currentPlayer !== playerSymbol) return;
    
    // Check if cell is empty
    if (game.board[cellIndex] !== null) return;
    
    // Make the move
    game.board[cellIndex] = playerSymbol;
    
    // Check for winner
    const result = checkWinner(game.board, game.size);
    
    if (result) {
      game.status = 'finished';
      game.winner = result.winner;
      game.winningLine = result.line;
      
      if (game.type === 'multiplayer') {
        clearTimeout(game.turnTimer);
        io.to(gameId).emit('gameOver', {
          winner: result.winner,
          winningLine: result.line,
          board: game.board
        });
      } else {
        socket.emit('gameOver', {
          winner: result.winner,
          winningLine: result.line,
          board: game.board
        });
      }
      return;
    }
    
    // Check for draw
    if (isBoardFull(game.board)) {
      game.status = 'finished';
      game.winner = 'draw';
      
      if (game.type === 'multiplayer') {
        clearTimeout(game.turnTimer);
        io.to(gameId).emit('gameOver', { winner: 'draw', board: game.board });
      } else {
        socket.emit('gameOver', { winner: 'draw', board: game.board });
      }
      return;
    }
    
    // Switch player
    game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
    
    if (game.type === 'multiplayer') {
      clearTimeout(game.turnTimer);
      game.turnStartTime = Date.now();
      io.to(gameId).emit('moveMade', {
        board: game.board,
        currentPlayer: game.currentPlayer,
        lastMove: cellIndex
      });
      startTurnTimer(gameId);
    } else {
      socket.emit('moveMade', {
        board: game.board,
        currentPlayer: game.currentPlayer,
        lastMove: cellIndex
      });
      
      // Bot's turn
      if (game.currentPlayer === 'O') {
        setTimeout(() => {
          const botMove = getBotMove([...game.board], game.size, game.difficulty);
          if (botMove !== -1 && game.status === 'playing') {
            game.board[botMove] = 'O';
            
            const botResult = checkWinner(game.board, game.size);
            if (botResult) {
              game.status = 'finished';
              game.winner = botResult.winner;
              socket.emit('gameOver', {
                winner: botResult.winner,
                winningLine: botResult.line,
                board: game.board
              });
              return;
            }
            
            if (isBoardFull(game.board)) {
              game.status = 'finished';
              game.winner = 'draw';
              socket.emit('gameOver', { winner: 'draw', board: game.board });
              return;
            }
            
            game.currentPlayer = 'X';
            socket.emit('moveMade', {
              board: game.board,
              currentPlayer: game.currentPlayer,
              lastMove: botMove
            });
          }
        }, 500 + Math.random() * 500);
      }
    }
  });
  
  // Turn timer function
  function startTurnTimer(gameId) {
    const game = games.get(gameId);
    if (!game || game.type !== 'multiplayer') return;
    
    game.turnTimer = setTimeout(() => {
      if (game.status !== 'playing') return;
      
      // Player ran out of time - they lose
      const loser = game.currentPlayer;
      const winner = loser === 'X' ? 'O' : 'X';
      game.status = 'finished';
      game.winner = winner;
      
      io.to(gameId).emit('gameOver', {
        winner,
        reason: 'timeout',
        board: game.board
      });
    }, 35000); // 35 seconds per turn
    
    io.to(gameId).emit('turnTimerStarted', { duration: 35000 });
  }
  
  // Chat message
  socket.on('chatMessage', ({ message }) => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    
    const game = games.get(gameId);
    if (!game || game.type !== 'multiplayer') return;
    
    const chatMessage = {
      sender: socket.nickname || 'Player',
      message: message.substring(0, 200), // Limit message length
      timestamp: Date.now()
    };
    
    game.chat.push(chatMessage);
    io.to(gameId).emit('chatMessage', chatMessage);
  });
  
  // Vote for rematch
  socket.on('voteRematch', () => {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    
    const game = games.get(gameId);
    if (!game || game.status !== 'finished' || game.type !== 'multiplayer') return;
    
    game.votes.rematch.add(socket.id);
    io.to(gameId).emit('rematchVote', { votes: game.votes.rematch.size, needed: 2 });
    
    // Check if both players voted
    if (game.votes.rematch.size >= 2) {
      // Reset game
      game.board = createEmptyBoard(game.size);
      game.currentPlayer = 'X';
      game.status = 'playing';
      game.winner = null;
      game.winningLine = null;
      game.votes.rematch.clear();
      game.turnStartTime = Date.now();
      
      // Swap player symbols
      const temp = game.players.X;
      game.players.X = game.players.O;
      game.players.O = temp;
      
      const tempName = game.playerNames.X;
      game.playerNames.X = game.playerNames.O;
      game.playerNames.O = tempName;
      
      const player1Socket = io.sockets.sockets.get(game.players.X);
      const player2Socket = io.sockets.sockets.get(game.players.O);
      
      if (player1Socket) {
        player1Socket.emit('gameRestarted', {
          board: game.board,
          currentPlayer: game.currentPlayer,
          yourSymbol: 'X',
          playerNames: game.playerNames
        });
      }
      
      if (player2Socket) {
        player2Socket.emit('gameRestarted', {
          board: game.board,
          currentPlayer: game.currentPlayer,
          yourSymbol: 'O',
          playerNames: game.playerNames
        });
      }
      
      startTurnTimer(gameId);
    }
  });
  
  // Leave game
  socket.on('leaveGame', () => {
    handlePlayerLeave(socket);
  });
  
  // Disconnect handling
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Remove from waiting list
    const waitingIndex = waitingPlayers.findIndex(p => p.socketId === socket.id);
    if (waitingIndex !== -1) {
      waitingPlayers.splice(waitingIndex, 1);
    }
    
    handlePlayerLeave(socket);
  });
  
  function handlePlayerLeave(socket) {
    const gameId = playerGames.get(socket.id);
    if (!gameId) return;
    
    const game = games.get(gameId);
    if (!game) return;
    
    if (game.type === 'multiplayer' && game.status === 'playing') {
      clearTimeout(game.turnTimer);
      game.status = 'finished';
      
      // Notify other player
      const winner = game.players.X === socket.id ? 'O' : 'X';
      io.to(gameId).emit('playerLeft', { winner });
    }
    
    playerGames.delete(socket.id);
    
    // Clean up game if both players left
    const playersInGame = [...playerGames.entries()].filter(([_, gId]) => gId === gameId);
    if (playersInGame.length === 0) {
      games.delete(gameId);
    }
  }
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    games: games.size, 
    waitingPlayers: waitingPlayers.length,
    buildExists: fs.existsSync(buildPath),
    nodeEnv: process.env.NODE_ENV
  });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  const indexPath = path.join(buildPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <h1>Build not found</h1>
      <p>The React build folder was not found at: ${buildPath}</p>
      <p>Make sure to run the build command: <code>npm run build</code></p>
      <p><a href="/api/health">Check API Health</a></p>
    `);
  }
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
