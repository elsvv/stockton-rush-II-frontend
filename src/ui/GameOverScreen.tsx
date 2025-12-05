/**
 * Game over screen showing results and allowing restart.
 */

import type { GameState, PlayerId } from '../engine/types';
import { PlayerState, DeathCause } from '../engine/types';
import { getGameResults } from '../engine/gameState';

interface GameOverScreenProps {
    gameState: GameState;
    onRestart: (seed: number) => void;
    onMainMenu: () => void;
}

function getOutcomeText(state: PlayerState, deathCause?: DeathCause): string {
    if (state === PlayerState.Escaped) {
        return '🎉 ESCAPED!';
    }
    if (state === PlayerState.Dead) {
        if (deathCause === DeathCause.Imploded) {
            return '💥 IMPLODED';
        }
        if (deathCause === DeathCause.CrashedAscent) {
            return '💀 CRASHED DURING ASCENT';
        }
        return '☠️ DIED';
    }
    return '???';
}

function getOutcomeColor(state: PlayerState): string {
    if (state === PlayerState.Escaped) return '#44FF44';
    if (state === PlayerState.Dead) return '#FF4444';
    return '#FFFFFF';
}

export function GameOverScreen({ gameState, onRestart, onMainMenu }: GameOverScreenProps) {
    const results = getGameResults(gameState);

    const getWinnerText = (): { text: string; color: string } => {
        if (results.winner === 'player1') {
            return { text: 'PLAYER 1 WINS!', color: '#FFA500' };
        }
        if (results.winner === 'player2') {
            return { text: 'PLAYER 2 WINS!', color: '#00FF7F' };
        }
        return { text: "IT'S A DRAW!", color: '#FFFFFF' };
    };

    const winner = getWinnerText();

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '100vh',
                backgroundColor: '#0A1628',
                color: '#FFFFFF',
                fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
        >
            <h1
                style={{
                    fontSize: '42px',
                    marginBottom: '10px',
                    color: '#87CEEB',
                }}
            >
                GAME OVER
            </h1>

            <h2
                style={{
                    fontSize: '36px',
                    marginBottom: '40px',
                    color: winner.color,
                    textShadow: `0 0 20px ${winner.color}40`,
                }}
            >
                {winner.text}
            </h2>

            <div
                style={{
                    display: 'flex',
                    gap: '40px',
                    marginBottom: '40px',
                }}
            >
                {/* Player 1 Results */}
                <PlayerResultCard
                    playerId="player1"
                    result={results.player1}
                    isWinner={results.winner === 'player1'}
                />

                {/* Player 2 Results */}
                <PlayerResultCard
                    playerId="player2"
                    result={results.player2}
                    isWinner={results.winner === 'player2'}
                />
            </div>

            <div
                style={{
                    display: 'flex',
                    gap: '15px',
                }}
            >
                <button
                    onClick={() => onRestart(gameState.seed)}
                    style={{
                        padding: '14px 28px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: '#4A90D9',
                        color: '#FFFFFF',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = '#5AA0E9';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#4A90D9';
                    }}
                >
                    REPLAY (Same Seed)
                </button>

                <button
                    onClick={onMainMenu}
                    style={{
                        padding: '14px 28px',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        border: '2px solid #4A90D9',
                        backgroundColor: 'transparent',
                        color: '#4A90D9',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(74, 144, 217, 0.1)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    MAIN MENU
                </button>
            </div>

            <div
                style={{
                    marginTop: '30px',
                    color: '#556',
                    fontSize: '14px',
                }}
            >
                Seed: {gameState.seed}
            </div>
        </div>
    );
}

function PlayerResultCard({
    playerId,
    result,
    isWinner,
}: {
    playerId: PlayerId;
    result: {
        state: PlayerState;
        maxDepth: number;
        deathCause?: DeathCause;
    };
    isWinner: boolean;
}) {
    const isPlayer1 = playerId === 'player1';
    const playerColor = isPlayer1 ? '#FFA500' : '#00FF7F';

    return (
        <div
            style={{
                padding: '25px 35px',
                backgroundColor: isWinner ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.3)',
                borderRadius: '12px',
                border: isWinner ? `2px solid ${playerColor}` : '2px solid #2A4A6A',
                minWidth: '200px',
                textAlign: 'center',
            }}
        >
            <h3
                style={{
                    margin: '0 0 15px 0',
                    fontSize: '24px',
                    color: playerColor,
                }}
            >
                {isPlayer1 ? 'PLAYER 1' : 'PLAYER 2'}
                {isWinner && ' 👑'}
            </h3>

            <div
                style={{
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: getOutcomeColor(result.state),
                    marginBottom: '15px',
                }}
            >
                {getOutcomeText(result.state, result.deathCause)}
            </div>

            <div
                style={{
                    fontSize: '16px',
                    color: '#AAA',
                }}
            >
                Max Depth:{' '}
                <span style={{ color: '#87CEEB', fontWeight: 'bold' }}>
                    {Math.floor(result.maxDepth)}m
                </span>
            </div>
        </div>
    );
}
