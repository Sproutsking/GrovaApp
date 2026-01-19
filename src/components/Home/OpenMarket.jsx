import React from 'react';
import { Eye } from 'lucide-react';
import StoryCard from '../Shared/StoryCard';

const OpenMarket = ({ openMarketListings, handleBuyFromMarket, setViewingProfile }) => (
  <div className="stories-container">
    {openMarketListings.length > 0 ? (
      openMarketListings.map(listing => (
        <StoryCard
          key={listing.id}
          story={listing}
          onUnlock={handleBuyFromMarket}
          onAuthorClick={() => setViewingProfile(listing)}
          isMarket={true}
        />
      ))
    ) : (
      <div className="empty-gallery">
        <Eye size={48} />
        <h3>Open Market is Empty</h3>
        <p>No listings available yet</p>
      </div>
    )}
  </div>
);

export default OpenMarket;