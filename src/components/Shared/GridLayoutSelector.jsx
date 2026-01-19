import React from 'react';
import { Grid, Layout, Maximize2 } from 'lucide-react';

const GridLayoutSelector = ({ selected = 'auto', onChange }) => {
  const layouts = [
    { id: 'auto', icon: Grid, label: 'Auto Grid', description: '4-5 images per row' },
    { id: 'single', icon: Maximize2, label: 'Single', description: 'One image per row' },
    { id: 'two', icon: Layout, label: 'Two Columns', description: 'Two images per row' }
  ];

  return (
    <div className="grid-selector-component">
      <label className="grid-selector-label">
        <Layout size={16} />
        <span>Image Layout</span>
      </label>
      <div className="grid-options-wrapper">
        {layouts.map(layout => {
          const Icon = layout.icon;
          return (
            <button
              key={layout.id}
              type="button"
              className={`grid-option-btn ${selected === layout.id ? 'active' : ''}`}
              onClick={() => onChange && onChange(layout.id)}
            >
              <Icon size={18} />
              <div className="grid-option-text">
                <span className="grid-option-label">{layout.label}</span>
                <span className="grid-option-desc">{layout.description}</span>
              </div>
            </button>
          );
        })}
      </div>

      <style jsx>{`
        .grid-selector-component {
          margin: 16px 0;
        }

        .grid-selector-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #e5e5e5;
          margin-bottom: 12px;
        }

        .grid-options-wrapper {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 8px;
        }

        .grid-option-btn {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(132, 204, 22, 0.2);
          border-radius: 10px;
          color: #a3a3a3;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.2s;
        }

        .grid-option-btn:hover {
          background: rgba(132, 204, 22, 0.05);
          border-color: rgba(132, 204, 22, 0.4);
          color: #84cc16;
        }

        .grid-option-btn.active {
          background: linear-gradient(135deg, #84cc16 0%, #65a30d 100%);
          border-color: #84cc16;
          color: #000;
        }

        .grid-option-text {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
        }

        .grid-option-label {
          font-size: 13px;
          font-weight: 600;
        }

        .grid-option-desc {
          font-size: 11px;
          opacity: 0.7;
        }

        @media (max-width: 768px) {
          .grid-options-wrapper {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default GridLayoutSelector;