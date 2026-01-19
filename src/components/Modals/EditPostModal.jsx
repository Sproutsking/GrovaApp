import React, { useState } from 'react';

const EditPostModal = ({ story, onUpdate, onClose }) => {
  const [updatedTitle, setUpdatedTitle] = useState(story.title);
  const [updatedPreview, setUpdatedPreview] = useState(story.preview);

  const handleSubmit = () => {
    onUpdate({ ...story, title: updatedTitle, preview: updatedPreview });
  };

  return (
    <div className="modal-overlay">
      <div className="edit-modal">
        <h3>Edit Post</h3>
        <input value={updatedTitle} onChange={e => setUpdatedTitle(e.target.value)} placeholder="Title" />
        <textarea value={updatedPreview} onChange={e => setUpdatedPreview(e.target.value)} placeholder="Preview" />
        <button onClick={handleSubmit}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export default EditPostModal;