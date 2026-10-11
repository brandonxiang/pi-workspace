import type { ChangeEvent } from "react";
import Sender from "@ant-design/x/es/sender";
import Suggestion from "@ant-design/x/es/suggestion";
import {
  getSlashAutocompleteValue,
  shouldShowSlashSuggestions,
  type PluginSlashCommand,
} from "../../../shared/slash-commands.js";
import type { Translator } from "../../i18n/index";
import type {
  ImageAttachment,
  QueuedComposerMessage,
  SkillItem,
  SlashSuggestionInfo,
} from "../../types/index";
import { supportedImageMimeTypes } from "../../constants/index";
import {
  getImageDataUrl,
  isPanelModeShortcut,
  isSidebarToggleShortcut,
  isSteeringSubmitShortcut,
} from "../../utils/index";
import { getSlashSuggestionItems } from "./SlashSuggestions";

export interface ComposerProps {
  t: Translator;
  input: string;
  onInputChange: (value: string) => void;
  onSlashSelect: (value: string) => void;
  selectedImage: ImageAttachment | null;
  onRemoveImage: () => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  skills: SkillItem[];
  pluginCommands: PluginSlashCommand[];
  disabled: boolean;
  queuedFollowUps: QueuedComposerMessage[];
  onRemoveQueuedFollowUp: (id: string) => void;
  onSubmit: (messageText: string) => void;
  onSubmitSteering: (messageText: string) => void;
}

export function Composer({
  t,
  input,
  onInputChange,
  onSlashSelect,
  selectedImage,
  onRemoveImage,
  onImageChange,
  skills,
  pluginCommands,
  disabled,
  queuedFollowUps,
  onRemoveQueuedFollowUp,
  onSubmit,
  onSubmitSteering,
}: ComposerProps) {
  return (
    <div className="composer">
      {queuedFollowUps.length > 0 ? (
        <div className="composer-queue-header">
          <div className="composer-queue-title">{t("composer.followingUp")}</div>
          <div className="composer-queue-list">
            {queuedFollowUps.map((item) => (
              <div className="composer-queue-item" key={item.id}>
                <span>{item.content}</span>
                <button
                  type="button"
                  aria-label={`Remove queued follow-up: ${item.content}`}
                  onClick={() => onRemoveQueuedFollowUp(item.id)}
                >
                  {t("composer.remove")}
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {selectedImage ? (
        <div className="attachment-preview">
          <img alt={selectedImage.name} src={getImageDataUrl(selectedImage)} />
          <div>
            <strong>{selectedImage.name}</strong>
            <span>
              {t("composer.attachmentMeta", { size: Math.ceil(selectedImage.size / 1024) })}
            </span>
          </div>
          <button type="button" onClick={onRemoveImage}>
            {t("composer.remove")}
          </button>
        </div>
      ) : null}
      <input
        className="composer-upload-input"
        accept={supportedImageMimeTypes.join(",")}
        onChange={onImageChange}
        type="file"
      />
      <Suggestion<SlashSuggestionInfo>
        block
        className="slash-command-suggestion"
        items={(info) => getSlashSuggestionItems(t, skills, pluginCommands, info?.query)}
        onSelect={onSlashSelect}
      >
        {({ onKeyDown, onTrigger }) => (
          <Sender
            autoSize={{ minRows: 2, maxRows: 8 }}
            className="chat-sender"
            disabled={disabled}
            loading={false}
            onChange={(value) => {
              onInputChange(value);
              onTrigger(shouldShowSlashSuggestions(value) ? { query: value.slice(1) } : false);
            }}
            onKeyDown={(event) => {
              if (isSidebarToggleShortcut(event)) {
                return;
              }

              if (isPanelModeShortcut(event)) {
                return;
              }

              if (isSteeringSubmitShortcut(event)) {
                event.preventDefault();
                onSubmitSteering(input);
                onTrigger(false);
                return;
              }

              event.stopPropagation();

              if (!event.shiftKey && event.key === "Tab") {
                const autocompleteValue = getSlashAutocompleteValue(
                  input,
                  skills.map((skill) => skill.name),
                  pluginCommands,
                );

                if (autocompleteValue) {
                  event.preventDefault();
                  onSlashSelect(autocompleteValue);
                  onTrigger(false);
                  return;
                }
              }

              onKeyDown(event);
            }}
            onSubmit={onSubmit}
            placeholder={t("composer.continuePiSession")}
            submitType="enter"
            value={input}
          />
        )}
      </Suggestion>
    </div>
  );
}
