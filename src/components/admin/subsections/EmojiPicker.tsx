// src/components/admin/subsections/EmojiPicker.tsx
'use client';

import { useState } from 'react';

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

const EMOJI_CATEGORIES = {
  'Popular': ['📝', '🚀', '📌', '💡', '🎨', '🔧', '📱', '💻', '🎯', '⚡', '🌟', '✨'],
  'Objects': ['📄', '📁', '📂', '🗂️', '📋', '📊', '📈', '📉', '🗃️', '📦', '🎁', '🔖'],
  'Symbols': ['✅', '❌', '⭐', '💎', '🔥', '💫', '🌈', '🎪', '🎭', '🎬', '🎮', '🎲'],
  'Activities': ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '🎯', '🎪', '🎨'],
  'Nature': ['🌱', '🌿', '🍀', '🌸', '🌺', '🌻', '🌹', '🌷', '🌼', '🌴', '🌵', '🌾'],
  'Food': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥝', '🍍'],
  'Travel': ['✈️', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻'],
  'Faces': ['😀', '😃', '😄', '😁', '😊', '😍', '🥰', '😎', '🤓', '🧐', '🤔', '🤗']
};

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('Popular');

  const handleEmojiSelect = (emoji: string) => {
    onChange(emoji);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <span className="mb-[var(--admin-field-gap)] block text-[length:var(--admin-text-meta)] font-medium text-[color:var(--admin-heading)]">
        Icon
      </span>
      
      <div className="flex gap-2">
        {/* Current emoji display */}
        <div className="flex size-[var(--admin-touch-h)] shrink-0 items-center justify-center rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-strong)] bg-[color:var(--admin-input-bg)] text-[length:var(--admin-text-panel-title)]">
          {value || '📄'}
        </div>
        
        {/* Picker button */}
        <button
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className="h-[var(--admin-control-h)] min-w-0 flex-1 cursor-pointer rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-strong)] bg-[color:var(--admin-input-bg)] px-[var(--admin-space-3)] text-left text-[length:var(--admin-text-body)] text-[color:var(--admin-heading)] transition-colors hover:border-[color:var(--admin-heading)]"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          {value ? `${value} selected` : 'Choose an icon'}
        </button>
      </div>

      {/* Emoji picker dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Picker panel */}
          <div className="absolute left-0 right-0 top-full z-50 mt-[var(--admin-space-2)] overflow-hidden rounded-[var(--admin-radius-panel)] border border-[color:var(--admin-border-strong)] bg-[color:var(--admin-surface)] shadow-[var(--admin-shadow-drawer)]">
            {/* Category tabs */}
            <div className="flex overflow-x-auto border-b border-[color:var(--admin-border)] bg-[color:var(--admin-surface-2)]">
              {Object.keys(EMOJI_CATEGORIES).map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category as keyof typeof EMOJI_CATEGORIES)}
                  className={`border-b-2 px-[var(--admin-space-3)] py-[var(--admin-space-2)] text-[length:var(--admin-text-micro)] font-medium whitespace-nowrap transition-colors ${
                    activeCategory === category
                      ? 'border-[color:var(--admin-heading)] text-[color:var(--admin-heading)]'
                      : 'border-transparent text-[color:var(--admin-muted)] hover:text-[color:var(--admin-heading)]'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            {/* Emoji grid */}
            <div className="grid max-h-48 grid-cols-6 gap-[var(--admin-space-2)] overflow-y-auto p-[var(--admin-space-3)]">
              {EMOJI_CATEGORIES[activeCategory].map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmojiSelect(emoji)}
                  aria-label={`Choose ${emoji}`}
                  className="flex size-10 cursor-pointer items-center justify-center rounded-[var(--admin-radius-control)] text-[length:var(--admin-text-panel-title)] transition-colors hover:bg-[color:var(--admin-hover)]"
                  title={emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Manual input */}
            <div className="border-t border-[color:var(--admin-border)] p-[var(--admin-space-3)]">
              <input
                aria-label="Paste an emoji instead"
                className="h-[var(--admin-control-h)] w-full rounded-[var(--admin-radius-control)] border border-[color:var(--admin-border-strong)] bg-[color:var(--admin-input-bg)] px-[var(--admin-space-3)] text-[length:var(--admin-text-meta)] text-[color:var(--admin-heading)] placeholder:text-[color:var(--admin-subtle)]"
                onChange={(e) => onChange(e.target.value)}
                placeholder="Or paste an icon"
                type="text"
                value={value}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}