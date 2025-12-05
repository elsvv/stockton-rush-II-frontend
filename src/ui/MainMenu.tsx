/**
 * Main menu screen for the Titan Escape game.
 */

import { useState } from 'react';
import { generateRandomSeed } from '../engine/rng';

interface MainMenuProps {
    onStartGame: (seed: number) => void;
}

export function MainMenu({ onStartGame }: MainMenuProps) {
    const [customSeed, setCustomSeed] = useState('');
    const [showControls, setShowControls] = useState(false);

    const handleStart = () => {
        const seed = customSeed.trim()
            ? parseInt(customSeed, 10) || generateRandomSeed()
            : generateRandomSeed();
        onStartGame(seed);
    };

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
                    fontSize: '48px',
                    marginBottom: '10px',
                    background: 'linear-gradient(135deg, #87CEEB, #1E4D6B)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '0 0 30px rgba(135, 206, 235, 0.3)',
                }}
            >
                TITAN ESCAPE
            </h1>

            <p
                style={{
                    fontSize: '18px',
                    color: '#8AA',
                    marginBottom: '40px',
                    textAlign: 'center',
                    maxWidth: '500px',
                }}
            >
                Dive deep into the abyss and race to escape before your submersible implodes!
            </p>

            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '15px',
                    width: '300px',
                }}
            >
                <input
                    type="text"
                    placeholder="Custom seed (optional)"
                    value={customSeed}
                    onChange={(e) => setCustomSeed(e.target.value)}
                    style={{
                        padding: '12px 16px',
                        fontSize: '16px',
                        borderRadius: '8px',
                        border: '2px solid #2A4A6A',
                        backgroundColor: '#1A2A3A',
                        color: '#FFFFFF',
                        outline: 'none',
                        textAlign: 'center',
                    }}
                />

                <button
                    onClick={handleStart}
                    style={{
                        padding: '16px 32px',
                        fontSize: '20px',
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
                        e.currentTarget.style.transform = 'scale(1.02)';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = '#4A90D9';
                        e.currentTarget.style.transform = 'scale(1)';
                    }}
                >
                    START GAME
                </button>

                <button
                    onClick={() => setShowControls(!showControls)}
                    style={{
                        padding: '12px 24px',
                        fontSize: '16px',
                        borderRadius: '8px',
                        border: '2px solid #4A90D9',
                        backgroundColor: 'transparent',
                        color: '#4A90D9',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                >
                    {showControls ? 'HIDE CONTROLS' : 'SHOW CONTROLS'}
                </button>
            </div>

            {showControls && (
                <div
                    style={{
                        marginTop: '30px',
                        padding: '20px 30px',
                        backgroundColor: 'rgba(74, 144, 217, 0.1)',
                        borderRadius: '12px',
                        border: '1px solid #2A4A6A',
                    }}
                >
                    <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#87CEEB' }}>
                        Controls
                    </h3>

                    <div style={{ display: 'flex', gap: '40px' }}>
                        <div>
                            <h4 style={{ color: '#FFA500', margin: '0 0 10px 0' }}>Player 1</h4>
                            <div style={{ fontFamily: 'monospace', lineHeight: '1.8' }}>
                                <div>
                                    <kbd style={kbdStyle}>A</kbd> Move Left
                                </div>
                                <div>
                                    <kbd style={kbdStyle}>D</kbd> Move Right
                                </div>
                                <div>
                                    <kbd style={kbdStyle}>W</kbd> Dump Ballast (Escape)
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 style={{ color: '#00FF7F', margin: '0 0 10px 0' }}>Player 2</h4>
                            <div style={{ fontFamily: 'monospace', lineHeight: '1.8' }}>
                                <div>
                                    <kbd style={kbdStyle}>←</kbd> Move Left
                                </div>
                                <div>
                                    <kbd style={kbdStyle}>→</kbd> Move Right
                                </div>
                                <div>
                                    <kbd style={kbdStyle}>↑</kbd> Dump Ballast (Escape)
                                </div>
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            marginTop: '20px',
                            padding: '10px',
                            backgroundColor: 'rgba(255, 100, 100, 0.1)',
                            borderRadius: '8px',
                            fontSize: '14px',
                        }}
                    >
                        <strong style={{ color: '#FF6B6B' }}>⚠️ Warning:</strong> Dumping ballast
                        ejects you in a fragile escape capsule. Any collision = instant death!
                    </div>
                </div>
            )}

            <div
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    color: '#556',
                    fontSize: '12px',
                }}
            >
                A deterministic hot-seat 2-player game
            </div>
        </div>
    );
}

const kbdStyle: React.CSSProperties = {
    display: 'inline-block',
    padding: '2px 8px',
    backgroundColor: '#2A4A6A',
    borderRadius: '4px',
    marginRight: '8px',
    minWidth: '24px',
    textAlign: 'center',
};
