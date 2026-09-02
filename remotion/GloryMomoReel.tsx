import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence
} from 'remotion';

export interface GloryMomoReelProps {
  headline?: string;
  dishTitle?: string;
  tagline?: string;
  scovilleHeat?: string;
  scovilleLevel?: number;
  offerCode?: string;
  discountText?: string;
  location?: string;
  price?: number;
}

export const GloryMomoReel: React.FC<GloryMomoReelProps> = ({
  headline = 'KOLKATA’S FIERIEST STREET MOMOS',
  dishTitle = 'Classic Darjeeling Chicken Jhol Momo',
  tagline = 'Drenched in roasted sesame, tomato & Dalle Khursani broth',
  scovilleHeat = '25,000 SHU — Fiery Red Jhol',
  scovilleLevel = 4,
  offerCode = 'GLORY20',
  discountText = 'FLAT 20% OFF ON ₹199+',
  location = 'Flavours Battle of Buds, Sukhobrishti C-Gate, Newtown',
  price = 90
}) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Primary Entrance Spring Physics
  const titleSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 10, mass: 0.6, stiffness: 120 }
  });

  const badgeSpring = spring({
    frame: frame - 25,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 140 }
  });

  const couponSpring = spring({
    frame: frame - 40,
    fps,
    config: { damping: 11, mass: 0.7, stiffness: 110 }
  });

  // Oscillating Pulsing Background Radiance
  const pulseScale = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.85, 1.25]
  );

  const glowRotate = (frame * 1.2) % 360;

  // Floating Ember Simulation (Procedural coordinates)
  const embers = Array.from({ length: 18 }).map((_, i) => {
    const seed = i * 47.3;
    const speed = 3 + (i % 5) * 1.5;
    const yPos = (height + 100 - ((frame * speed + seed * 20) % (height + 200)));
    const xPos = ((Math.sin(frame * 0.03 + seed) * 120) + (width * (0.1 + (i * 0.05) % 0.8)));
    const size = 6 + (i % 4) * 4;
    const opacity = interpolate(yPos, [height, height * 0.5, 0], [0, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return { x: xPos, y: yPos, size, opacity };
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#070A0F',
        fontFamily: '"Outfit", "Cabinet Grotesk", system-ui, -apple-system, sans-serif',
        color: '#F4F6FB',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        textAlign: 'center',
      }}
    >
      {/* Dynamic Background Ember Nebula */}
      <div
        style={{
          position: 'absolute',
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 69, 26, 0.45) 0%, rgba(255, 115, 21, 0.15) 45%, transparent 70%)',
          transform: `scale(${pulseScale}) rotate(${glowRotate}deg)`,
          filter: 'blur(90px)',
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 183, 3, 0.25) 0%, transparent 65%)',
          top: '15%',
          right: '-10%',
          filter: 'blur(70px)',
          zIndex: 0,
        }}
      />

      {/* Floating Glowing Particle Embers */}
      {embers.map((emb, idx) => (
        <div
          key={idx}
          style={{
            position: 'absolute',
            left: emb.x,
            top: emb.y,
            width: emb.size,
            height: emb.size,
            borderRadius: '50%',
            backgroundColor: idx % 2 === 0 ? '#FF7315' : '#FFB703',
            boxShadow: `0 0 16px ${idx % 2 === 0 ? '#FF451A' : '#FFB703'}`,
            opacity: emb.opacity,
            zIndex: 1,
          }}
        />
      ))}

      {/* Main Reel Content Canvas */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '88%',
          maxWidth: 920,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Top Brand Header Pill */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 28px',
            borderRadius: 999,
            backgroundColor: 'rgba(255, 183, 3, 0.12)',
            border: '1.5px solid rgba(255, 183, 3, 0.4)',
            color: '#FFB703',
            fontSize: 26,
            fontWeight: 900,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 32,
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          }}
        >
          <span>🥟</span>
          <span>{headline}</span>
          <span>🔥</span>
        </div>

        {/* Hero Dish Title with Kinetic Spring Typography */}
        <div
          style={{
            transform: `scale(${Math.max(0, titleSpring)}) translateY(${interpolate(titleSpring, [0, 1], [60, 0])}px)`,
            opacity: interpolate(frame, [5, 20], [0, 1], { extrapolateRight: 'clamp' }),
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              fontSize: 84,
              fontWeight: 950,
              lineHeight: 1.05,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              margin: 0,
              color: '#FFFFFF',
              textShadow: '0 12px 40px rgba(0,0,0,0.9), 0 0 50px rgba(255, 69, 26, 0.4)',
            }}
          >
            {dishTitle}
          </h1>

          <p
            style={{
              fontSize: 32,
              color: '#CBD5E1',
              fontWeight: 500,
              marginTop: 18,
              lineHeight: 1.35,
              maxWidth: 760,
              marginInline: 'auto',
            }}
          >
            {tagline}
          </p>
        </div>

        {/* Price & Scoville Badges Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            transform: `scale(${Math.max(0, badgeSpring)})`,
            opacity: interpolate(frame, [20, 35], [0, 1], { extrapolateRight: 'clamp' }),
            marginBottom: 44,
          }}
        >
          {/* Price Badge */}
          <div
            style={{
              backgroundColor: '#FF7315',
              color: '#070A0F',
              fontSize: 36,
              fontWeight: 950,
              padding: '14px 30px',
              borderRadius: 20,
              boxShadow: '0 8px 30px rgba(255, 115, 21, 0.5)',
            }}
          >
            ₹{price} ONLY
          </div>

          {/* Scoville Heat Gauge Badge */}
          <div
            style={{
              backgroundColor: 'rgba(255, 69, 26, 0.2)',
              border: '2px solid #FF451A',
              color: '#FF7315',
              fontSize: 32,
              fontWeight: 800,
              padding: '14px 32px',
              borderRadius: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              boxShadow: '0 0 35px rgba(255, 69, 26, 0.3)',
            }}
          >
            <span>🌶️</span>
            <span>{scovilleHeat}</span>
          </div>
        </div>

        {/* High-Contrast Neon Coupon Card Banner */}
        <div
          style={{
            width: '100%',
            transform: `scale(${Math.max(0, couponSpring)}) translateY(${interpolate(couponSpring, [0, 1], [40, 0])}px)`,
            opacity: interpolate(frame, [35, 50], [0, 1], { extrapolateRight: 'clamp' }),
            backgroundColor: 'rgba(18, 24, 32, 0.95)',
            border: '3px dashed #FFB703',
            borderRadius: 28,
            padding: '28px 36px',
            boxShadow: '0 24px 70px rgba(0,0,0,0.9), 0 0 40px rgba(255, 183, 3, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              fontSize: 26,
              letterSpacing: '0.15em',
              fontWeight: 800,
              color: '#E2E8F0',
              textTransform: 'uppercase',
            }}
          >
            SPECIAL REEL OFFER · {discountText}
          </div>

          <div
            style={{
              fontSize: 56,
              fontWeight: 950,
              color: '#FFB703',
              letterSpacing: '0.08em',
              fontFamily: 'monospace',
              textShadow: '0 0 20px rgba(255, 183, 3, 0.6)',
            }}
          >
            USE CODE: <span style={{ color: '#10B981', textDecoration: 'underline' }}>{offerCode}</span>
          </div>

          <div
            style={{
              fontSize: 22,
              color: '#94A3B8',
              fontWeight: 600,
              marginTop: 6,
            }}
          >
            📍 {location}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
