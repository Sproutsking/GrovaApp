import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { Sparkles, Music } from "lucide-react";
import UserProfileModal from "../Modals/UserProfileModal";
import mediaUrlService from "../../services/shared/mediaUrlService";

const ReelProfilePreview = ({
  profile,
  music,
  currentUser,
  onMusicClick,
  size = "medium",
  className = "",
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [animationIndex, setAnimationIndex] = useState(0);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Smart data extraction - handles both pre-formatted and raw database objects
  const getUserData = () => {
    // If profile is already formatted with userId, author, username, avatar
    if (profile.userId || profile.author) {
      return {
        userId: profile.userId || profile.user_id || profile.id,
        author:
          profile.author || profile.name || profile.full_name || "Unknown User",
        username: profile.username || "unknown",
        avatar: profile.avatar,
        verified: profile.verified || false,
      };
    }

    // If profile is raw database object (from posts/reels/stories)
    const userId = profile.user_id || profile.id;
    const profileData = profile.profiles || profile;

    const author =
      profileData.full_name || profile.author || profile.name || "Unknown User";
    const username =
      profileData.username ||
      profile.username ||
      (author || "user").toLowerCase().replace(/\s+/g, "_");

    // Handle avatar - check for avatar_id first
    let avatar = null;
    if (profileData.avatar_id) {
      avatar = mediaUrlService.getAvatarUrl(profileData.avatar_id, 200);
    } else if (profile.avatar) {
      avatar = profile.avatar;
    } else {
      avatar = author.charAt(0).toUpperCase();
    }

    return {
      userId,
      author,
      username,
      avatar,
      verified: profileData.verified || profile.verified || false,
    };
  };

  const userData = getUserData();
  const { userId, author, username, avatar, verified } = userData;

  const sizes = {
    small: { avatar: 32, name: 13, music: 11 },
    medium: { avatar: 42, name: 14, music: 11 },
    large: { avatar: 52, name: 16, music: 12 },
  };

  const currentSize = sizes[size];
  const hasMusic = music && music.trim().length > 0;

  useEffect(() => {
    if (!hasMusic) {
      const interval = setInterval(() => {
        setAnimationIndex((prev) => (prev + 1) % 2);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [hasMusic]);

  const handleProfileClick = (e) => {
    e.stopPropagation();
    setShowProfileModal(true);
  };

  const handleMusicClick = (e) => {
    e.stopPropagation();
    if (hasMusic && onMusicClick) {
      onMusicClick(music);
    }
  };

  // Enhanced avatar URL with quality parameters
  let enhancedAvatar = avatar;
  if (avatar && typeof avatar === "string") {
    const cleanUrl = avatar.split("?")[0];
    if (cleanUrl.includes("supabase") || cleanUrl.includes("cloudinary")) {
      const targetSize = currentSize.avatar * 3;
      enhancedAvatar = avatar.includes("?")
        ? avatar
        : `${cleanUrl}?quality=100&width=${targetSize}&height=${targetSize}&resize=cover&format=webp`;
    }
  }

  const isValidUrl =
    enhancedAvatar &&
    typeof enhancedAvatar === "string" &&
    !imageError &&
    (enhancedAvatar.startsWith("http://") ||
      enhancedAvatar.startsWith("https://") ||
      enhancedAvatar.startsWith("blob:"));

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = (e) => {
    console.error("ReelProfilePreview image error:", e);
    setImageLoaded(false);
    setImageError(true);
  };

  return (
    <>
      <div className={`reel-profile-preview ${className}`}>
        <div className="reel-profile-container">
          <div
            className="reel-profile-avatar"
            style={{
              width: `${currentSize.avatar}px`,
              height: `${currentSize.avatar}px`,
            }}
            onClick={handleProfileClick}
          >
            {isValidUrl && (
              <img
                src={enhancedAvatar}
                alt={author}
                loading="eager"
                decoding="async"
                onLoad={handleImageLoad}
                onError={handleImageError}
                crossOrigin="anonymous"
              />
            )}
            <span
              className="reel-profile-fallback"
              style={{
                fontSize: `${currentSize.avatar * 0.5}px`,
              }}
            >
              {typeof avatar === "string" && avatar.length === 1
                ? avatar
                : author?.charAt(0)?.toUpperCase() || "U"}
            </span>
          </div>

          <div className="reel-profile-text">
            <div
              className="reel-profile-name"
              style={{ fontSize: `${currentSize.name}px` }}
              onClick={handleProfileClick}
            >
              <span>{author}</span>
              {verified && (
                <div className="reel-profile-verified">
                  <Sparkles size={currentSize.name - 2} />
                </div>
              )}
            </div>

            <button
              className={`reel-profile-music ${!hasMusic ? "no-music" : ""}`}
              onClick={handleMusicClick}
              style={{ fontSize: `${currentSize.music}px` }}
              disabled={!hasMusic}
            >
              <Music size={currentSize.music + 1} />
              {hasMusic ? (
                <span className="reel-music-text">{music}</span>
              ) : (
                <span className="reel-music-text-animated">
                  <span
                    className={`music-text-slide ${animationIndex === 0 ? "active" : ""}`}
                  >
                    No sound used
                  </span>
                  <span
                    className={`music-text-slide ${animationIndex === 1 ? "active" : ""}`}
                  >
                    @{username}
                  </span>
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {showProfileModal &&
        ReactDOM.createPortal(
          <UserProfileModal
            user={{
              id: userId,
              user_id: userId,
              userId: userId,
              name: author,
              author: author,
              username: username,
              avatar: avatar,
              verified: verified,
            }}
            currentUser={currentUser}
            onClose={() => setShowProfileModal(false)}
          />,
          document.body,
        )}

      <style jsx>{`
        .reel-profile-preview {
          display: flex;
          max-width: fit-content;
        }

        .reel-profile-container {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          padding: 6px 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          transition: all 0.2s;
        }

        .reel-profile-container:hover {
          background: rgba(0, 0, 0, 0.65);
        }

        .reel-profile-avatar {
          border-radius: 50%;
          border: 2.5px solid #84cc16;
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: #000;
          flex-shrink: 0;
          overflow: hidden;
          position: relative;
          box-shadow: 0 3px 12px rgba(132, 204, 22, 0.4);
          cursor: pointer;
          transition: transform 0.2s;
        }

        .reel-profile-avatar:hover {
          transform: scale(1.05);
        }

        .reel-profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          position: absolute;
          top: 0;
          left: 0;
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          backface-visibility: hidden;
          transform: translateZ(0);
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          filter: brightness(1.15) contrast(1.2) saturate(1.25) sharpen(1.5);
          opacity: ${imageLoaded && !imageError ? "1" : "0"};
          transition: opacity 0.4s ease-in-out;
        }

        .reel-profile-fallback {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          font-weight: 800;
          color: #000;
          opacity: ${imageLoaded && !imageError ? "0" : "1"};
          transition: opacity 0.4s ease-in-out;
        }

        .reel-profile-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }

        .reel-profile-name {
          font-weight: 700;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 6px;
          text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          filter: brightness(1.1);
          cursor: pointer;
          transition: transform 0.2s;
        }

        .reel-profile-name:hover {
          transform: scale(1.02);
        }

        .reel-profile-verified {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #84cc16 0%, #a3e635 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(132, 204, 22, 0.5);
        }

        .reel-profile-music {
          background: transparent;
          padding: 0;
          border: none;
          display: flex;
          align-items: center;
          gap: 4px;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: all 0.2s;
          max-width: 180px;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
          text-align: left;
        }

        .reel-profile-music.no-music {
          cursor: default;
          opacity: 0.7;
        }

        .reel-profile-music:not(.no-music):hover {
          color: #84cc16;
          transform: scale(1.02);
        }

        .reel-music-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }

        .reel-music-text-animated {
          position: relative;
          display: inline-block;
          height: 1.2em;
          overflow: hidden;
          width: 100%;
        }

        .music-text-slide {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .music-text-slide.active {
          opacity: 1;
          transform: translateY(0);
        }

        @media (max-width: 768px) {
          .reel-profile-container {
            padding: 5px 10px;
          }

          .reel-profile-music {
            max-width: 160px;
          }
        }
      `}</style>
    </>
  );
};

export default ReelProfilePreview;
