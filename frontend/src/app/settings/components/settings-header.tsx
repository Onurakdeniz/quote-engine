import React from 'react';
import { Button } from '@/components/ui/button';
import { Settings as SettingsIcon, RotateCcw, Save } from 'lucide-react';

interface SettingsHeaderProps {
  hasUnsavedChanges: boolean;
  onSave: () => void;
  onReset: () => void;
}

export function SettingsHeader({ hasUnsavedChanges, onSave, onReset }: SettingsHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold flex items-center space-x-2">
          <SettingsIcon className="w-8 h-8" />
          <span>Configuration</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure price quoter parameters and manage tracked tokens
        </p>
      </div>
      <div className="flex space-x-2">
        <Button 
          variant="outline" 
          onClick={onReset}
          disabled={!hasUnsavedChanges}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
        <Button 
          onClick={onSave}
          disabled={!hasUnsavedChanges}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Changes
        </Button>
      </div>
    </div>
  );
} 