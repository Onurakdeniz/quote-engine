"use client";

import React from 'react';
import { SettingsHeader } from './settings-header';
import { QuotingParameters } from './quoting-parameters';
import { GasConfiguration } from './gas-configuration';
import { TrackedTokens } from './tracked-tokens';
import { useSettings } from '../hooks';

export function Settings() {
  const {
    config,
    trackedTokens,
    hasUnsavedChanges,
    numeraireOptions,
    handleConfigChange,
    handleSaveSettings,
    handleResetSettings,
    addTrackedToken,
    removeTrackedToken
  } = useSettings();

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Settings Header */}
      <SettingsHeader
        hasUnsavedChanges={hasUnsavedChanges}
        onSave={handleSaveSettings}
        onReset={handleResetSettings}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quoting Parameters */}
        <QuotingParameters
          config={config}
          numeraireOptions={numeraireOptions}
          onConfigChange={handleConfigChange}
        />

        {/* Gas Configuration */}
        <GasConfiguration
          config={config}
          onConfigChange={handleConfigChange}
        />
      </div>

      {/* Tracked Tokens Management */}
      <TrackedTokens
        trackedTokens={trackedTokens}
        onAddToken={addTrackedToken}
        onRemoveToken={removeTrackedToken}
      />
    </div>
  );
} 