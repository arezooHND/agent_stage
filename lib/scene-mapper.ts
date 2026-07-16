export function toScene(agent: any, videoRows: any[]) {
  return {
    name: agent.name,
    characterName: agent.character_name,
    systemPrompt: agent.system_prompt,
    idleMessage: agent.idle_message,
    selectionPrompt: agent.selection_prompt,
    orientation: agent.orientation,
    showBotText: agent.show_bot_text,
    idleVideoIndex: agent.idle_video_index,
    slug: agent.slug,
    videos: videoRows.map((v) => ({
      index: v.video_order,
      url: v.file_path,
      label: v.label,
      description: v.description ?? undefined,
      includesSpeech: v.includes_speech,
      trigger: v.trigger ?? undefined,
    })),
  };
}