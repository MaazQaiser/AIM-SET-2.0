import { beforeEach, describe, expect, it } from "vitest";
import { useBotChatStore } from "@/stores/use-bot-chat";

describe("useBotChatStore", () => {
  beforeEach(() => {
    useBotChatStore.setState({ byCallId: {} });
  });

  it("resets the selected call chat without clearing other call threads", () => {
    const store = useBotChatStore.getState();

    store.appendMessage("call-live", "direct", {
      id: "direct-1",
      role: "user",
      content: "Where is the team based?",
      createdAt: 1,
    });
    store.appendMessage("call-live", "group", {
      id: "group-1",
      role: "assistant",
      content: "Here is a talk track.",
      createdAt: 2,
    });
    store.appendMessage("other-call", "direct", {
      id: "other-1",
      role: "user",
      content: "Keep this thread.",
      createdAt: 3,
    });

    useBotChatStore.getState().resetCall("call-live");

    expect(useBotChatStore.getState().getMessages("call-live", "direct")).toEqual([]);
    expect(useBotChatStore.getState().getMessages("call-live", "group")).toEqual([]);
    expect(useBotChatStore.getState().getMessages("other-call", "direct")).toHaveLength(1);
  });
});
