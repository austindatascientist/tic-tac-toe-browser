import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import translations from './translations';

const SOCKET_URL = process.env.NODE_ENV === 'production' 
  ? window.location.origin 
  : 'http://localhost:8080';

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [screen, setScreen] = useState('menu');
  const [nickname, setNickname] = useState(() => localStorage.getItem('nickname') || '');
  const [nicknameInput, setNicknameInput] = useState(() => localStorage.getItem('nickname') || '');
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Language state - default to English, persisted in localStorage
  const [language, setLanguage] = useState(() => localStorage.getItem('language') || 'en');
  const t = translations[language]; // Translation helper
  
  // Game settings
  const [settings, setSettings] = useState({
    single: { size: 3, difficulty: 'medium' },
    multi: { size: 3 }
  });
  
  // Game state
  const [game, setGame] = useState({
    board: [],
    size: 3,
    currentPlayer: 'X',
    yourSymbol: 'X',
    playerNames: { X: 'Player 1', O: 'Player 2' },
    type: null,
    gameId: null
  });
  
  const [gameOver, setGameOver] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [winningLine, setWinningLine] = useState(null);
  const [rematchVotes, setRematchVotes] = useState({ votes: 0, needed: 2 });
  const [hasVotedRematch, setHasVotedRematch] = useState(false);
  
  // Timer
  const [timer, setTimer] = useState(null);
  
  // Chat
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  // Save language preference
  useEffect(() => {
    localStorage.setItem('language', language);
  }, [language]);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL);
    
    newSocket.on('connect', () => {
      setConnected(true);
      if (nickname) {
        newSocket.emit('setNickname', nickname);
      }
    });
    
    newSocket.on('disconnect', () => {
      setConnected(false);
    });
    
    newSocket.on('nicknameSet', (name) => {
      setNickname(name);
      localStorage.setItem('nickname', name);
    });
    
    newSocket.on('waitingForOpponent', () => {
      setScreen('waiting');
    });
    
    newSocket.on('matchmakingCancelled', () => {
      setScreen('menu');
    });
    
    newSocket.on('gameStarted', (data) => {
      setGame({
        board: data.board,
        size: data.size,
        currentPlayer: data.currentPlayer,
        yourSymbol: data.yourSymbol,
        playerNames: data.playerNames,
        type: data.type,
        gameId: data.gameId
      });
      setGameOver(null);
      setWinningLine(null);
      setLastMove(null);
      setRematchVotes({ votes: 0, needed: 2 });
      setHasVotedRematch(false);
      setChatMessages([]);
      setScreen('game');
    });
    
    newSocket.on('moveMade', (data) => {
      setGame(prev => ({
        ...prev,
        board: data.board,
        currentPlayer: data.currentPlayer
      }));
      setLastMove(data.lastMove);
    });
    
    newSocket.on('gameOver', (data) => {
      setGame(prev => ({
        ...prev,
        board: data.board || prev.board
      }));
      setGameOver({
        winner: data.winner,
        reason: data.reason
      });
      setWinningLine(data.winningLine || null);
      setTimer(null);
    });
    
    newSocket.on('gameRestarted', (data) => {
      setGame(prev => ({
        ...prev,
        board: data.board,
        currentPlayer: data.currentPlayer,
        yourSymbol: data.yourSymbol,
        playerNames: data.playerNames
      }));
      setGameOver(null);
      setWinningLine(null);
      setLastMove(null);
      setRematchVotes({ votes: 0, needed: 2 });
      setHasVotedRematch(false);
    });
    
    newSocket.on('playerLeft', (data) => {
      setGameOver({
        winner: data.winner,
        reason: 'opponent_left'
      });
      setTimer(null);
    });
    
    newSocket.on('turnTimerStarted', (data) => {
      setTimer(data.duration / 1000);
    });
    
    newSocket.on('rematchVote', (data) => {
      setRematchVotes(data);
    });
    
    newSocket.on('chatMessage', (data) => {
      setChatMessages(prev => [...prev, data]);
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timer === null || timer <= 0) return;
    
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [timer]);

  // Update nickname on socket
  useEffect(() => {
    if (socket && connected && nickname) {
      socket.emit('setNickname', nickname);
    }
  }, [socket, connected, nickname]);

  const handleCellClick = useCallback((index) => {
    if (!socket || !game.board || game.board[index] !== null) return;
    if (gameOver) return;
    if (game.currentPlayer !== game.yourSymbol) return;
    
    socket.emit('makeMove', { cellIndex: index });
  }, [socket, game, gameOver]);

  const startSinglePlayer = () => {
    if (!socket) return;
    socket.emit('startSinglePlayer', {
      size: settings.single.size,
      difficulty: settings.single.difficulty
    });
  };

  const findMultiplayerGame = () => {
    if (!socket) return;
    socket.emit('findMultiplayerGame', {
      size: settings.multi.size
    });
  };

  const cancelMatchmaking = () => {
    if (!socket) return;
    socket.emit('cancelMatchmaking');
  };

  const voteRematch = () => {
    if (!socket || hasVotedRematch) return;
    socket.emit('voteRematch');
    setHasVotedRematch(true);
  };

  const leaveGame = () => {
    if (!socket) return;
    socket.emit('leaveGame');
    setScreen('menu');
    setGame({
      board: [],
      size: 3,
      currentPlayer: 'X',
      yourSymbol: 'X',
      playerNames: { X: t.player1, O: t.player2 },
      type: null,
      gameId: null
    });
    setGameOver(null);
    setWinningLine(null);
    setTimer(null);
  };

  const sendChatMessage = () => {
    if (!socket || !chatInput.trim()) return;
    socket.emit('chatMessage', { message: chatInput.trim() });
    setChatInput('');
  };

  const getTimerClass = () => {
    if (timer === null) return '';
    if (timer <= 5) return 'critical';
    if (timer <= 10) return 'warning';
    return '';
  };

  const getResultMessage = () => {
    if (!gameOver) return '';
    
    if (gameOver.reason === 'timeout') {
      if (gameOver.winner === game.yourSymbol) {
        return `🎉 ${t.opponentTimeout}`;
      } else {
        return `⏱️ ${t.timeUp}`;
      }
    }
    
    if (gameOver.reason === 'opponent_left') {
      return `🎉 ${t.opponentLeft}`;
    }
    
    if (gameOver.winner === 'draw') {
      return `🤝 ${t.draw}`;
    }
    
    if (gameOver.winner === game.yourSymbol) {
      return `🎉 ${t.youWin}`;
    } else {
      return `😔 ${t.youLose}`;
    }
  };

  // Get localized player name
  const getPlayerName = (symbol) => {
    const name = game.playerNames[symbol];
    if (name === 'You') return t.you;
    if (name === 'Bot') return t.bot;
    if (name === 'Player 1') return t.player1;
    if (name === 'Player 2') return t.player2;
    return name;
  };

  return (
    <div className="app">
      {/* Header */}
      <div className="header">
        <div className="logo"><span className="logo-o">O</span><span className="logo-x">X</span> {t.appName}</div>
        <div className="header-right">
          {/* Language Selector */}
          <div className="language-selector">
            <button 
              className={`lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
              title={t.english}
            >
              🇺🇸
            </button>
            <button 
              className={`lang-btn ${language === 'es' ? 'active' : ''}`}
              onClick={() => setLanguage('es')}
              title={t.spanish}
            >
              🇪🇸
            </button>
            <button 
              className={`lang-btn ${language === 'fr' ? 'active' : ''}`}
              onClick={() => setLanguage('fr')}
              title={t.french}
            >
              🇫🇷
            </button>
          </div>
          <div className="nickname-display" onClick={() => {
          setNicknameInput(nickname);
          setShowNicknameModal(true);
        }}>
            <div className="avatar">{(nickname || 'P')[0].toUpperCase()}</div>
            <span>{nickname || t.setNickname}</span>
          </div>
        </div>
      </div>

      {/* Menu Screen */}
      {screen === 'menu' && (
        <div className="menu">
          <h1>{t.appName}</h1>
          <p style={{ color: '#666', marginBottom: 20 }}>{t.chooseGameMode}</p>
          
          <div className="menu-buttons">
            <button className="menu-button" onClick={startSinglePlayer}>
              🤖 {t.singlePlayer}
            </button>
            
            <button className="menu-button" onClick={findMultiplayerGame}>
              👥 {t.multiplayer}
            </button>
            
            <button 
              className="menu-button settings-menu-btn" 
              onClick={() => setShowSettingsModal(true)}
            >
              ⚙️ {t.settings}
            </button>
          </div>
          
          {!connected && (
            <p style={{ color: '#e74c3c', marginTop: 20 }}>
              ⚠️ {t.connectingToServer}
            </p>
          )}
        </div>
      )}

      {/* Waiting Screen */}
      {screen === 'waiting' && (
        <div className="waiting-screen">
          <h2>{t.findingOpponent}</h2>
          <div className="spinner"></div>
          <p>{t.waitingForPlayer}</p>
          <button className="cancel-btn" onClick={cancelMatchmaking}>
            {t.cancel}
          </button>
        </div>
      )}

      {/* Game Screen */}
      {screen === 'game' && (
        <>
          {/* Chat Toggle for Multiplayer */}
          {game.type === 'multiplayer' && (
            <>
              <button className="chat-toggle" onClick={() => setShowChat(!showChat)}>
                💬
              </button>
              
              {showChat && (
                <div className="chat-container">
                  <div className="chat-header">{t.chat}</div>
                  <div className="chat-messages">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className="chat-message">
                        <span className="sender">{msg.sender}:</span>
                        <span className="text"> {msg.message}</span>
                      </div>
                    ))}
                  </div>
                  <div className="chat-input">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                      placeholder={t.typeMessage}
                      maxLength={200}
                    />
                    <button onClick={sendChatMessage}>{t.send}</button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="game-container">
            {/* Player Info */}
            <div className="game-info">
              <div className={`player-info ${game.yourSymbol === 'X' ? 'you' : 'opponent'}`}>
                <div className="symbol">X</div>
                <div className="name">{getPlayerName('X')}</div>
              </div>
              <div className="vs">{t.vs}</div>
              <div className={`player-info ${game.yourSymbol === 'O' ? 'you' : 'opponent'}`}>
                <div className="symbol">O</div>
                <div className="name">{getPlayerName('O')}</div>
              </div>
            </div>

            {/* Timer */}
            {timer !== null && game.type === 'multiplayer' && !gameOver && (
              <div className={`timer ${getTimerClass()}`}>
                ⏱️ {timer}s
              </div>
            )}

            {/* Turn Indicator */}
            {!gameOver && (
              <div className={`turn-indicator ${game.currentPlayer === game.yourSymbol ? 'your-turn' : ''}`}>
                {game.currentPlayer === game.yourSymbol 
                  ? t.yourTurn
                  : `${t.opponentTurn} ${getPlayerName(game.currentPlayer)}`}
              </div>
            )}

            {/* Game Board */}
            <div
              className="board"
              style={{
                gridTemplateColumns: `repeat(${game.size}, 1fr)`,
                width: Math.min(game.size * 88, 500)
              }}
            >
              {game.board.map((cell, index) => {
                const isPlayerCell = cell === game.yourSymbol;
                const isOpponentCell = cell !== null && cell !== game.yourSymbol;
                return (
                  <button
                    key={index}
                    className={`cell ${cell || ''} ${
                      cell !== null || gameOver || game.currentPlayer !== game.yourSymbol ? 'disabled' : ''
                    } ${winningLine?.includes(index) ? 'winning' : ''} ${
                      lastMove === index ? 'last-move' : ''
                    } ${isPlayerCell ? 'player-cell' : ''} ${isOpponentCell ? 'opponent-cell' : ''}`}
                    onClick={() => handleCellClick(index)}
                    disabled={cell !== null || gameOver || game.currentPlayer !== game.yourSymbol}
                  >
                    {cell === 'X' ? 'X' : cell === 'O' ? 'O' : ''}
                  </button>
                );
              })}
            </div>

            {/* Game Over */}
            {gameOver && (
              <div className="game-over">
                <h2>{getResultMessage()}</h2>
                
                <div className="game-over-buttons">
                  {game.type === 'multiplayer' ? (
                    <>
                      <button 
                        className="rematch-btn" 
                        onClick={voteRematch}
                        disabled={hasVotedRematch}
                      >
                        {hasVotedRematch ? `✓ ${t.voted}` : `🔄 ${t.rematch}`}
                      </button>
                      <button className="menu-btn" onClick={leaveGame}>
                        🏠 {t.menu}
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="rematch-btn" onClick={startSinglePlayer}>
                        🔄 {t.playAgain}
                      </button>
                      <button className="menu-btn" onClick={leaveGame}>
                        🏠 {t.menu}
                      </button>
                    </>
                  )}
                </div>
                
                {game.type === 'multiplayer' && (
                  <div className="rematch-votes">
                    {t.rematchVotes}: {rematchVotes.votes}/{rematchVotes.needed} {t.votes}
                  </div>
                )}
              </div>
            )}

            {/* Leave Button */}
            {!gameOver && (
              <button 
                className="menu-btn" 
                onClick={leaveGame}
                style={{ marginTop: 20 }}
              >
                🚪 {t.leaveGame}
              </button>
            )}
          </div>
        </>
      )}

      {/* Nickname Modal */}
      {showNicknameModal && (
        <div className="modal-overlay" onClick={() => {
          setNicknameInput(nickname);
          setShowNicknameModal(false);
        }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{t.setNickname}</h2>
            <div className="modal-setting">
              <label>{t.nickname}</label>
              <input
                type="text"
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                placeholder={t.enterNickname}
                maxLength={20}
                autoFocus
              />
            </div>
            <div className="modal-buttons">
              <button className="cancel-btn" onClick={() => {
                setNicknameInput(nickname);
                setShowNicknameModal(false);
              }}>
                {t.cancel}
              </button>
              <button
                className="save-btn"
                onClick={() => {
                  if (socket && nicknameInput) {
                    socket.emit('setNickname', nicknameInput);
                    localStorage.setItem('nickname', nicknameInput);
                    setNickname(nicknameInput);
                  }
                  setShowNicknameModal(false);
                }}
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>⚙️ {t.settings}</h2>
            
            {/* Single Player Settings */}
            <div className="settings-section">
              <h3>🤖 {t.singlePlayer}</h3>
              
              <div className="modal-setting">
                <label>{t.boardSize}</label>
                <select
                  value={settings.single.size}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    single: { ...prev.single, size: parseInt(e.target.value) }
                  }))}
                >
                  <option value={3}>3x3</option>
                  <option value={4}>4x4</option>
                  <option value={5}>5x5</option>
                  <option value={6}>6x6</option>
                </select>
              </div>
              
              <div className="modal-setting">
                <label>{t.difficulty}</label>
                <select
                  value={settings.single.difficulty}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    single: { ...prev.single, difficulty: e.target.value }
                  }))}
                >
                  <option value="easy">{t.easy}</option>
                  <option value="medium">{t.medium}</option>
                  <option value="hard">{t.hard}</option>
                </select>
              </div>
            </div>
            
            {/* Multiplayer Settings */}
            <div className="settings-section">
              <h3>👥 {t.multiplayer}</h3>
              
              <div className="modal-setting">
                <label>{t.boardSize}</label>
                <select
                  value={settings.multi.size}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    multi: { ...prev.multi, size: parseInt(e.target.value) }
                  }))}
                >
                  <option value={3}>3x3</option>
                  <option value={4}>4x4</option>
                  <option value={5}>5x5</option>
                  <option value={6}>6x6</option>
                </select>
              </div>
            </div>
            
            <div className="modal-buttons">
              <button className="save-btn" onClick={() => setShowSettingsModal(false)}>
                {t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
