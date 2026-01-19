import React from 'react';
import { X } from 'lucide-react';

const MediaPreview = ({ 
  files = [], 
  onRemove, 
  type = 'image', 
  gridLayout = 'auto' 
}) => {
  if (!files || files.length === 0) return null;

  return (
    <div className="media-preview-wrapper">
      <div className={`media-preview-grid layout-${gridLayout}`}>
        {files.map((file, index) => {
          const objectUrl = file instanceof File ? URL.createObjectURL(file) : file;
          const fileName = file instanceof File ? file.name : '';
          const fileSize = file instanceof File ? (file.size / (1024 * 1024)).toFixed(1) : '';

          return (
            <div key={index} className="media-preview-card">
              <div className="media-preview-content">
                {type === 'image' ? (
                  <img 
                    src={objectUrl} 
                    alt={`Preview ${index + 1}`}
                    onError={(e) => {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+SW1hZ2U8L3RleHQ+PC9zdmc+';
                    }}
                  />
                ) : (
                  <video 
                    src={objectUrl}
                    onError={(e) => {
                      e.target.poster = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE4IiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+VmlkZW88L3RleHQ+PC9zdmc+';
                    }}
                  />
                )}
              </div>
              
              {onRemove && (
                <button 
                  className="media-remove-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  aria-label="Remove media"
                  type="button"
                >
                  <X size={16} />
                </button>
              )}
              
              {fileSize && (
                <div className="media-info-badge">
                  {fileSize}MB
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <style jsx>{`
        .media-preview-wrapper {
          margin-top: 16px;
          width: 100%;
        }

        .media-preview-grid {
          display: grid;
          gap: 12px;
          width: 100%;
        }

        .media-preview-grid.layout-auto {
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        }

        .media-preview-grid.layout-single {
          grid-template-columns: 1fr;
        }

        .media-preview-grid.layout-two {
          grid-template-columns: repeat(2, 1fr);
        }

        .media-preview-card {
          position: relative;
          aspect-ratio: 1;
          border-radius: 12px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid rgba(132, 204, 22, 0.2);
          transition: all 0.3s ease;
        }

        .media-preview-card:hover {
          border-color: rgba(132, 204, 22, 0.5);
          transform: scale(1.02);
        }

        .media-preview-content {
          width: 100%;
          height: 100%;
        }

        .media-preview-content img,
        .media-preview-content video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .media-remove-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.95);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          z-index: 10;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .media-remove-btn:hover {
          background: #dc2626;
          transform: scale(1.1);
        }

        .media-remove-btn:active {
          transform: scale(0.95);
        }

        .media-info-badge {
          position: absolute;
          bottom: 8px;
          left: 8px;
          padding: 4px 8px;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(10px);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          color: #84cc16;
        }

        @media (max-width: 768px) {
          .media-preview-grid.layout-auto {
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          }
          
          .media-preview-card {
            border-width: 1px;
          }
        }
      `}</style>
    </div>
  );
};

export default MediaPreview;