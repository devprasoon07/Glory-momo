import React from 'react';
import { Composition } from 'remotion';
import { GloryMomoReel } from './GloryMomoReel';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GloryMomoPromoReel"
        component={GloryMomoReel}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          headline: 'KOLKATA’S FIERIEST STREET MOMOS',
          dishTitle: 'Classic Darjeeling Chicken Jhol Momo',
          tagline: 'Drenched in roasted sesame, tomato & Dalle Khursani broth',
          scovilleHeat: '25,000 SHU — Fiery Red Jhol',
          scovilleLevel: 4,
          offerCode: 'GLORY20',
          discountText: 'FLAT 20% OFF ON ₹199+',
          location: 'Flavours Battle of Buds, Sukhobrishti C-Gate, Newtown',
          price: 90
        }}
      />
      <Composition
        id="BattleOfBudsPlatterReel"
        component={GloryMomoReel}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          headline: '16-PIECE FEAST PLATTER',
          dishTitle: 'Battle of Buds Momo Platter',
          tagline: 'Steamed, Pan-Fried & Jhol Momos with 3 Himalayan Chutneys',
          scovilleHeat: '50,000 SHU — Extreme Fire',
          scovilleLevel: 5,
          offerCode: 'FEAST40',
          discountText: 'FLAT 40% OFF ON ₹499+',
          location: 'Flavours Battle of Buds, Sukhobrishti C-Gate, Newtown',
          price: 200
        }}
      />
    </>
  );
};
