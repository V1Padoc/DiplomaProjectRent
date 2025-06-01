// frontend/src/components/SortablePhotoItem.jsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export function SortablePhotoItem({ id, photo, onRemove, isExisting }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
    zIndex: isDragging ? 100 : 'auto', // Ensure dragging item is on top
    touchAction: 'none', // Recommended for PointerSensor compatibility
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative w-32 h-32 border rounded-sm overflow-hidden shadow-md m-1" // Added margin for spacing
    >
      <img
        src={photo.previewUrl}
        alt={`Preview ${photo.file ? photo.file.name : photo.originalFilename}`}
        className="w-full h-full object-cover"
        onError={(e) => { e.target.src = 'https://via.placeholder.com/128?text=BrokenImage'; }} // Fallback for broken images
      />
      {/* Drag Handle - The entire item can be the handle or you can make a specific icon */}
      <button
        type="button"
        {...listeners} // Spread listeners here for the drag handle
        className="absolute top-0 left-0 w-8 h-8 bg-gray-800 bg-opacity-30 text-white cursor-grab flex items-center justify-center"
        aria-label="Drag to reorder"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
        </svg>
      </button>
      <button
        type="button"
        onClick={() => onRemove(id)}
        className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 text-xs leading-none flex items-center justify-center w-5 h-5"
        aria-label="Remove photo"
      >
        X
      </button>
      {isExisting !== undefined && (
         <span className={`absolute bottom-0 left-0 right-0 px-1 py-0.5 text-xs text-white text-center ${isExisting ? 'bg-gray-700 opacity-75' : 'bg-blue-600 opacity-75'}`}>
           {isExisting ? 'Saved' : 'New'}
         </span>
      )}
    </div>
  );
}