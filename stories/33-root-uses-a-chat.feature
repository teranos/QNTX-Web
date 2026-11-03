Feature: ROOT uses a chat

  "every time i open the chat i need to scroll down"
  "apparesatnyl this is going to become cult knowledge"
  "and on desktop i cant even resize it, why show rezise option, but i cant resize"
  "when i shake my phone, ts adds the screenshot, btu the ui is unusbalne"

  Scenario: ROOT opens a long chat
    Given I am ROOT with a long chat with the Node Agent open
    Then it stands at its newest message, and stays there
    And I can press a harness from there

  Scenario: ROOT drags the corner of a chat's window
    Given I am ROOT with a long chat with the Node Agent open
    When I drag the corner of its window smaller
    Then what I say to it stays in the window, and the transcript scrolls inside

  Scenario: ROOT shakes the phone
    Given I am ROOT on a phone
    When I shake it
    Then the screenshot is in the chat, and what I say to it stays on the screen
