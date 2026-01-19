import React from 'react';

const SaveFolderModal = ({ folders, onSave, onClose }) => (
  <div className="modal-overlay">
    <div className="save-modal">
      <h3>Save to Folder</h3>
      {folders.map(folder => (
        <button key={folder} onClick={() => onSave(folder)}>{folder}</button>
      ))}
      <button onClick={onClose}>Cancel</button>
    </div>
  </div>
);

export default SaveFolderModal;