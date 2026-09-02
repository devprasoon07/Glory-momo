import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const GloryMomoReel: React.FC<{
  dishTitle?: string;
  scovilleHeat?: string;
  offerCode?: string;
}> = ({
  dishTitle = 'Classic Darjeeling Chicken Jhol Momo',
  scovilleHeat = '25,000 SHU — Fiery Red',
  offerCode = 'JHOL25'
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5 }
  });

  const glowPulse = interpolate(
    Math.sin(frame / 6),
    [-1, 1],
    [0.7, 1.2]
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#090D14',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: '#F4F6FB',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #FF451A 0%, transparent 70%)',
          opacity: glowPulse * 0.4,
          filter: 'blur(60px)',
          zIndex: 0
        }}
      />

      <div style={{ zIndex: 1, transform: `scale(${scale})` }}>
        <div
          style={{
            fontSize: 32,
            letterSpacing: '0.2em',
            color: '#FFB703',
            textTransform: 'uppercase',
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          🥟 GLORY MOMO KOLKATA
        </div>

        <h1
          style={{
            fontSize: 72,
            fontWeight: 900,
            lineHeight: 1.1,
            margin: '0 0 24px 0',
            textShadow: '0 10px 30px rgba(0,0,0,0.8)'
          }}
        >
          {dishTitle}
        </h1>

        <div
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            borderRadius: 999,
            backgroundColor: 'rgba(255, 69, 26, 0.25)',
            border: '2px solid #FF451A',
            color: '#FF7315',
            fontSize: 28,
            fontWeight: 700,
            marginBottom: 36,
          }}
        >
          🔥 {scovilleHeat}
        </div>

        <div
          style={{
            backgroundColor: '#121820',
            border: '2px dashed #FFB703',
            borderRadius: 20,
            padding: '20px 40px',
            fontSize: 32,
            color: '#FFB703',
            fontWeight: 800
          }}
        >
          USE CODE: <span style={{ color: '#10B981' }}>{offerCode}</span> (25% OFF)
        </div>
      </div>
    </AbsoluteFill>
  );
};
